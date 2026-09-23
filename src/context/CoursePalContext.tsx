import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { Course, Week, Reading, Assignment, VaultDocument, MediaType, ImportOutcome, DiagnosticImportRecord, CourseDTO } from '../types/models';
import { MasterCoursePalette } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import { persistenceManager } from '../services/DataPersistenceBackupManager';
import { LocalSyllabusParser } from '../services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../utils/syllabusCatalog';
import cityuSyllabi from '../utils/cityu_syllabi_texts.json';
import { SyllabusImportManager } from '../services/SyllabusImportManager';
import {
  cleanChapterFromRaw,
  formatDisplayTitleWithChapter,
  parseSafeDate,
  distillSmartReadingTitle,
  stripChapterMentions,
  isGenericPlaceholderReadingTitle,
  healItemWeeks,
  formatShortDocumentTitle,
  isInvalidAssignmentTitle,
  isGenericPlaceholderTheme,
  cleanAcademicWeekTheme,
  isItemForCourse
} from '../utils/readingDisplayHelper';
import { weekNumberForDate } from '../utils/timeFormatters';
import { extractTextFromPDF, extractTextFromPDFContent, renderPDFPages, extractTextFromDocxBase64 } from '../services/PDFTextExtractor';
import { ensureBundledPdfFile, hydrateVaultDocWithRealPdf } from '../utils/bundledPdfService';
import { beginBackgroundTask, endBackgroundTask } from '../services/BackgroundTaskService';

export type TabKey = 'readings' | 'assignments' | 'syllabus' | 'invite';

export interface ImportSyllabusParams {
  fileName: string;
  fileUri?: string;
  rawText?: string;
  fileSize?: string;
  targetCourseId?: string;
  preferredHexColor?: string;
  preserveCourseTitle?: string;
  preserveCourseSubtitle?: string;
  preserveCourseCode?: string;
  isNewCourse?: boolean;
}

export interface ImportBannerState {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  diagnosticRecord?: DiagnosticImportRecord;
}

interface CoursePalContextType {
  // State
  courses: Course[];
  readings: Reading[];
  assignments: Assignment[];
  vaultDocs: VaultDocument[];
  selectedTab: TabKey;
  selectedCourseFilter: Course | null;
  isUploading: boolean;
  uploadStatusText: string;
  uploadProgress: number;
  hasAcceptedTerms: boolean;
  hasLoadedTerms: boolean;
  showConfetti: boolean;
  confettiTitle: string;
  latestDiagnosticRecord: DiagnosticImportRecord | null;
  importBanner: ImportBannerState | null;

  // Actions
  dismissImportBanner: () => void;
  setSelectedTab: (tab: TabKey) => void;
  setSelectedCourseFilter: (course: Course | null) => void;
  toggleReading: (id: string) => void;
  toggleAssignment: (id: string) => void;
  updateAssignment: (updated: Assignment) => void;
  updateReading: (updated: Reading) => void;
  restoreAssignment: (id: string) => void;
  restoreReading: (id: string) => void;
  emptyTrash: () => void;
  emptyReadingsTrash: () => void;
  emptyAssignmentsTrash: () => void;
  permanentlyDeleteReading: (id: string) => void;
  permanentlyDeleteAssignment: (id: string) => void;
  deleteReading: (id: string) => void;
  deleteAssignment: (id: string) => void;
  deleteCourse: (id: string) => void;
  deleteVaultDoc: (id: string) => void;
  addCourse: (data: { courseName: string; courseCode?: string; courseDescription?: string; hexColor: string }) => Course;
  updateCourse: (updated: Course) => void;
  addTask: (data: {
    category: 'assignment' | 'reading';
    title: string;
    courseId?: string;
    weekNumber: number;
    dueDate: Date;
    points?: number;
    weight?: number;
    mediaType?: MediaType;
    videoUrl?: string;
    notes?: string;
  }) => void;
  importShareCode: (codeOrLink: string) => { success: boolean; message: string; course?: Course };
  acceptTerms: () => void;
  importSyllabusDocument: (params: ImportSyllabusParams) => Promise<{
    success: boolean;
    outcome?: ImportOutcome;
    course?: Course;
    message: string;
    readingsCount?: number;
    assignmentsCount?: number;
  }>;
  startUploadSimulation: (fileName: string, targetCourseId?: string) => void;
  triggerConfetti: (title: string) => void;
  dismissConfetti: () => void;
  turnOffAllWeeks: () => void;
  checkAndResumeInterruptedUpload: () => Promise<void>;
  cancelUpload: () => Promise<void>;
}

const CoursePalContext = createContext<CoursePalContextType | undefined>(undefined);

const initialCourses: Course[] = [];

export function sanitizeReading(r: Reading): Reading {
  let preCleanTitle = (r.title || '')
    .replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat')
    .replace(/\|{2,}/g, ' - ')
    .replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '')
    .trim();
  let preCleanRes = r.resourceTitle
    ? r.resourceTitle.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat').trim()
    : undefined;
  let preCleanAuth = r.authorName
    ? r.authorName.replace(/\bGroth\s*:\s*Marnat\b/gi, 'Groth-Marnat').trim()
    : undefined;

  // Infer author if missing
  if (!preCleanAuth) {
    if (preCleanTitle.toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(preCleanTitle)) {
      preCleanAuth = 'Groth-Marnat';
    } else if (preCleanRes && (preCleanRes.toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(preCleanRes))) {
      preCleanAuth = 'Groth-Marnat';
    } else {
      const authM = preCleanTitle.match(/^([A-Z][a-zA-Z\s.&–-]+?)\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d)/i);
      if (authM) {
        preCleanAuth = authM[1].trim();
      }
    }
  }

  // Clean empty parentheses and author redundancy from resourceTitle
  if (preCleanRes) {
    let cleanR = preCleanRes.replace(/\s*\(\s*\)/g, '').trim();
    const normRes = cleanR.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normAuth = (preCleanAuth || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normRes && normAuth && (normRes === normAuth || normAuth.includes(normRes) || normRes.includes(normAuth))) {
      preCleanRes = undefined;
    } else if (!/[a-zA-Z]/.test(cleanR)) {
      preCleanRes = undefined;
    } else {
      preCleanRes = cleanR;
    }
  }

  // Suppress document-level textbook title from reading cards for CPC 512 so it does not clutter sections
  const normCode = (r.courseCode || '').replace(/\s+/g, '').toUpperCase();
  if (normCode === 'CPC512' || (preCleanRes && preCleanRes.toLowerCase().includes('mastering competency'))) {
    preCleanRes = undefined;
  }

  const preCleanCh = r.chapterText ? r.chapterText.replace(/\|{2,}/g, ' ').replace(/^\d+[\s:.\-–—]+\d+\s*[:·•\-–—]\s*/, '').trim() : null;
  const canonicalCh = cleanChapterFromRaw(preCleanCh || preCleanTitle);
  const displayTitle = formatDisplayTitleWithChapter(
    { ...r, title: preCleanTitle, chapterText: canonicalCh, resourceTitle: preCleanRes, authorName: preCleanAuth },
    canonicalCh,
    preCleanRes,
    null,
    preCleanAuth
  );
  const isPureMod = Boolean(r.moduleNumber && r.moduleNumber > 0 && (!r.weekNumber || r.weekNumber === 0));
  const cleanDueDate = isPureMod ? null : parseSafeDate(r.dueDate);
  const cleanDateRange = isPureMod ? null : (r.dateRangeStr || null);
  const isWeekActive = !isPureMod && (r.weekNumber !== undefined && r.weekNumber !== null
    ? r.weekNumber > 0
    : Boolean(r.weekId && r.weekId !== 'none' && /\d+/.test(r.weekId)));
  const cleanWeekNum = isWeekActive
    ? (r.weekNumber && r.weekNumber > 0 ? r.weekNumber : (r.weekId && /\d+/.test(r.weekId) ? parseInt(r.weekId.match(/\d+/)![0], 10) : 0))
    : 0;

  let cleanSummary = (r.summaryText || '').replace(/\|{2,}/g, '\n\n').trim();
  if (/^Study\s+(?:Chapter|Module|Ch\.)/i.test(cleanSummary) || /^Assigned reading for/i.test(cleanSummary)) {
    cleanSummary = '';
  }
  let cleanTopics = r.relevantTopics ? r.relevantTopics.replace(/\|{2,}/g, ', ').trim() : undefined;
  if (cleanTopics && isGenericPlaceholderTheme(cleanTopics)) {
    cleanTopics = undefined;
  }
  const cleanKeyTakeaways = (r.keyTakeawaysText || '').replace(/\|{2,}/g, '\n\n').trim();
  const isReq = r.isRequired !== undefined
    ? (r.isRequired !== false && r.requirementType !== 'optional')
    : (r.requirementType === 'optional' ? false : true);
  const reqType: 'required' | 'optional' = (r.requirementType === 'optional' || isReq === false) ? 'optional' : 'required';

  return {
    ...r,
    title: displayTitle.replace(/\|{2,}/g, ' - '),
    chapterText: canonicalCh || undefined,
    authorName: preCleanAuth || r.authorName,
    resourceTitle: preCleanRes,
    dueDate: cleanDueDate,
    dateRangeStr: cleanDateRange,
    weekId: isWeekActive && cleanWeekNum > 0 ? (r.weekId || `w-${cleanWeekNum}`) : undefined,
    weekNumber: isPureMod ? null : cleanWeekNum,
    isRequired: isReq,
    requirementType: reqType,
    summaryText: cleanSummary,
    relevantTopics: cleanTopics,
    keyTakeawaysText: cleanKeyTakeaways
  };
}

export function sanitizeAssignment(a: Assignment): Assignment {
  const cleanDueDate = parseSafeDate(a.dueDate);
  let cleanPts = a.pointsPossible ? a.pointsPossible.trim() : null;
  if (!cleanPts && (a as any).points != null) {
    cleanPts = `${(a as any).points} Pts`;
  }
  if (!cleanPts && (a as any).totalPoints != null) {
    cleanPts = `${(a as any).totalPoints} Pts`;
  }
  if (!cleanPts && (a as any).points_possible != null) {
    cleanPts = `${(a as any).points_possible} Pts`;
  }
  if (cleanPts && /^\d+$/.test(cleanPts)) {
    cleanPts = `${cleanPts} Pts`;
  }

  let cleanWeight = a.weightPercentage ? a.weightPercentage.trim() : null;
  if (!cleanWeight && (a as any).weight != null) {
    const rawW = (a as any).weight;
    if (typeof rawW === 'number' && !isNaN(rawW)) {
      cleanWeight = rawW > 0 && rawW <= 1 ? `${Math.round(rawW * 100)}%` : `${Math.round(rawW)}%`;
    } else if (typeof rawW === 'string' && rawW.trim()) {
      cleanWeight = rawW.trim().includes('%') ? rawW.trim() : `${rawW.trim()}%`;
    }
  }
  if (!cleanWeight && (a as any).percentage != null) {
    const rawP = (a as any).percentage;
    if (typeof rawP === 'number' && !isNaN(rawP)) {
      cleanWeight = rawP > 0 && rawP <= 1 ? `${Math.round(rawP * 100)}%` : `${Math.round(rawP)}%`;
    } else if (typeof rawP === 'string' && rawP.trim()) {
      cleanWeight = rawP.trim().includes('%') ? rawP.trim() : `${rawP.trim()}%`;
    }
  }
  if (cleanWeight && /^\d+$/.test(cleanWeight)) {
    cleanWeight = `${cleanWeight}%`;
  }

  let cleanInstr = a.fullInstructions ? a.fullInstructions.replace(/\|{2,}/g, '\n\n').trim() : undefined;
  if (cleanInstr === 'Parsed from course syllabus.' || cleanInstr === 'Parsed from syllabus.') {
    cleanInstr = undefined;
  }
  const cleanNotes = a.noteText ? a.noteText.replace(/\|{2,}/g, '\n• ').trim() : undefined;
  const cleanTopics = a.relevantTopics ? a.relevantTopics.replace(/\|{2,}/g, ', ').trim() : undefined;
  const cleanTitle = a.title ? a.title.replace(/\|{2,}/g, ' - ').trim() : 'Assignment';

  // Fallback scanning for weight percentage from notes/instructions if missing
  if (!cleanWeight) {
    const textToScan = `${cleanTitle} ${cleanNotes || ''} ${cleanInstr || ''} ${cleanTopics || ''}`;
    const wm = textToScan.match(/\b(?:worth\s+|weight:\s*)?(\d{1,3}(?:\.\d+)?)\s*%/i) || textToScan.match(/\b(\d{1,3})\s*(?:percent)\b/i);
    if (wm) {
      cleanWeight = `${wm[1]}%`;
    }
  }

  // Fallback scanning for genuine points from notes/instructions if missing and not explicitly null
  if (a.pointsPossible !== null && !cleanPts) {
    const textToScan = `${cleanTitle} ${cleanNotes || ''} ${cleanInstr || ''}`;
    const pm = textToScan.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
    if (pm) {
      cleanPts = `${pm[1]} Pts`;
    }
  }

  return {
    ...a,
    title: cleanTitle,
    dueDate: cleanDueDate,
    pointsPossible: cleanPts,
    weightPercentage: cleanWeight,
    assignmentNumber: a.assignmentNumber ?? null,
    assignmentNumberLabel: a.assignmentNumberLabel ?? (a.assignmentNumber ? `Assignment ${a.assignmentNumber}` : null),
    fullInstructions: cleanInstr,
    noteText: cleanNotes,
    relevantTopics: cleanTopics,
    weekNumber: typeof a.weekNumber === 'number' ? a.weekNumber : 0,
    scheduledWeeks: Array.isArray(a.scheduledWeeks) && a.scheduledWeeks.length > 0 ? a.scheduledWeeks : undefined,
    rubricCriteria: (a.rubricCriteria || []).map(r => ({
      ...r,
      criterionName: r.criterionName ? r.criterionName.replace(/\|{2,}/g, ' - ').trim() : ''
    }))
  };
}

export const isGenericToken = (t?: string | null) => {
  if (!t) return true;
  const clean = t.trim().replace(/[-_.]+/g, ' ');
  return (
    /^(new|new course|new cou|reading|assignment|crs|gen\s*101|syllabus|syllabi|course|courses|document|documents|doc|docs|schedule|outline|curriculum|class|classes|file|presentation|media|unnamed|unknown)$/i.test(
      clean
    ) ||
    /^(syllabus|course|document|doc|media|schedule|outline)\s*(fall|spring|summer|winter|term|semester|\d{4}|\d+)*$/i.test(
      clean
    ) ||
    /^(syllabus|course|document|doc|media)[_\s\d-]*$/i.test(t.trim())
  );
};

export const isStubOrFileName = (n?: string | null) =>
  !n ||
  isGenericToken(n) ||
  /syllabus$/i.test(n.trim()) ||
  /_syllabus$/i.test(n.trim()) ||
  /^media[_\s\d]/i.test(n.trim()) ||
  /\.(pdf|docx|txt|doc)$/i.test(n.trim());

export function createDefaultCoursesSeed(): {
  courses: Course[];
  readings: Reading[];
  assignments: Assignment[];
  vaultDocs: VaultDocument[];
} {
  const coreCatalogIds = ['psyc-612', 'cpc-527'];
  const allCourses: Course[] = [];
  const allReadings: Reading[] = [];
  const allAssignments: Assignment[] = [];
  const allVaultDocs: VaultDocument[] = [];

  for (const id of coreCatalogIds) {
    const cpcItem = BundledSyllabiCatalog.find(b => b.id === id);
    if (!cpcItem) continue;

    const parsed: any = LocalSyllabusParser.shared.parseText(cpcItem.rawText);
    const seededCourseId = `c-${id}-active`;
    const fileName = cpcItem.fileName || `${id.toUpperCase()}_Syllabus.pdf`;
    const courseCode = parsed.courseCode || cpcItem.courseCode;

    const baseCourse: Course = {
      id: seededCourseId,
      creatorId: 'user-self',
      courseName: parsed.courseName || cpcItem.courseName,
      courseCode: courseCode,
      courseDescription: `Imported from ${fileName}. Faculty: ${parsed.instructorName || cpcItem.instructorName}`,
      instructorName: parsed.instructorName || cpcItem.instructorName,
      instructorEmail: parsed.instructorEmail || cpcItem.instructorEmail,
      hexColor: cpcItem.hexColor,
      termWeeks: parsed.termWeeks || 12,
      sharingCode: courseCode.replace(/\s+/g, ''),
      isDeleted: false,
      isFavorite: true,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: []
    };

    const courseReadings: Reading[] = [];
    for (const w of (parsed.weeks || [])) {
      for (const r of (w.readings || [])) {
        const readingDate = parseSafeDate(r.dueDate);
        courseReadings.push(sanitizeReading({
          id: r.id || `r-${id}-${Math.random().toString(36).substring(2, 10)}`,
          title: r.title,
          authorName: r.authorName || null,
          resourceTitle: r.resourceTitle || r.title,
          mediaTypeRaw: r.mediaType || 'textbook',
          mediaType: (r.mediaType as any) || 'textbook',
          isCompleted: false,
          isDeleted: false,
          summaryText: r.summaryText || '',
          keyTakeawaysText: r.keyTakeawaysText || '',
          estimatedTimeText: r.estimatedTimeText || '~40–60 min',
          dueDate: readingDate,
          dateRangeStr: readingDate ? readingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Week ${w.weekNumber}`,
          chapterText: r.chapterText || null,
          pagesText: r.pagesText || null,
          courseCode: courseCode,
          relevantTopics: r.relevantTopics || w.theme,
          sourceDocumentName: fileName,
          docColorHex: baseCourse.hexColor,
          isFavorite: false,
          weekId: `w-${w.weekNumber}`,
          weekNumber: w.weekNumber,
          courseId: seededCourseId,
          videoUrl: r.videoUrl || null
        }));
      }
    }

    const courseAssignments: Assignment[] = (parsed.assignments || []).map((a: any, aIdx: number) => {
      const dueDate = parseSafeDate(a.dueDate);
      let resolvedWeek = typeof a.weekNumber === 'number' && a.weekNumber > 0 ? a.weekNumber : 0;
      if (resolvedWeek <= 0 && a.title) {
        const m = a.title.match(/\b(?:week|wk|module|mod)\s*[:\-–#.]*\s*(\d{1,2})\b/i);
        if (m) resolvedWeek = parseInt(m[1], 10);
      }
      if (resolvedWeek <= 0 && dueDate) {
        resolvedWeek = weekNumberForDate(dueDate);
      }
      if (resolvedWeek <= 0) {
        const lower = (a.title || '').toLowerCase();
        if (lower.includes('midterm')) resolvedWeek = 5;
        else if (lower.includes('final') || lower.includes('presentation') || lower.includes('capstone')) resolvedWeek = 10;
        else resolvedWeek = Math.min(10, aIdx + 1);
      }
      return sanitizeAssignment({
        id: a.id || `a-${id}-${aIdx + 1}`,
        title: a.title,
        weekNumber: resolvedWeek,
        dueDate: dueDate,
        fullInstructions: (a.fullInstructions && a.fullInstructions !== 'Parsed from course syllabus.' && a.fullInstructions !== 'Parsed from syllabus.')
          ? a.fullInstructions
          : (a.instructions || a.description || null),
        pointsPossible: a.pointsPossible || null,
        pointsBreakdown: a.pointsBreakdown || null,
        rubricJSON: a.rubricJSON || null,
        noteText: a.noteText || null,
        isCompleted: false,
        isDeleted: false,
        courseCode: courseCode,
        moduleMention: `Week ${resolvedWeek}`,
        weightPercentage: a.weightPercentage || null,
        subTypeRaw: a.subType || 'PAPER',
        mediaUrl: a.mediaUrl || null,
        relevantTopics: `Assignment ${aIdx + 1}`,
        sourceDocumentName: fileName,
        docColorHex: baseCourse.hexColor,
        isFavorite: false,
        courseId: seededCourseId,
        rubricCriteria: a.rubricCriteria || a.rubric || []
      });
    });

    const { readings: cleanCourseReadings, assignments: cleanCourseAssignments } = healItemWeeks(
      [baseCourse],
      courseReadings,
      courseAssignments
    );

    const maxW = Math.max(
      ...cleanCourseReadings.map(r => r.weekNumber || 1),
      baseCourse.termWeeks || 10,
      1
    );

    const weeks: Week[] = [];
    for (let w = 1; w <= maxW; w++) {
      const existingWeek = (parsed.weeks || []).find((ew: any) => ew.weekNumber === w);
      weeks.push({
        id: `w-${w}`,
        weekNumber: w,
        theme: existingWeek?.theme || `Week ${w}`,
        courseId: seededCourseId,
        readings: cleanCourseReadings.filter(r => r.weekNumber === w)
      });
    }

    const seededCourse: Course = {
      ...baseCourse,
      termWeeks: maxW,
      weeks,
      assignments: cleanCourseAssignments
    };

    allCourses.push(seededCourse);
    allReadings.push(...cleanCourseReadings);
    allAssignments.push(...cleanCourseAssignments);
    const cleanId = id.toLowerCase();
    let pdfFileName = 'CPC512_Syllabus.pdf';
    let defaultFileSize = '340 KB';
    if (cleanId.includes('psyc') || cleanId.includes('612')) {
      pdfFileName = 'PSYC612_Advanced_CBT_Interventions.pdf';
      defaultFileSize = '410 KB';
    } else if (cleanId.includes('514')) {
      pdfFileName = 'CPC514_Syllabus.pdf';
      defaultFileSize = '300 KB';
    } else if (cleanId.includes('527')) {
      pdfFileName = 'CPC527_Group_Counselling_Syllabus.pdf';
      defaultFileSize = '480 KB';
    } else if (cleanId.includes('511')) {
      pdfFileName = 'CPC511_Syllabus.pdf';
      defaultFileSize = '320 KB';
    } else if (cleanId.includes('523')) {
      pdfFileName = 'CPC523_Syllabus.pdf';
      defaultFileSize = '265 KB';
    }
    const initialPdfUri = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}syllabi/${pdfFileName}` : null;

    allVaultDocs.push({
      id: `vd-${id}-syllabus`,
      title: `${courseCode} Syllabus`,
      category: 'Syllabi',
      fileSize: cpcItem.fileSize || defaultFileSize,
      fileType: 'PDF',
      courseCode: courseCode,
      courseId: seededCourseId,
      fileContent: cpcItem.rawText.slice(0, 5000),
      docColorHex: baseCourse.hexColor,
      rawFileDataUri: initialPdfUri,
      pageImages: null,
      uploadedAt: new Date()
    });
  }

  return {
    courses: allCourses,
    readings: allReadings,
    assignments: allAssignments,
    vaultDocs: allVaultDocs
  };
}

export const createDefaultCPC527Seed = createDefaultCoursesSeed;

export function healCanonicalCPC512(
  courses: Course[],
  readings: Reading[],
  assignments: Assignment[],
  vaultDocs: VaultDocument[] = []
): { courses: Course[]; readings: Reading[]; assignments: Assignment[]; vaultDocs: VaultDocument[] } {
  const cleanCourses = [...courses];
  let rawReadings = [...readings];
  let rawAssignments = [...assignments];
  const cleanVaultDocs = [...vaultDocs];

  const cpc512Course = cleanCourses.find(c =>
    (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC512' ||
    (c.courseName || '').toLowerCase().includes('family systems')
  );
  if (!cpc512Course) {
    return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments, vaultDocs: cleanVaultDocs };
  }

  const isCpc512 = (r: Reading) => {
    const code = (r.courseCode || '').replace(/\s+/g, '').toUpperCase();
    return (r.courseId && r.courseId === cpc512Course.id) || code === 'CPC512';
  };
  const cpcReadings = rawReadings.filter(isCpc512);
  const cpcWeeklyReadings = cpcReadings.filter(r => (r.weekNumber || 0) > 0);
  const hasAllTenModules = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(m =>
    cpcReadings.some(r => r.moduleNumber === m && !r.isDeleted)
  );
  const hasModule6 = cpcReadings.some(r => r.moduleNumber === 6 && !r.isDeleted);
  const cpcAssignmentsExisting = rawAssignments.filter(a =>
    a.courseId ? a.courseId === cpc512Course.id : (a.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC512'
  );
  const hasPresentation = cpcAssignmentsExisting.some(a =>
    (a.title || '').toLowerCase().includes('presentation') &&
    Array.isArray(a.scheduledWeeks) &&
    a.scheduledWeeks.length >= 3 &&
    a.rubricCriteria &&
    a.rubricCriteria.length >= 6
  );
  const hasUnfabricatedPoints = true;
  const hasCleanWeeklyTitles = !cpcWeeklyReadings.some(r =>
    (r.title || '').includes('·') ||
    (r.title || '').includes('Evidence Based Practice') ||
    (r.title || '').includes('Evidenced-Based Practice') ||
    (r.title || '').includes('Case Conceptualization') ||
    (r.title || '').includes('Presentation Reference') ||
    (r.title || '').includes('Presentations')
  );
  const cpcPureModuleReadings = cpcReadings.filter(r => r.moduleNumber && (!r.weekNumber || r.weekNumber === 0));
  const hasDedicatedModuleReadings = cpcPureModuleReadings.length >= 10;
  const needsHealing =
    !hasDedicatedModuleReadings ||
    !hasAllTenModules ||
    !hasModule6 ||
    !hasPresentation ||
    !hasUnfabricatedPoints ||
    !hasCleanWeeklyTitles ||
    cpcWeeklyReadings.length < 10 ||
    cpcWeeklyReadings.some(r => r.weekNumber === 2 && (r.title || '').includes('Chapter 2')) ||
    cpcReadings.some(r =>
      (r.title || '').includes('Mastering Competency') ||
      (r.resourceTitle || '').includes('Mastering Competency') ||
      (r.title || '').includes('A Practical Approach')
    );

  if (needsHealing) {
    const completedWeeks = new Set<number>();
    const completedModules = new Set<number>();
    cpcReadings.forEach(r => {
      if (r.isCompleted && r.weekNumber) completedWeeks.add(r.weekNumber);
      if (r.isCompleted && r.moduleNumber && (!r.weekNumber || r.weekNumber === 0)) completedModules.add(r.moduleNumber);
    });

    rawReadings = rawReadings.filter(r =>
      r.courseId ? r.courseId !== cpc512Course.id : (r.courseCode || '').replace(/\s+/g, '').toUpperCase() !== 'CPC512'
    );

    // 1. Canonical Curriculum Module Readings (Table 1: 10 Dedicated Theoretical Modules)
    const canonicalModulesData = [
      {
        id: 'r-cpc512-mod-1',
        modNum: 1,
        title: 'Gehart (Chapters 1–3)',
        chapter: 'Chapters 1–3',
        theme: 'Systems Theory and the History of Family Therapy',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-2',
        modNum: 2,
        title: 'Gehart (Chapter 2)',
        chapter: 'Chapter 2',
        theme: 'Family of Origin/ Genograms',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-3',
        modNum: 3,
        title: 'Gehart (Chapters 11–15)',
        chapter: 'Chapters 11–15',
        theme: 'Diverse Populations and Family Therapy Case Conceptualization and Application',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-4',
        modNum: 4,
        title: 'Gehart (Chapter 7)',
        chapter: 'Chapter 7',
        theme: 'Bowen Family Systems',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-5',
        modNum: 5,
        title: 'Gehart (Chapter 5)',
        chapter: 'Chapter 5',
        theme: 'Structural Family Therapy',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-6',
        modNum: 6,
        title: 'Gehart (Chapter 4)',
        chapter: 'Chapter 4',
        theme: 'Strategic Family Therapy',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-7',
        modNum: 7,
        title: 'Gehart (Chapter 6)',
        chapter: 'Chapter 6',
        theme: 'Experiential Family Therapy',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-8',
        modNum: 8,
        title: 'Gehart (Chapter 7)',
        chapter: 'Chapter 7',
        theme: 'Psychoanalytic Family Therapy',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-9',
        modNum: 9,
        title: 'Gehart (Chapter 8)',
        chapter: 'Chapter 8',
        theme: 'Cognitive Behavioural Family Therapy Clinical issues in Family Counselling',
        author: 'Diane R. Gehart'
      },
      {
        id: 'r-cpc512-mod-10',
        modNum: 10,
        title: 'Gehart (Chapter 10)',
        chapter: 'Chapter 10',
        theme: 'Social Constructionist Family Therapy Future Research and Critiques',
        author: 'Diane R. Gehart'
      }
    ];

    canonicalModulesData.forEach(cm => {
      rawReadings.push({
        id: cm.id,
        title: cm.title,
        authorName: cm.author,
        resourceTitle: null,
        mediaTypeRaw: 'textbook',
        mediaType: 'textbook',
        isCompleted: completedModules.has(cm.modNum),
        isDeleted: false,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: '~45 min read',
        dueDate: null,
        dateRangeStr: null,
        chapterText: cm.chapter,
        pagesText: null,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        relevantTopics: cm.theme,
        sourceDocumentName: 'CPC 512 Reading and Assignment Schedule',
        docColorHex: cpc512Course.hexColor || '#EF4444',
        isFavorite: false,
        weekId: undefined,
        weekNumber: undefined,
        moduleNumber: cm.modNum,
        moduleMention: `Module ${cm.modNum}`
      });
    });

    // 2. Canonical Weekly Schedule Readings (Table 2: Weeks 1..12 Calendar Schedule with Module Mappings)
    const weeklyReadingsData = [
      {
        id: 'r-cpc512-week-1-ch1-3',
        weekNum: 1,
        modNum: 1,
        chapter: 'Chapters 1–3',
        title: 'Chapters 1–3',
        theme: 'Creating a caring community, Introduction to Family Systems, Course overview',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Jul 2 – Jul 3'
      },
      {
        id: 'r-cpc512-week-2-ch5',
        weekNum: 2,
        modNum: 2,
        chapter: 'Chapter 5',
        title: 'Chapter 5',
        theme: 'Introduction to Systems Thinking, Introduction to Mapping Tools',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Jul 9 – Jul 10'
      },
      {
        id: 'r-cpc512-week-2-articles',
        weekNum: 2,
        modNum: 2,
        chapter: null,
        title: 'Articles on Canvas',
        theme: 'Introduction to Systems Thinking, Introduction to Mapping Tools',
        author: null,
        media: 'article' as const,
        dateRange: 'Jul 9 – Jul 10'
      },
      {
        id: 'r-cpc512-week-3-ch5-7',
        weekNum: 3,
        modNum: 3,
        chapter: 'Chapters 5 & 7',
        title: 'Chapters 5 & 7',
        theme: 'From Theory to Practice, Structural Family Systems',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Jul 16 – Jul 17'
      },
      {
        id: 'r-cpc512-week-4-ch7',
        weekNum: 4,
        modNum: 4,
        chapter: 'Chapter 7',
        title: 'Chapter 7',
        theme: 'Evidence Based Practice and Empirically Supported Models (TBD)',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Jul 23 – Jul 24'
      },
      {
        id: 'r-cpc512-week-5-ch4-10',
        weekNum: 5,
        modNum: 5,
        chapter: 'Chapters 4–10',
        title: 'Chapters 4–10',
        theme: 'Evidenced-Based Practice & Empirically Supported Models (Presentation Reference)',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Jul 30 – Jul 31'
      },
      {
        id: 'r-cpc512-week-7-ch4-10',
        weekNum: 7,
        modNum: 6,
        chapter: 'Chapters 4–10',
        title: 'Chapters 4–10',
        theme: 'Evidence Based Practice & Empirically Supported Models (Presentations)',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Aug 13 – Aug 14'
      },
      {
        id: 'r-cpc512-week-8-ch4-10',
        weekNum: 8,
        modNum: 7,
        chapter: 'Chapters 4–10',
        title: 'Chapters 4–10',
        theme: 'Evidence Based Practice & Empirically Supported Models (Presentations)',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Aug 20 – Aug 21'
      },
      {
        id: 'r-cpc512-week-9-ch11',
        weekNum: 9,
        modNum: 8,
        chapter: 'Chapter 11',
        title: 'Chapter 11',
        theme: 'Case Conceptualization (Core Theoretical Principles)',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Aug 27 – Aug 28'
      },
      {
        id: 'r-cpc512-week-10-ch11',
        weekNum: 10,
        modNum: 9,
        chapter: 'Chapter 11',
        title: 'Chapter 11',
        theme: 'Case Conceptualization (Clinical Application & In-Class Evaluation)',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Sep 3 – Sep 4'
      },
      {
        id: 'r-cpc512-week-10-review',
        weekNum: 10,
        modNum: 9,
        chapter: null,
        title: 'Review Sample Comprehensive Exam Cases in Van General Course Shell',
        theme: 'Case Conceptualization',
        author: null,
        media: 'article' as const,
        dateRange: 'Sep 3 – Sep 4'
      },
      {
        id: 'r-cpc512-week-11-ch8',
        weekNum: 11,
        modNum: 10,
        chapter: 'Chapter 8',
        title: 'Chapter 8',
        theme: 'Feedback Case Conceptualizations, Addressing Clinical Issues, Counselling Practice',
        author: 'Diane R. Gehart',
        media: 'textbook' as const,
        dateRange: 'Sep 10 – Sep 11'
      }
    ];

    weeklyReadingsData.forEach(wr => {
      rawReadings.push({
        id: wr.id,
        title: wr.title,
        authorName: wr.author,
        resourceTitle: null,
        mediaTypeRaw: wr.media,
        mediaType: wr.media,
        isCompleted: completedWeeks.has(wr.weekNum),
        isDeleted: false,
        summaryText: '',
        keyTakeawaysText: '',
        estimatedTimeText: wr.media === 'article' ? '~20 min read' : '~45 min read',
        dueDate: null,
        dateRangeStr: wr.dateRange,
        chapterText: wr.chapter,
        pagesText: null,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        relevantTopics: wr.theme,
        sourceDocumentName: 'CPC 512 Reading and Assignment Schedule',
        docColorHex: cpc512Course.hexColor || '#EF4444',
        isFavorite: false,
        weekId: `w-${wr.weekNum}`,
        weekNumber: wr.weekNum,
        moduleNumber: wr.modNum || null,
        moduleMention: wr.modNum ? `Module ${wr.modNum}` : null
      });
    });

    // 3. Ensure canonical CPC 512 assignments exist with full rubrics and scheduled presentation weeks
    rawAssignments = rawAssignments.filter(a =>
      a.courseId ? a.courseId !== cpc512Course.id : (a.courseCode || '').replace(/\s+/g, '').toUpperCase() !== 'CPC512'
    );

    const cpcCanonicalAssignments: Assignment[] = [
      sanitizeAssignment({
        id: 'a-cpc512-family-mapping',
        title: 'Family Mapping Papers',
        weekNumber: 5,
        dueDate: parseSafeDate('2026-07-30'),
        pointsPossible: null,
        weightPercentage: '30%',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        fullInstructions: 'Understanding the influence of one’s family of origin is a critical professional competency for developing therapists.\n\nFor the first part of this assignment, students who are able will create a family genogram of three to four generations, including some or all of the following information: 1) dates of birth; 2) genders; 3) ethnicity; 4) education; 5) occupations; 6) marriages; 7) divorces; 8) births; 9) deaths; 10) medical issues; 11) psychological struggles; and 12) significant losses/accomplishments.\n\nAs family of origin history can sometimes present challenges for students in completing this assignment, students have the option of employing an alternative mapping tool such as an ecomap or structural map. Alternatively, students may use a fictitious family in the genogram for this assignment.\n\nFor the second part of this assignment, students will write a paper reflecting on significant interactional patterns between and among family members on their map. Students’ insights will be supported with scholarly citations and the use of course concepts. Students will discuss specific ways in which the identified patterns or family of origin dynamics, including power dynamics, may influence their therapeutic style. Opportunities for personal growth and transformation should be clearly articulated and explored.\n\nThis paper should be 6 to 8 pages, double-spaced, using a minimum of five to eight peer-reviewed sources from the past 5 years. APA formatting and citations are mandatory as we are seeking to develop your scholarly writing skills through this process.',
        rubricCriteria: [
          { criterionName: 'Genogram/Alternative Map', points: 10, percentage: 10 },
          { criterionName: 'Evidence and Support (Scholarly Sources)', points: 20, percentage: 20 },
          { criterionName: 'Analysis and use of Course Concepts', points: 20, percentage: 20 },
          { criterionName: 'Professional Ethics', points: 20, percentage: 20 },
          { criterionName: 'Cultural Competence', points: 20, percentage: 20 },
          { criterionName: 'Self-Awareness', points: 10, percentage: 10 }
        ]
      }),
      sanitizeAssignment({
        id: 'a-cpc512-presentation',
        title: 'Assessment and Intervention Presentation/Project',
        weekNumber: 5,
        scheduledWeeks: [5, 7, 8],
        dueDate: parseSafeDate('2026-07-30'),
        pointsPossible: null,
        weightPercentage: '20%',
        subTypeRaw: 'presentation',
        noteText: 'Group Presentations: Weeks 5, 7, 8',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        fullInstructions: 'Working in small groups, students will present a practical intervention from one theoretical perspective used for assessment and treatment in family therapy. The presentation will introduce central themes and concepts related to the theory chosen. Each group will also present a video or in-class role-play demonstrating the application of the theory in the form of a simulated family therapy intervention. Students will facilitate a class discussion to critically examine the therapeutic perspectives explored.\n\nStudents will share their experience of planning and executing the counselling session, discuss challenges, and offer critiques related to the process and theoretical approach. Peers will then have an opportunity to offer feedback, practice the intervention they observed, or another intervention based on this theoretical approach.\n\nStudents will have class time to prepare for their role play/presentation.',
        rubricCriteria: [
          { criterionName: 'Organization and Coherence', points: 10, percentage: 10 },
          { criterionName: 'Diversity & Collaboration', points: 20, percentage: 20 },
          { criterionName: 'Analysis and use of Course Concepts', points: 20, percentage: 20 },
          { criterionName: 'Professional Ethics', points: 20, percentage: 20 },
          { criterionName: 'Cultural Competence', points: 20, percentage: 20 },
          { criterionName: 'Oral Presentation', points: 10, percentage: 10 }
        ]
      }),
      sanitizeAssignment({
        id: 'a-cpc512-peer-review',
        title: 'Peer Review Group Report',
        weekNumber: 11,
        dueDate: parseSafeDate('2026-09-10'),
        pointsPossible: null,
        weightPercentage: '10%',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        fullInstructions: 'Peer review is a core academic activity in which colleagues support one another’s professional development by offering feedback on each other’s scholarly work. Working in small groups, students will provide classmates with feedback on their in-class interventions presentation addressing the following questions:\n1) What did we appreciate about one another’s work?\n2) What did we find challenging about one another’s work?\n3) What recommendations do we have to strengthen this work in the future?\n4) How will this feedback inform our future work with families?',
        rubricCriteria: [
          { criterionName: 'Organization and Coherence', points: 10, percentage: 10 },
          { criterionName: 'Evidence and Support', points: 20, percentage: 20 },
          { criterionName: 'Analysis and use of Course Concepts', points: 20, percentage: 20 },
          { criterionName: 'Evaluating Information', points: 20, percentage: 20 },
          { criterionName: 'Self-Reflection', points: 20, percentage: 20 },
          { criterionName: 'Participation', points: 10, percentage: 10 }
        ]
      }),
      sanitizeAssignment({
        id: 'a-cpc512-case-conceptualization',
        title: 'In-Class Case Conceptualization',
        weekNumber: 10,
        dueDate: parseSafeDate('2026-09-03'),
        pointsPossible: null,
        weightPercentage: '20%',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        fullInstructions: 'Students will complete an in-class case conceptualization worth 20% of their final mark based on framing questions. Review sample comprehensive exam cases in Van General Course Shell.',
        rubricCriteria: [
          { criterionName: 'Case Analysis and Theoretical Approach', points: 20, percentage: 20 },
          { criterionName: 'Evidence and Support', points: 20, percentage: 20 },
          { criterionName: 'Analysis and use of Course Concepts', points: 20, percentage: 20 },
          { criterionName: 'Professional Ethics', points: 20, percentage: 20 },
          { criterionName: 'Cultural Competence', points: 20, percentage: 20 }
        ]
      }),
      sanitizeAssignment({
        id: 'a-cpc512-collaboration',
        title: 'Collaboration',
        weekNumber: 0,
        dueDate: null,
        pointsPossible: null,
        weightPercentage: '20%',
        noteText: 'Over the course of the semester',
        isCompleted: false,
        isDeleted: false,
        isFavorite: false,
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        fullInstructions: 'Students may earn marks for collaboration throughout the course. The in-person class portion of this course depends heavily on practical in-person activities and discussion designed to foster skill-based competencies necessary for clinical work in a counselling setting.',
        rubricCriteria: [
          { criterionName: 'Communication', points: 30, percentage: 30 },
          { criterionName: 'Self Reflection & Compassion', points: 30, percentage: 30 },
          { criterionName: 'Self-Awareness & Self-Regulation', points: 40, percentage: 40 }
        ]
      })
    ];

    cpcCanonicalAssignments.forEach(a => rawAssignments.push(a));

    const weekSchedule = [
      { weekNum: 1, theme: 'Creating a caring community, Introduction to Family Systems, Course overview', dateRange: 'Jul 2 – Jul 3', modNum: 1 },
      { weekNum: 2, theme: 'Introduction to Systems Thinking, Introduction to Mapping Tools', dateRange: 'Jul 9 – Jul 10', modNum: 2 },
      { weekNum: 3, theme: 'From Theory to Practice, Structural Family Systems', dateRange: 'Jul 16 – Jul 17', modNum: 3 },
      { weekNum: 4, theme: 'Evidence Based Practice and Empirically Supported Models (TBD)', dateRange: 'Jul 23 – Jul 24', modNum: 4 },
      { weekNum: 5, theme: 'Evidenced-Based Practice and Empirically Supported Models', dateRange: 'Jul 30 – Jul 31', modNum: 5 },
      { weekNum: 6, theme: 'Reading Week – No Class', dateRange: 'Aug 6 – Aug 7', modNum: null },
      { weekNum: 7, theme: 'Evidence Based Practice and Empirically Supported Models', dateRange: 'Aug 13 – Aug 14', modNum: 6 },
      { weekNum: 8, theme: 'Evidence Based Practice and Empirically Supported Models', dateRange: 'Aug 20 – Aug 21', modNum: 7 },
      { weekNum: 9, theme: 'Case Conceptualization', dateRange: 'Aug 27 – Aug 28', modNum: 8 },
      { weekNum: 10, theme: 'Case Conceptualization', dateRange: 'Sep 3 – Sep 4', modNum: 9 },
      { weekNum: 11, theme: 'Feedback Case Conceptualizations, Addressing Clinical Issues, Counselling Practice', dateRange: 'Sep 10 – Sep 11', modNum: 10 },
      { weekNum: 12, theme: 'Flex Week', dateRange: 'Sep 17 – Sep 18', modNum: null }
    ];

    cpc512Course.termWeeks = 12;
    cpc512Course.weeks = weekSchedule.map(ws => ({
      id: `w-${ws.weekNum}`,
      weekNumber: ws.weekNum,
      theme: ws.theme,
      dateRangeStr: ws.dateRange,
      moduleNumber: ws.modNum,
      moduleMention: ws.modNum ? `Module ${ws.modNum}` : null,
      courseId: cpc512Course.id,
      readings: rawReadings.filter(r => r.weekNumber === ws.weekNum)
    }));

    // Ensure VaultDocument exists for CPC 512 in vaultDocs
    const cpc512DocIndex = cleanVaultDocs.findIndex(vd =>
      vd.id === `vd-${cpc512Course.id}-syllabus` ||
      (vd.courseCode && vd.courseCode.replace(/\s+/g, '').toUpperCase() === 'CPC512') ||
      (vd as any).courseId === cpc512Course.id ||
      (vd.title && vd.title.toLowerCase().includes('cpc 512')) ||
      (vd.title && vd.title.toLowerCase().includes('cpc512'))
    );

    const initialPdfUri512 = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}syllabi/CPC512_Syllabus.pdf` : null;

    if (cpc512DocIndex >= 0) {
      cleanVaultDocs[cpc512DocIndex] = {
        ...cleanVaultDocs[cpc512DocIndex],
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        title: 'CPC 512 Syllabus',
        rawFileDataUri: cleanVaultDocs[cpc512DocIndex].rawFileDataUri || initialPdfUri512
      };
    } else {
      cleanVaultDocs.push({
        id: `vd-${cpc512Course.id}-syllabus`,
        title: 'CPC 512 Syllabus',
        category: 'Syllabi',
        fileSize: '340 KB',
        fileType: 'PDF',
        courseCode: 'CPC 512',
        courseId: cpc512Course.id,
        fileContent: cpc512Course.courseDescription,
        docColorHex: cpc512Course.hexColor || '#EF4444',
        rawFileDataUri: initialPdfUri512,
        pageImages: null,
        uploadedAt: new Date()
      });
    }
  }

  // 4. NEUR 740 Canonical Schedule & Multi-Reading Healing
  const neur740Course = cleanCourses.find(c =>
    (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'NEUR740' ||
    (c.courseName || '').toLowerCase().includes('neuropsych')
  );

  if (neur740Course) {
    const neurReadings = rawReadings.filter(r =>
      r.courseId ? r.courseId === neur740Course.id : (r.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'NEUR740'
    );
    const neurNeedsHealing =
      neurReadings.length !== 20 ||
      neurReadings.some(r => (r.authorName || '').includes(';') || (r.title || '').includes(';')) ||
      neurReadings.some(r => r.moduleNumber && r.moduleNumber > 0 && (!r.weekNumber || r.weekNumber === 0));

    if (neurNeedsHealing) {
      const completedIds = new Set(neurReadings.filter(r => r.isCompleted).map(r => r.id));

      rawReadings = rawReadings.filter(r =>
        r.courseId ? r.courseId !== neur740Course.id : (r.courseCode || '').replace(/\s+/g, '').toUpperCase() !== 'NEUR740'
      );

      const neurCanonical = [
        // Week 1 / Module 1
        { id: 'r-neur-w1-lezak', w: 1, m: 1, title: 'Lezak et al. (Ch. 1–3)', author: 'Lezak et al.', ch: 'Chapters 1–3', media: 'textbook' as const, date: 'Sep 10', topic: 'Neuroanatomy, Functional Localization & Interviewing' },
        { id: 'r-neur-w1-luria', w: 1, m: 1, title: 'Luria (Ch. 2)', author: 'Luria', ch: 'Chapter 2', media: 'textbook' as const, date: 'Sep 10', topic: 'Neuroanatomy, Functional Localization & Interviewing' },
        // Week 2 / Module 2
        { id: 'r-neur-w2-groth', w: 2, m: 2, title: 'Groth-Marnat (Ch. 4 & 5)', author: 'Groth-Marnat', ch: 'Chapters 4 & 5', media: 'textbook' as const, date: 'Sep 17', topic: 'Intellectual Assessment & Working Memory (WAIS-IV)' },
        { id: 'r-neur-w2-lichten', w: 2, m: 2, title: 'Lichtenberger (Ch. 2)', author: 'Lichtenberger', ch: 'Chapter 2', media: 'textbook' as const, date: 'Sep 17', topic: 'Intellectual Assessment & Working Memory (WAIS-IV)' },
        // Week 3 / Module 3
        { id: 'r-neur-w3-lezak', w: 3, m: 3, title: 'Lezak et al. (Ch. 11 & 12)', author: 'Lezak et al.', ch: 'Chapters 11 & 12', media: 'textbook' as const, date: 'Sep 24', topic: 'Memory Systems, Amnesias & WMS-IV Interpretation' },
        { id: 'r-neur-w3-squire', w: 3, m: 3, title: 'Squire (Ch. 3)', author: 'Squire', ch: 'Chapter 3', media: 'textbook' as const, date: 'Sep 24', topic: 'Memory Systems, Amnesias & WMS-IV Interpretation' },
        // Week 4 / Module 4
        { id: 'r-neur-w4-delis', w: 4, m: 4, title: 'Delis et al. (Ch. 1–4)', author: 'Delis et al.', ch: 'Chapters 1–4', media: 'textbook' as const, date: 'Oct 1', topic: 'Executive Functioning, Inhibition & D-KEFS Profiling' },
        { id: 'r-neur-w4-stuss', w: 4, m: 4, title: 'Stuss & Benson (Ch. 6)', author: 'Stuss & Benson', ch: 'Chapter 6', media: 'textbook' as const, date: 'Oct 1', topic: 'Executive Functioning, Inhibition & D-KEFS Profiling' },
        // Week 5 / Module 5
        { id: 'r-neur-w5-slick', w: 5, m: 5, title: 'Slick et al. (Ch. 2)', author: 'Slick et al.', ch: 'Chapter 2', media: 'textbook' as const, date: 'Oct 8', topic: 'Performance Validity Testing (PVT) & Malingering' },
        { id: 'r-neur-w5-boone', w: 5, m: 5, title: 'Boone (Ch. 4 & 7)', author: 'Boone', ch: 'Chapters 4 & 7', media: 'textbook' as const, date: 'Oct 8', topic: 'Performance Validity Testing (PVT) & Malingering' },
        // Week 6 / Module 6
        { id: 'r-neur-w6-silver', w: 6, m: 6, title: 'Silver et al. (Ch. 8 & 9)', author: 'Silver et al.', ch: 'Chapters 8 & 9', media: 'textbook' as const, date: 'Oct 15', topic: 'Traumatic Brain Injury & Post-Concussive Syndrome' },
        { id: 'r-neur-w6-mccrea', w: 6, m: 6, title: 'McCrea (Ch. 3)', author: 'McCrea', ch: 'Chapter 3', media: 'textbook' as const, date: 'Oct 15', topic: 'Traumatic Brain Injury & Post-Concussive Syndrome' },
        // Week 7 / Module 7
        { id: 'r-neur-w7-cummings', w: 7, m: 7, title: 'Cummings & Mega (Ch. 5–7)', author: 'Cummings & Mega', ch: 'Chapters 5–7', media: 'textbook' as const, date: 'Oct 22', topic: 'Dementia Differentials (AD, FTD, Lewy Body, Vascular)' },
        { id: 'r-neur-w7-petersen', w: 7, m: 7, title: 'Petersen (Ch. 4)', author: 'Petersen', ch: 'Chapter 4', media: 'textbook' as const, date: 'Oct 22', topic: 'Dementia Differentials (AD, FTD, Lewy Body, Vascular)' },
        // Week 8 / Module 8
        { id: 'r-neur-w8-manual', w: 8, m: 8, title: 'Lab Testing Manual & Scoring Protocols', author: null, ch: null, media: 'article' as const, date: 'Oct 29', topic: 'Standardized Administration Lab Exam (Cohort A/B)' },
        // Week 9 / Module 9
        { id: 'r-neur-w9-sohlberg', w: 9, m: 9, title: 'Sohlberg & Mateer (Ch. 1–4)', author: 'Sohlberg & Mateer', ch: 'Chapters 1–4', media: 'textbook' as const, date: 'Nov 5', topic: 'Cognitive Rehabilitation: Restorative vs Compensatory' },
        { id: 'r-neur-w9-wilson', w: 9, m: 9, title: 'Wilson (Ch. 3)', author: 'Wilson', ch: 'Chapter 3', media: 'textbook' as const, date: 'Nov 5', topic: 'Cognitive Rehabilitation: Restorative vs Compensatory' },
        // Week 10 / Module 10
        { id: 'r-neur-w10-sohlberg', w: 10, m: 10, title: 'Sohlberg & Mateer (Ch. 7 & 8)', author: 'Sohlberg & Mateer', ch: 'Chapters 7 & 8', media: 'textbook' as const, date: 'Nov 12', topic: 'Assistive Technology & Environmental Restructuring' },
        { id: 'r-neur-w10-cicerone', w: 10, m: 10, title: 'Cicerone et al. (2019)', author: 'Cicerone et al.', ch: null, media: 'paper' as const, date: 'Nov 12', topic: 'Assistive Technology & Environmental Restructuring' },
        // Week 11 / Module 11
        { id: 'r-neur-w11-apa', w: 11, m: 11, title: 'APA Division 40 Ethics Guidelines', author: null, ch: null, media: 'article' as const, date: 'Nov 19', topic: 'Grand Rounds Presentations & Ethics' }
      ];

      neurCanonical.forEach(nr => {
        rawReadings.push({
          id: nr.id,
          title: nr.title,
          authorName: nr.author,
          resourceTitle: nr.title,
          mediaTypeRaw: nr.media,
          mediaType: nr.media,
          isCompleted: completedIds.has(nr.id),
          isDeleted: false,
          summaryText: '',
          keyTakeawaysText: '',
          estimatedTimeText: nr.media === 'paper' || nr.media === 'article' ? '~30 min read' : '~45 min read',
          dueDate: null,
          dateRangeStr: nr.date,
          chapterText: nr.ch,
          pagesText: null,
          courseCode: 'NEUR 740',
          courseId: neur740Course.id,
          relevantTopics: nr.topic,
          sourceDocumentName: 'NEUR 740 Neuropsych Assessment Syllabus',
          docColorHex: neur740Course.hexColor || '#EF4444',
          isFavorite: false,
          weekId: `w-${nr.w}`,
          weekNumber: nr.w,
          moduleNumber: nr.m,
          moduleMention: `Module ${nr.m}`
        });
      });

      // Update NEUR 740 weeks definition
      neur740Course.termWeeks = 12;
      neur740Course.weeks = Array.from({ length: 12 }, (_, idx) => {
        const wNum = idx + 1;
        const matchReading = neurCanonical.find(nr => nr.w === wNum);
        return {
          id: `w-${wNum}`,
          weekNumber: wNum,
          theme: matchReading ? matchReading.topic : (wNum === 12 ? 'Flex Week' : `Week ${wNum}`),
          dateRangeStr: matchReading ? matchReading.date : null,
          moduleNumber: matchReading ? matchReading.m : null,
          moduleMention: matchReading ? `Module ${matchReading.m}` : null,
          courseId: neur740Course.id,
          readings: rawReadings.filter(r => r.weekNumber === wNum)
        };
      });
    }
  }

  // 5. General Semicolon Reading Splitter for Any Course
  const splitReadings: Reading[] = [];
  for (const r of rawReadings) {
    if ((r.title || '').includes(';')) {
      const parts = r.title.split(';').map(p => p.trim()).filter(p => p.length >= 3);
      if (parts.length > 1) {
        parts.forEach((part, idx) => {
          const authMatch = part.match(/^([A-Z][a-zA-Z\s.&–-]+?)\s*\(\s*(?:ch(?:apter)?s?\.?|chs?\.?|ch\b|pp?\.?|\d)/i);
          const author = authMatch ? authMatch[1].trim() : (idx === 0 ? r.authorName : undefined);
          const chMatch = part.match(/\((?:ch(?:apter)?s?\.?|chs?\.?|ch\b\.?)\s*([\d\s&,\-–—]+)\)/i) ||
                          part.match(/\b(?:ch(?:apter)?s?\.?|chs?\.?|ch\b\.?)\s*([\d\s&,\-–—]+)/i);
          const ch = chMatch ? `Chapter ${chMatch[1].trim()}` : undefined;

          splitReadings.push({
            ...r,
            id: `${r.id}-split-${idx}`,
            title: part,
            authorName: author,
            chapterText: ch || (idx === 0 ? r.chapterText : undefined),
            resourceTitle: part
          });
        });
        continue;
      }
    }
    splitReadings.push(r);
  }
  rawReadings = splitReadings;

  return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments, vaultDocs: cleanVaultDocs };
}

export function healCanonicalCPC527(
  courses: Course[],
  readings: Reading[],
  assignments: Assignment[],
  vaultDocs: VaultDocument[] = []
): { courses: Course[]; readings: Reading[]; assignments: Assignment[]; vaultDocs: VaultDocument[] } {
  const cleanCourses = [...courses];
  let rawReadings = [...readings];
  let rawAssignments = [...assignments];
  const cleanVaultDocs = [...vaultDocs];

  const cpc527Course = cleanCourses.find(c =>
    (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC527' ||
    (c.courseName || '').toLowerCase().includes('group counselling') ||
    c.id === 'c-1789827902676'
  );
  if (!cpc527Course) {
    return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments, vaultDocs: cleanVaultDocs };
  }

  // Normalize course identity
  cpc527Course.courseCode = 'CPC 527';
  if (/cpc\s*527.*simple\s*syllabus/i.test(cpc527Course.courseName) || !cpc527Course.courseName) {
    cpc527Course.courseName = 'Group Counselling Psychology';
  }

  const isCpc527Reading = (r: Reading) => {
    const code = (r.courseCode || '').replace(/\s+/g, '').toUpperCase();
    return (r.courseId && r.courseId === cpc527Course.id) || code === 'CPC527';
  };
  const isCpc527Assignment = (a: Assignment) => {
    const code = (a.courseCode || '').replace(/\s+/g, '').toUpperCase();
    return (a.courseId && a.courseId === cpc527Course.id) || code === 'CPC527';
  };

  const existingReadings = rawReadings.filter(isCpc527Reading);
  const existingAssignments = rawAssignments.filter(isCpc527Assignment);

  // If the course has fewer than 8 readings or fewer than 3 assignments, heal from canonical syllabus text
  const needsHealing = existingReadings.length < 8 || existingAssignments.length < 3;

  if (needsHealing) {
    const localDto = LocalSyllabusParser.shared.parseText(cityuSyllabi.cpc527);
    const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, cityuSyllabi.cpc527);

    const cleanReadingsList = SyllabusImportManager.shared.deduplicateReadings(
      normalized.candidateReadings,
      normalized.textbooks,
      normalized.termYear
    );
    const cleanAssignmentsList = SyllabusImportManager.shared.deduplicateAssignments(
      normalized.candidateAssignments,
      normalized.termYear,
      normalized.weekDateMap
    );

    // Remove incomplete items
    rawReadings = rawReadings.filter(r => !isCpc527Reading(r));
    rawAssignments = rawAssignments.filter(a => !isCpc527Assignment(a));

    const hexColor = cpc527Course.hexColor || '#059669';

    const newReadings: Reading[] = cleanReadingsList.map((r, rIdx) => {
      const weekNum = r.weekNumber || 0;
      const matchedWeek = (normalized.weeks as any[])?.find((dw: any) => dw.weekNumber === weekNum);
      const resolvedDueDate = r.dueDate
        ? parseSafeDate(r.dueDate)
        : matchedWeek?.startDate
        ? parseSafeDate(matchedWeek.startDate)
        : null;

      return {
        ...r,
        id: `r-cpc527-${rIdx}`,
        courseCode: 'CPC 527',
        sourceDocumentName: 'CPC527_Group_Counselling_Syllabus.pdf',
        docColorHex: hexColor,
        courseId: cpc527Course.id,
        dueDate: resolvedDueDate,
        dateRangeStr: r.dateRangeStr || matchedWeek?.dateRangeStr || null,
        relevantTopics: r.relevantTopics || (matchedWeek?.theme ? matchedWeek.theme : (weekNum > 0 ? `Week ${weekNum}` : null))
      };
    });

    const newAssignments: Assignment[] = cleanAssignmentsList.map((a, aIdx) => {
      const resolvedWeek = a.weekNumber || 0;
      return sanitizeAssignment({
        ...a,
        id: `a-cpc527-${aIdx}`,
        courseCode: 'CPC 527',
        sourceDocumentName: 'CPC527_Group_Counselling_Syllabus.pdf',
        docColorHex: hexColor,
        courseId: cpc527Course.id,
        moduleMention: a.moduleMention || (resolvedWeek > 0 ? `Week ${resolvedWeek}` : undefined),
        relevantTopics: a.relevantTopics || (resolvedWeek > 0 ? `Week ${resolvedWeek}` : undefined)
      });
    });

    rawReadings.push(...newReadings);
    rawAssignments.push(...newAssignments);

    const maxWeek = Math.max(...newReadings.map(r => r.weekNumber || 1), 12);
    const courseWeeks: Week[] = [];
    for (let w = 1; w <= maxWeek; w++) {
      const weekReadings = newReadings.filter(r => (r.weekNumber || 0) === w);
      const foundWeek = (normalized.weeks as any[])?.find((dw: any) => dw.weekNumber === w);
      courseWeeks.push({
        id: `w-cpc527-${w}`,
        weekNumber: w,
        theme: foundWeek?.theme || `Week ${w}`,
        startDate: foundWeek?.startDate ? parseSafeDate(foundWeek.startDate) : null,
        dateRangeStr: foundWeek?.dateRangeStr || null,
        courseId: cpc527Course.id,
        readings: weekReadings
      });
    }
    cpc527Course.weeks = courseWeeks;
    cpc527Course.assignments = newAssignments;
    cpc527Course.termWeeks = maxWeek;
  }

  // Ensure VaultDocument exists for CPC 527 in vaultDocs
  const docIndex = cleanVaultDocs.findIndex(vd =>
    vd.id === `vd-${cpc527Course.id}-syllabus` ||
    (vd.courseCode && vd.courseCode.replace(/\s+/g, '').toUpperCase() === 'CPC527') ||
    (vd as any).courseId === cpc527Course.id
  );
  const initialPdfUri527 = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}syllabi/CPC527_Group_Counselling_Syllabus.pdf` : null;
  if (docIndex >= 0) {
    cleanVaultDocs[docIndex] = {
      ...cleanVaultDocs[docIndex],
      rawFileDataUri: cleanVaultDocs[docIndex].rawFileDataUri || initialPdfUri527
    };
  } else {
    cleanVaultDocs.push({
      id: `vd-${cpc527Course.id}-syllabus`,
      title: 'CPC 527 Syllabus',
      category: 'Syllabi',
      fileSize: '480 KB',
      fileType: 'PDF',
      courseCode: 'CPC 527',
      courseId: cpc527Course.id,
      fileContent: cpc527Course.courseDescription,
      docColorHex: cpc527Course.hexColor || '#059669',
      rawFileDataUri: initialPdfUri527,
      pageImages: null,
      uploadedAt: new Date()
    });
  }

  return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments, vaultDocs: cleanVaultDocs };
}

export function healCanonicalCPC514(
  courses: Course[],
  readings: Reading[],
  assignments: Assignment[],
  vaultDocs: VaultDocument[] = []
): { courses: Course[]; readings: Reading[]; assignments: Assignment[]; vaultDocs: VaultDocument[] } {
  const cleanCourses = [...courses];
  let rawReadings = [...readings];
  let rawAssignments = [...assignments];
  const cleanVaultDocs = [...vaultDocs];

  let cpc514Course = cleanCourses.find(c =>
    (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC514' ||
    (c.courseName || '').toLowerCase().includes('research methods')
  );

  const cpc514CatalogItem = BundledSyllabiCatalog.find(b => b.id === 'cpc-514');

  if (!cpc514Course && cpc514CatalogItem) {
    const parsed: any = LocalSyllabusParser.shared.parseText(cpc514CatalogItem.rawText);
    const seededCourseId = 'c-cpc-514-canonical';
    cpc514Course = {
      id: seededCourseId,
      creatorId: 'user-self',
      courseName: parsed.courseName || 'Research Methods and Statistics',
      courseCode: 'CPC 514',
      courseDescription: `Imported from CPC514_Syllabus.pdf. Faculty: Dr. Alireza Sedghi Taromi, PhD`,
      instructorName: 'Dr. Alireza Sedghi Taromi, PhD',
      instructorEmail: 'sedghitaromialireza@cityu.edu',
      hexColor: '#2563EB',
      termWeeks: 5,
      sharingCode: 'CPC514',
      isDeleted: false,
      isFavorite: true,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: []
    };
    cleanCourses.push(cpc514Course);
  }

  if (!cpc514Course) {
    return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments, vaultDocs: cleanVaultDocs };
  }

  cpc514Course.courseCode = 'CPC 514';
  if (!cpc514Course.courseName || /cpc\s*514.*syllabus/i.test(cpc514Course.courseName)) {
    cpc514Course.courseName = 'Research Methods and Statistics';
  }
  cpc514Course.instructorName = cpc514Course.instructorName || 'Dr. Alireza Sedghi Taromi, PhD';
  cpc514Course.instructorEmail = cpc514Course.instructorEmail || 'sedghitaromialireza@cityu.edu';
  cpc514Course.gradingScale = 'City University of Seattle Decimal Grading System';
  cpc514Course.gradingScaleRows = [
    { gradeRange: '100.00 – 92.00', decimalGpa: '4.0 – 3.7', performanceStandard: 'Exceeds Standard' },
    { gradeRange: '91.99 – 85.00', decimalGpa: '3.6 – 3.0', performanceStandard: 'At Standard' },
    { gradeRange: '84.99 – 75.00', decimalGpa: '2.9 – 2.0', performanceStandard: 'Approaching Standard' },
    { gradeRange: '74.99 – 0.00', decimalGpa: '1.9 – 0.0', performanceStandard: 'Below Standard' }
  ];

  const isCpc514Reading = (r: Reading) => {
    const code = (r.courseCode || '').replace(/\s+/g, '').toUpperCase();
    return (r.courseId && r.courseId === cpc514Course!.id) || code === 'CPC514';
  };
  const isCpc514Assignment = (a: Assignment) => {
    const code = (a.courseCode || '').replace(/\s+/g, '').toUpperCase();
    return (a.courseId && a.courseId === cpc514Course!.id) || code === 'CPC514';
  };

  const existingReadings = rawReadings.filter(isCpc514Reading);
  const existingAssignments = rawAssignments.filter(isCpc514Assignment);

  const a1 = existingAssignments.find(a => (a.title || '').toLowerCase().includes('research article analysis') || a.assignmentNumber === 1);
  const a2 = existingAssignments.find(a => (a.title || '').toLowerCase().includes('peer review discussion board') || a.assignmentNumber === 2);
  const a3 = existingAssignments.find(a => (a.title || '').toLowerCase().includes('peer review group report') || (a.title || '').toLowerCase().includes('peer-review group report') || a.assignmentNumber === 3);
  const a4 = existingAssignments.find(a => (a.title || '').toLowerCase().includes('research study design') || a.assignmentNumber === 4);
  const a5 = existingAssignments.find(a => (a.title || '').toLowerCase().includes('attendance') || a.assignmentNumber === 5);

  const hasCorruptedInstructions =
    !a4?.fullInstructions?.includes('In consultation with their instructor') ||
    Boolean(a1?.fullInstructions?.startsWith('1)')) ||
    Boolean(a2?.fullInstructions?.startsWith('2)')) ||
    Boolean(a3?.fullInstructions?.includes('(assignment 3)')) ||
    Boolean(a4?.fullInstructions?.includes('(assignment 4)')) ||
    Boolean(a5?.fullInstructions?.includes('(assignment 5)'));

  const hasExactWeightsAndContent = existingAssignments.length === 5 &&
    !hasCorruptedInstructions &&
    a1?.weightPercentage === '20%' && (a1?.fullInstructions?.length || 0) > 100 &&
    a2?.weightPercentage === '20%' && (a2?.fullInstructions?.length || 0) > 100 &&
    a3?.weightPercentage === '10%' && (a3?.fullInstructions?.length || 0) > 100 &&
    a4?.weightPercentage === '40%' && (a4?.fullInstructions?.length || 0) > 100 &&
    a5?.weightPercentage === '10%' && (a5?.fullInstructions?.length || 0) > 100;

  const hasAllSevenReadings = existingReadings.length >= 7 &&
    existingReadings.some(r => (r.title || '').includes('Chapter 1')) &&
    existingReadings.some(r => (r.title || '').includes('Chapter 10'));

  if (!hasExactWeightsAndContent || !hasAllSevenReadings) {
    const rawText = cpc514CatalogItem?.rawText || '';
    const parsed: any = LocalSyllabusParser.shared.parseText(rawText);
    const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(parsed, rawText);

    const cleanReadingsList = SyllabusImportManager.shared.deduplicateReadings(
      normalized.candidateReadings,
      normalized.textbooks,
      normalized.termYear
    );
    const cleanAssignmentsList = SyllabusImportManager.shared.deduplicateAssignments(
      normalized.candidateAssignments,
      normalized.termYear,
      normalized.weekDateMap
    );

    const canonicalAssignmentsData = [
      {
        num: 1,
        label: 'Assignment 1',
        title: 'Research Article Analysis-Group Presentation',
        weight: '20%',
        points: '100 Points',
        dueDate: new Date(2026, 6, 8, 23, 59, 0),
        note: 'Presentations: Weeks 4–8 · Deadline: July 8',
        subType: 'presentation',
        fullInstructions: `In small groups (assigned randomly by the system), students will collaborate on a 45–60-minute presentation analyzing an instructor-approved article.

• Deadlines & Scheduling: Presentation topics and preferred presentation dates must be submitted to the instructor by email for approval on a first-come, first-served basis. The deadline to submit your article and preferred presentation day is before the second session Wednesday, July 8, 11:59 PM. Beginning in Week 4 and continuing through Week 8, each group will present live in each class according to the order in which requests are received (first day of presentations is July 23). The email must include all group members’ emails, names, the group number (and presenting order), the PDF of selected article, and the preferred presentation date.

• Analysis Scope: Each group will review and critically analyze a peer-reviewed research article that may report on either a quantitative or qualitative study. Using methodology-specific criteria, students will examine and discuss: 1) the research question and hypothesis; 2) the study design; 3) data analysis; 4) conclusions; 5) clinical applications; and 6) ethics issues. Address key questions: Is the design appropriate? Are population and sampling techniques appropriate? Were issues of reliability and validity addressed? Are conclusions robustly supported by data? What alternative interpretations can be drawn?

• Modalities: Students are encouraged to explore a range of presentation modalities including PowerPoint slides, spoken word poetry, dramatic skits, animation, monologues, videos, storytelling, music, dance, improv, collage, scrapbooking, storyboarding, sculpture, quilting, papier-mâché, mandalas, painting, drawing, puppetry, etc. Group members will meet online to plan scenarios, characters, script, etc.

• Submission Requirements: After presenting, each group is required to upload its slides in PPT format to ensure visibility of presenter notes (a brief summary of what you intend to say for each specific slide) to the discussion forum for other groups to review by midnight on the day of their presentations, and also submit the same file in the assignment submission area for the instructor to grade.`,
        rubric: [
          { criterionName: 'Organization and Coherence', points: 10 },
          { criterionName: 'Evidence and Support', points: 20 },
          { criterionName: 'Critical Analysis', points: 20 },
          { criterionName: 'Professional Ethics', points: 20 },
          { criterionName: 'Cultural Competence', points: 20 },
          { criterionName: 'Quality of Presentation', points: 10 }
        ]
      },
      {
        num: 2,
        label: 'Assignment 2',
        title: 'Peer Review Discussion Board Activity-Instructor Determined Assignment',
        weight: '20%',
        points: '100 Points',
        note: 'Weekly peer feedback posts · 4 Word Document files',
        mediaUrl: 'https://presentationgeeks.com/blog/importance-of-presentation-feedback/',
        subType: 'assignment',
        fullInstructions: `Students will complete an instructor-determined assignment that integrates their understanding of course concepts through critical reflection and application to counseling settings.

• Purpose: The purpose of this assignment is to engage students in providing constructive peer feedback as a group on the discussion board following each presentation.

• Group Feedback Process: On weeks when they are not presenting, students will work within their presentation groups to provide feedback on another group’s presentation. This feedback should evaluate both:
- CONTENT (what was presented)
- CONTEXT (how it was delivered)
Feedback should address three core questions:
1. What did we appreciate about the group’s work?
2. What did we find challenging about it?
3. What recommendations do we have for improvement?

• Weekly Submission Timeline: Each week, only the designated representative from each group will submit a comprehensive feedback post in the discussion area (visible to all groups) and a submission assignment in the submission area (for the instructor) by Monday at 11:59 PM. In response, a designated representative from the presenting group will have the opportunity to reply to the feedback (optional) by Wednesday at 11:59 PM.

• Course Deliverables: By the end of the course, each group must have four Word Document files (no PDFs) submissions of feedback responses in the designated area as well as one integrated Word Document file, clearly naming each file (e.g., Group 1’s Feedback on Group 2’s Presentation). Review the provided resource for guidance: The Importance of Presentation Feedback (https://presentationgeeks.com/blog/importance-of-presentation-feedback/).`,
        rubric: [
          { criterionName: 'Feedback on the Strength Areas of Presentation Content', points: 25 },
          { criterionName: 'Feedback on the Improvement Areas of Presentation Content', points: 25 },
          { criterionName: 'Feedback on the Strength Areas of Presentation Context', points: 25 },
          { criterionName: 'Feedback on the Improvement Areas of Presentation Context', points: 25 }
        ]
      },
      {
        num: 3,
        label: 'Assignment 3',
        title: 'Peer Review Group Report',
        weight: '10%',
        points: '100 Points',
        dueDate: new Date(2026, 8, 13, 23, 59, 0),
        note: '15-minute video and one-page summary',
        subType: 'paper',
        fullInstructions: `For this assignment, each group must submit a 15-minute video and one-page summary as a recipient of feedback, reflecting on their learning from the process.

• Reflection Synthesis: Within their presentation group, students will collaboratively compile insights on appreciation, challenges, and changes based on the feedback received. The video should include specific examples of the feedback, interpretations of its significance, and reflections on how it has shaped their understanding.

• Video Recording Requirements: The goal of the video is to show your team having a real discussion about the peer feedback you received. To make this clear, everyone needs to be on screen together in a single recording (like a Zoom or Teams meeting recording). Videos where everyone is separate or edited together from individual clips won't meet the goal of the assignment and will unfortunately lose marks.

• Reflection Prompts: The video and one-page summary, due no later than Sunday, Sep. 13, 2026, at 11:59 PM, must address the following questions:
1. What have we learned from the received feedback?
2. How do we feel about what we've learned?
3. What are our thoughts regarding what we've learned?
4. What is our plan for improvement based on the received feedback?
To ensure meaningful reflection, group members must convene weekly, either online or in person, to discuss their responses and record their reflections.`,
        rubric: [
          { criterionName: 'Organization and Coherence', points: 10 },
          { criterionName: 'Evidence and Support', points: 20 },
          { criterionName: 'Analysis and use of Course Concepts', points: 20 },
          { criterionName: 'Evaluating Information', points: 20 },
          { criterionName: 'Self-reflection', points: 30 }
        ]
      },
      {
        num: 4,
        label: 'Assignment 4',
        title: 'Research Study Design-Individual Paper',
        weight: '40%',
        points: '100 Points',
        dueDate: new Date(2026, 8, 6, 23, 59, 0),
        note: '10–12 pages double-spaced with IRB ethics proposal',
        subType: 'paper',
        fullInstructions: `In consultation with their instructor, students will design a research study using a topic that could potentially serve as a capstone project.

• Paper Content Structure: The paper will include: 1) a research question; 2) the significance and context of the question; 3) the conceptual framework of the study; 4) relevant areas of literature; 5) eight to ten scholarly sources; 6) research variables; 7) the study methodology; 8) the data collection procedure; and 9) the method of analysis.

• IRB Ethics Proposal: This paper will include an ethics proposal that could be submitted to the university’s Institutional Review Board (IRB). Instructors will provide sample proposals and forms as appropriate.

• Length & Formatting: This paper, scheduled for submission on Sunday, Sep. 6, 2026, at 11:59 PM, must be 10–12 pages, double-spaced, using a minimum of 8–10 peer-reviewed sources from the past 5 years. APA formatting and citations are mandatory as failure to cite sources appropriately constitutes plagiarism. Late submissions are subject to a deduction of 1 point/day for the first 10 days, followed by 5 points/day thereafter.`,
        rubric: [
          { criterionName: 'Organization and Coherence', points: 10 },
          { criterionName: 'Evidence and Support', points: 20 },
          { criterionName: 'Analysis and use of Course Concepts', points: 20 },
          { criterionName: 'Professional Ethics', points: 20 },
          { criterionName: 'Research Topic', points: 20 },
          { criterionName: 'APA', points: 10 }
        ]
      },
      {
        num: 5,
        label: 'Assignment 5',
        title: 'Attendance / Participation',
        weight: '10%',
        points: '100 Points',
        note: 'Continuous evaluation throughout term',
        subType: 'assignment',
        fullInstructions: `As a counseling program, active attendance and participation are essential to developing the skills required in the field. Meaningful interaction with your peers is necessary to establish the rapport and trust inherent in counseling.

• Attendance Policy: Attendance in all classes is required, as these sessions are crucial components of your learning. Absences will only be excused in cases of illness or emergency, and a written notification must be submitted to the instructor. Arriving late or leaving early will constitute an unexcused absence. Students with more than 2 unexcused absences will be directed to meet with the local Program Director to discuss continued participation in the course, and 3% of students' overall course grade will be deducted for each unexcused absence.

• Participation Standards: Participation grades are based on engagement in class activities, including contributing to discussions, actively listening, allowing space for others to speak, and demonstrating involvement in practice and demo sessions. Respect for the group process and constructive participation are key expectations. At the beginning of each class, students must contribute to group activities designed around thought-provoking discussion questions and continue to engage throughout the session. At the end of each class, students are expected to participate in discussions on key takeaways and reflections on their learning.`,
        rubric: [
          { criterionName: 'Attendance', points: 50 },
          { criterionName: 'Participation', points: 50 }
        ]
      }
    ];

    const newReadings: Reading[] = cleanReadingsList.map((r, rIdx) => ({
      ...r,
      id: `r-cpc514-${r.weekNumber || 1}-${rIdx}`,
      courseCode: 'CPC 514',
      courseId: cpc514Course!.id,
      sourceDocumentName: 'CPC514_Syllabus.pdf',
      docColorHex: cpc514Course!.hexColor || '#2563EB',
      dueDate: r.dueDate ? parseSafeDate(r.dueDate) : null
    }));

    const newAssignments: Assignment[] = canonicalAssignmentsData.map((cData, aIdx) => {
      const parsedMatch = cleanAssignmentsList.find(a =>
        a.assignmentNumber === cData.num ||
        (a.title || '').toLowerCase().includes(cData.title.toLowerCase().slice(0, 15))
      );
      const existingMatch = existingAssignments.find(a =>
        a.assignmentNumber === cData.num ||
        (a.title || '').toLowerCase().includes(cData.title.toLowerCase().slice(0, 15))
      );
      return sanitizeAssignment({
        id: existingMatch ? existingMatch.id : `a-cpc514-${cData.num}`,
        title: cData.title,
        assignmentNumber: cData.num,
        assignmentNumberLabel: cData.label,
        weightPercentage: cData.weight,
        pointsPossible: cData.points,
        weekNumber: 0,
        subTypeRaw: cData.subType,
        courseCode: 'CPC 514',
        courseId: cpc514Course!.id,
        sourceDocumentName: 'CPC514_Syllabus.pdf',
        docColorHex: cpc514Course!.hexColor || '#2563EB',
        dueDate: cData.dueDate || (parsedMatch?.dueDate ? parseSafeDate(parsedMatch.dueDate) : null),
        fullInstructions: cData.fullInstructions,
        noteText: cData.note,
        mediaUrl: cData.mediaUrl || parsedMatch?.mediaUrl || null,
        rubricCriteria: cData.rubric,
        isCompleted: existingMatch?.isCompleted || false,
        isDeleted: false,
        isFavorite: existingMatch?.isFavorite || false
      });
    });

    rawReadings = [...rawReadings.filter(r => !isCpc514Reading(r)), ...newReadings];
    rawAssignments = [...rawAssignments.filter(a => !isCpc514Assignment(a)), ...newAssignments];

    const maxWeek = Math.max(...newReadings.map(r => r.weekNumber || 1), 5);
    const courseWeeks: Week[] = [];
    for (let w = 1; w <= maxWeek; w++) {
      const weekReadings = newReadings.filter(r => (r.weekNumber || 0) === w);
      const foundWeek = (normalized.weeks as any[])?.find((dw: any) => dw.weekNumber === w);
      courseWeeks.push({
        id: `w-cpc514-${w}`,
        weekNumber: w,
        theme: foundWeek?.theme || `Week ${w}`,
        startDate: foundWeek?.startDate ? parseSafeDate(foundWeek.startDate) : null,
        dateRangeStr: foundWeek?.dateRangeStr || null,
        courseId: cpc514Course!.id,
        readings: weekReadings
      });
    }
    cpc514Course.weeks = courseWeeks;
    cpc514Course.assignments = newAssignments;
    cpc514Course.termWeeks = maxWeek;
  }

  // Ensure VaultDocument exists for CPC 514 in vaultDocs
  const docIndex = cleanVaultDocs.findIndex(vd =>
    vd.id === `vd-${cpc514Course!.id}-syllabus` ||
    (vd.courseCode && vd.courseCode.replace(/\s+/g, '').toUpperCase() === 'CPC514') ||
    (vd as any).courseId === cpc514Course!.id ||
    (vd.title && vd.title.toLowerCase().includes('cpc 514')) ||
    (vd.title && vd.title.toLowerCase().includes('cpc514'))
  );

  const initialPdfUri = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}syllabi/CPC514_Syllabus.pdf` : null;

  if (docIndex >= 0) {
    cleanVaultDocs[docIndex] = {
      ...cleanVaultDocs[docIndex],
      courseCode: 'CPC 514',
      courseId: cpc514Course!.id,
      title: 'CPC 514 Syllabus',
      rawFileDataUri: cleanVaultDocs[docIndex].rawFileDataUri || initialPdfUri
    };
  } else {
    cleanVaultDocs.push({
      id: `vd-${cpc514Course!.id}-syllabus`,
      title: 'CPC 514 Syllabus',
      category: 'Syllabi',
      fileSize: '300 KB',
      fileType: 'PDF',
      courseCode: 'CPC 514',
      courseId: cpc514Course!.id,
      fileContent: cpc514Course!.courseDescription,
      docColorHex: cpc514Course!.hexColor || '#2563EB',
      rawFileDataUri: initialPdfUri,
      pageImages: null,
      uploadedAt: new Date()
    });
  }

  return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments, vaultDocs: cleanVaultDocs };
}

const initialReadings: Reading[] = [];
const initialAssignments: Assignment[] = [];
const initialVaultDocs: VaultDocument[] = [];

export const CoursePalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [readings, setReadings] = useState<Reading[]>(initialReadings);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>(initialVaultDocs);
  const [selectedTab, setSelectedTab] = useState<TabKey>('readings');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<Course | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(false);
  const [hasLoadedTerms, setHasLoadedTerms] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [confettiTitle, setConfettiTitle] = useState<string>('');
  const [latestDiagnosticRecord, setLatestDiagnosticRecord] = useState<DiagnosticImportRecord | null>(null);
  const [importBanner, setImportBanner] = useState<ImportBannerState | null>(null);

  const dismissImportBanner = useCallback(() => {
    setImportBanner(null);
  }, []);

  const coursesRef = useRef<Course[]>(courses);
  coursesRef.current = courses;
  const readingsRef = useRef<Reading[]>(readings);
  readingsRef.current = readings;
  const assignmentsRef = useRef<Assignment[]>(assignments);
  assignmentsRef.current = assignments;
  const vaultDocsRef = useRef<VaultDocument[]>(vaultDocs);
  vaultDocsRef.current = vaultDocs;

  const isInitialMount = useRef(true);

  // Restore latest backup from disk on app launch
  useEffect(() => {
    let isMounted = true;

    // Load terms acceptance from disk (strictly first-launch onboarding check)
    persistenceManager.loadTermsAccepted().then(accepted => {
      if (!isMounted) return;
      if (accepted) {
        setHasAcceptedTerms(true);
      }
      setHasLoadedTerms(true);
    });

    persistenceManager.loadLatestBackup().then(backup => {
      if (!isMounted) return;
      if (backup) {
        // If user already has any courses, readings, assignments, or hasAcceptedTerms flag in backup,
        // they have obviously already onboarded. Ensure terms are marked accepted immediately.
        if (
          backup.hasAcceptedTerms === true ||
          (Array.isArray(backup.courses) && backup.courses.length > 0) ||
          (Array.isArray(backup.readings) && backup.readings.length > 0) ||
          (Array.isArray(backup.assignments) && backup.assignments.length > 0)
        ) {
          setHasAcceptedTerms(true);
          persistenceManager.saveTermsAccepted();
        }

        const isMockSeed = (id?: string | null) =>
          id === 'c-cpc527-static-seed' || id === 'c-seed-mock';

        const isSyntheticReading = (r: any) => {
          const t = (r.title || '').toLowerCase();
          return t.includes('required reading & core materials') ||
                 t.startsWith('required reading (week') ||
                 isGenericPlaceholderReadingTitle(r.title);
        };

        const isSyntheticAssignment = (a: any) => {
          const t = (a.title || '').trim();
          return t === 'Initial Research & Literature Review' ||
                 t === 'Midterm Case Analysis' ||
                 t === 'Final Capstone Project & Defense';
        };



        let cleanCourses = (Array.isArray(backup.courses) ? backup.courses : [])
          .filter(c => !isMockSeed(c.id))
          .map(c => ({
            ...c,
            createdAt: parseSafeDate(c.createdAt) || new Date(),
            weeks: (c.weeks || []).map((w: any) => ({
              ...w,
              theme: cleanAcademicWeekTheme(w.theme) || `Week ${w.weekNumber}`
            }))
          }));
        let rawReadings = (Array.isArray(backup.readings) ? backup.readings : [])
          .filter(r => !r.id?.startsWith('r-seed-') && !isMockSeed(r.id) && !isSyntheticReading(r))
          .map(r => {
            const sanitized = sanitizeReading(r);
            if (isGenericPlaceholderTheme(sanitized.relevantTopics)) {
              sanitized.relevantTopics = undefined;
            }
            return sanitized;
          });
        let rawAssignments = (Array.isArray(backup.assignments) ? backup.assignments : [])
          .filter(a => !a.id?.startsWith('a-seed-') && !isMockSeed(a.id) && !isSyntheticAssignment(a))
          .map(a => sanitizeAssignment(a));
        let cleanVaultDocs = (Array.isArray(backup.vaultDocs) ? backup.vaultDocs : [])
          .filter(vd => vd.id !== 'vd-cpc527-static-seed')
          .map(vd => ({
            ...vd,
            title: formatShortDocumentTitle(vd.title),
            uploadedAt: parseSafeDate(vd.uploadedAt) || new Date()
          }));

        // If user has old dummy seed courses (cpc-523, cpc-511), filter them out so they don't clutter the view
        const isLegacyDummySeed = (id: string) => /^c-cpc-(523|511)-active$/.test(id);
        cleanCourses = cleanCourses.filter(c => !isLegacyDummySeed(c.id));

        // Deduplicate courses if user previously imported the same course/syllabus twice
        const deduplicatedCourses: Course[] = [];
        const seenCourseKeys = new Map<string, Course>();
        for (const c of cleanCourses) {
          const codeKey = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
          const nameKey = (c.courseName || '').trim().toLowerCase();
          const validCodeKey = codeKey && !isGenericToken(codeKey) ? codeKey : '';
          const validNameKey = nameKey && !isGenericToken(nameKey) ? nameKey : '';
          const key = validCodeKey || validNameKey;
          if (key) {
            if (seenCourseKeys.has(key)) {
              const existing = seenCourseKeys.get(key)!;
              const existingScore = (existing.weeks?.length || 0) + (existing.assignments?.length || 0);
              const currentScore = (c.weeks?.length || 0) + (c.assignments?.length || 0);
              if (currentScore > existingScore) {
                const idx = deduplicatedCourses.indexOf(existing);
                if (idx !== -1) deduplicatedCourses[idx] = c;
                seenCourseKeys.set(key, c);
              }
              continue;
            }
            seenCourseKeys.set(key, c);
          }
          deduplicatedCourses.push(c);
        }
        cleanCourses = deduplicatedCourses;

        // Deduplicate Vault Documents so the same syllabus is never loaded twice for the same course
        const seenDocs = new Set<string>();
        cleanVaultDocs = cleanVaultDocs.filter(vd => {
          const safeCode = vd.courseCode && !isGenericToken(vd.courseCode) ? vd.courseCode.toUpperCase() : '';
          const docKey = `${vd.courseId || safeCode || 'doc'}_${(vd.title || '').toLowerCase()}`;
          if (seenDocs.has(docKey)) return false;
          seenDocs.add(docKey);
          return true;
        });

        rawReadings = rawReadings.filter(r => cleanCourses.some(c => isItemForCourse(r, c)));
        rawAssignments = rawAssignments.filter(a => cleanCourses.some(c => isItemForCourse(a, c)));
        cleanVaultDocs = cleanVaultDocs.filter(d => cleanCourses.some(c => isItemForCourse(d, c)));

        // Re-link items to their active course ID to heal any ID divergences from re-imports or deduplication
        rawReadings = rawReadings.map(r => {
          const matched = cleanCourses.find(c => isItemForCourse(r, c));
          if (matched && r.courseId !== matched.id) {
            return { ...r, courseId: matched.id };
          }
          return r;
        });
        rawAssignments = rawAssignments.map(a => {
          const matched = cleanCourses.find(c => isItemForCourse(a, c));
          if (matched && a.courseId !== matched.id) {
            return { ...a, courseId: matched.id };
          }
          return a;
        });
        cleanVaultDocs = cleanVaultDocs.map(d => {
          const matched = cleanCourses.find(c => isItemForCourse(d, c));
          if (matched && (d as any).courseId !== matched.id) {
            return { ...d, courseId: matched.id };
          }
          return d;
        });

        if (cleanCourses.length === 0) {
          // If user has 0 courses stored, do NOT seed default courses.
          // Clean out any orphaned items so no weeks, modules, or readings appear without a course.
          cleanCourses = [];
          rawReadings = [];
          rawAssignments = [];
          cleanVaultDocs = [];
        } else {
          // Only heal existing courses if they actually exist in the user's active courses
          const hasCpc512 = cleanCourses.some(c => (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC512');
          if (hasCpc512) {
            const cpcHealed = healCanonicalCPC512(cleanCourses, rawReadings, rawAssignments, cleanVaultDocs);
            cleanCourses = cpcHealed.courses;
            rawReadings = cpcHealed.readings;
            rawAssignments = cpcHealed.assignments;
            cleanVaultDocs = cpcHealed.vaultDocs || cleanVaultDocs;
          }

          const hasCpc514 = cleanCourses.some(c => (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC514');
          if (hasCpc514) {
            const cpc514Healed = healCanonicalCPC514(cleanCourses, rawReadings, rawAssignments, cleanVaultDocs);
            cleanCourses = cpc514Healed.courses;
            rawReadings = cpc514Healed.readings;
            rawAssignments = cpc514Healed.assignments;
            cleanVaultDocs = cpc514Healed.vaultDocs || cleanVaultDocs;
          }

          const hasCpc527 = cleanCourses.some(c => (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC527');
          if (hasCpc527) {
            const cpc527Healed = healCanonicalCPC527(cleanCourses, rawReadings, rawAssignments, cleanVaultDocs);
            cleanCourses = cpc527Healed.courses;
            rawReadings = cpc527Healed.readings;
            rawAssignments = cpc527Healed.assignments;
            cleanVaultDocs = cpc527Healed.vaultDocs || cleanVaultDocs;
          }
        }

        // Heal and organize weeks: turn ON weeks that were previously zeroed/auto-off
        const sanitizedRawReadings = rawReadings.map(sanitizeReading);
        const sanitizedRawAssignments = rawAssignments.map(sanitizeAssignment);
        const { readings: cleanReadings, assignments: cleanAssignments } = healItemWeeks(
          cleanCourses,
          sanitizedRawReadings,
          sanitizedRawAssignments
        );

        // Populate course weeks with organized readings
        const updatedCourses = cleanCourses.map(c => {
          const cReadings = cleanReadings.filter(r => isItemForCourse(r, c));
          const maxW = Math.max(
            ...cReadings.map(r => r.weekNumber || 1),
            c.termWeeks || 10,
            1
          );
          const weeks: Week[] = [];
          for (let w = 1; w <= maxW; w++) {
            const existingWeek = c.weeks?.find(ew => ew.weekNumber === w);
            weeks.push({
              id: `w-${w}`,
              weekNumber: w,
              theme: existingWeek?.theme || `Week ${w}`,
              startDate: existingWeek?.startDate || null,
              dateRangeStr: existingWeek?.dateRangeStr || null,
              moduleNumber: existingWeek?.moduleNumber || null,
              moduleMention: existingWeek?.moduleMention || (existingWeek?.moduleNumber ? `Module ${existingWeek.moduleNumber}` : null),
              courseId: c.id,
              readings: cReadings.filter(r => r.weekNumber === w)
            });
          }
          return {
            ...c,
            termWeeks: maxW,
            weeks
          };
        });

        // Hydrate assignments missing dueDate but having weekNumber from course schedule
        const hydratedAssignments = cleanAssignments
          .filter(a => !isInvalidAssignmentTitle(a.title))
          .map(a => {
            if (!a.dueDate && a.weekNumber > 0) {
              const matchedCourse = updatedCourses.find(c => isItemForCourse(a, c));
              const w = matchedCourse?.weeks?.find(wk => wk.weekNumber === a.weekNumber);
              if (w?.startDate) {
                return { ...a, dueDate: parseSafeDate(w.startDate) };
              } else if (w?.dateRangeStr) {
                return { ...a, dueDate: parseSafeDate(w.dateRangeStr) };
              }
            }
            return a;
          });

        // Hydrate readings missing dueDate but having weekNumber from course schedule
        const hydratedReadings = cleanReadings.map(r => {
          if (!r.dueDate && (r.weekNumber || 0) > 0) {
            const matchedCourse = updatedCourses.find(c => isItemForCourse(r, c));
            const w = matchedCourse?.weeks?.find(wk => wk.weekNumber === r.weekNumber);
            if (w?.startDate) {
              return {
                ...r,
                dueDate: parseSafeDate(w.startDate),
                dateRangeStr: r.dateRangeStr || w.dateRangeStr || null
              };
            } else if (w?.dateRangeStr) {
              return {
                ...r,
                dueDate: parseSafeDate(w.dateRangeStr),
                dateRangeStr: r.dateRangeStr || w.dateRangeStr || null
              };
            }
          }
          return r;
        });

        coursesRef.current = updatedCourses;
        readingsRef.current = hydratedReadings;
        assignmentsRef.current = hydratedAssignments;
        vaultDocsRef.current = cleanVaultDocs;

        setCourses(updatedCourses);
        setReadings(hydratedReadings);
        setAssignments(hydratedAssignments);
        setVaultDocs(cleanVaultDocs);
        if (backup.diagnosticRecord) {
          setLatestDiagnosticRecord(backup.diagnosticRecord);
        }

        persistenceManager.saveImmediate({
          courses: updatedCourses,
          readings: hydratedReadings,
          assignments: hydratedAssignments,
          vaultDocs: cleanVaultDocs
        });

        // Background PDF hydration: ensure bundled PDF files exist on disk with rendered pages
        (async () => {
          try {
            const hydrated = await Promise.all(
              cleanVaultDocs.map(vd => hydrateVaultDocWithRealPdf(vd))
            );
            if (isMounted) {
              vaultDocsRef.current = hydrated;
              setVaultDocs([...hydrated]);
              persistenceManager.saveImmediate({
                courses: updatedCourses,
                readings: hydratedReadings,
                assignments: hydratedAssignments,
                vaultDocs: hydrated
              });
            }
          } catch (e) {
            // Non-blocking
          }
        })();
      } else {
        // Initial baseline disk save: clean start with 0 courses until uploaded
        coursesRef.current = [];
        readingsRef.current = [];
        assignmentsRef.current = [];
        vaultDocsRef.current = [];

        setCourses([]);
        setReadings([]);
        setAssignments([]);
        setVaultDocs([]);

        persistenceManager.saveImmediate({
          courses: [],
          readings: [],
          assignments: [],
          vaultDocs: []
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Automatically schedule backup to disk on any mutations
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    persistenceManager.scheduleAutoBackup({
      courses,
      readings,
      assignments,
      vaultDocs
    });
  }, [courses, readings, assignments, vaultDocs]);

  const triggerConfetti = useCallback((title: string) => {
    setConfettiTitle(title);
    setShowConfetti(true);
  }, []);

  const dismissConfetti = useCallback(() => {
    setShowConfetti(false);
  }, []);

  const toggleReading = useCallback((id: string) => {
    setReadings(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          const nextVal = !item.isCompleted;
          if (nextVal) {
            triggerConfetti(`Completed: ${item.title}`);
          }
          return { ...item, isCompleted: nextVal };
        }
        return item;
      });
      readingsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: next,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, [triggerConfetti]);

  const toggleAssignment = useCallback((id: string) => {
    setAssignments(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          const nextVal = !item.isCompleted;
          if (nextVal) {
            triggerConfetti(`Completed: ${item.title}`);
          }
          return { ...item, isCompleted: nextVal };
        }
        return item;
      });
      assignmentsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: next,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, [triggerConfetti]);

  const updateAssignment = useCallback((updated: Assignment) => {
    const sanitized = sanitizeAssignment(updated);
    setAssignments(prev => {
      const next = prev.map(a => (a.id === sanitized.id ? sanitized : a));
      assignmentsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: next,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const updateReading = useCallback((updated: Reading) => {
    const sanitized = sanitizeReading(updated);
    setReadings(prev => {
      const next = prev.map(r => (r.id === sanitized.id ? sanitized : r));
      readingsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: next,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const restoreAssignment = useCallback((id: string) => {
    setAssignments(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, isDeleted: false } : a));
      assignmentsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: next,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const restoreReading = useCallback((id: string) => {
    setReadings(prev => {
      const next = prev.map(r => (r.id === id ? { ...r, isDeleted: false } : r));
      readingsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: next,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const emptyReadingsTrash = useCallback(() => {
    setReadings(prev => {
      const next = prev.filter(r => !r.isDeleted);
      readingsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: next,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const emptyAssignmentsTrash = useCallback(() => {
    setAssignments(prev => {
      const next = prev.filter(a => !a.isDeleted);
      assignmentsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: next,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const permanentlyDeleteReading = useCallback((id: string) => {
    setReadings(prev => {
      const next = prev.filter(r => r.id !== id);
      readingsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: next,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const permanentlyDeleteAssignment = useCallback((id: string) => {
    setAssignments(prev => {
      const next = prev.filter(a => a.id !== id);
      assignmentsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: next,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const emptyTrash = useCallback(() => {
    emptyReadingsTrash();
    emptyAssignmentsTrash();
  }, [emptyReadingsTrash, emptyAssignmentsTrash]);

  const deleteReading = useCallback((id: string) => {
    setReadings(prev => {
      const next = prev.map(r => (r.id === id ? { ...r, isDeleted: true } : r));
      readingsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: next,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const deleteAssignment = useCallback((id: string) => {
    setAssignments(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, isDeleted: true } : a));
      assignmentsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: next,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
  }, []);

  const deleteCourse = useCallback((id: string) => {
    const courseToDelete = coursesRef.current.find(c => c.id === id);

    const nextCourses = coursesRef.current.filter(c => c.id !== id);
    let nextReadings = readingsRef.current.filter(
      r => (courseToDelete ? !isItemForCourse(r, courseToDelete) : r.courseId !== id)
    );
    let nextAssignments = assignmentsRef.current.filter(
      a => (courseToDelete ? !isItemForCourse(a, courseToDelete) : a.courseId !== id)
    );
    let nextVaultDocs = vaultDocsRef.current.filter(
      v => (courseToDelete ? !isItemForCourse(v, courseToDelete) : (v.courseId ? v.courseId !== id : true))
    );

    if (nextCourses.length === 0) {
      nextReadings = [];
      nextAssignments = [];
      nextVaultDocs = [];
    }

    coursesRef.current = nextCourses;
    readingsRef.current = nextReadings;
    assignmentsRef.current = nextAssignments;
    vaultDocsRef.current = nextVaultDocs;

    setCourses(nextCourses);
    setReadings(nextReadings);
    setAssignments(nextAssignments);
    setVaultDocs(nextVaultDocs);
    setSelectedCourseFilter(prev => (prev && prev.id === id ? null : prev));

    persistenceManager.saveImmediate({
      courses: nextCourses,
      readings: nextReadings,
      assignments: nextAssignments,
      vaultDocs: nextVaultDocs
    });
  }, []);

  const updateCourse = useCallback((updated: Course) => {
    setCourses(prev => {
      const next = prev.map(c => (c.id === updated.id ? updated : c));
      coursesRef.current = next;
      persistenceManager.saveImmediate({
        courses: next,
        readings: readingsRef.current,
        assignments: assignmentsRef.current,
        vaultDocs: vaultDocsRef.current
      });
      return next;
    });
    setSelectedCourseFilter(prev => (prev && prev.id === updated.id ? updated : prev));
  }, []);

  const deleteVaultDoc = useCallback((id: string) => {
    setVaultDocs(prev => {
      const next = prev.filter(d => d.id !== id);
      vaultDocsRef.current = next;
      persistenceManager.saveImmediate({
        courses: coursesRef.current,
        readings: readingsRef.current,
        assignments: assignmentsRef.current,
        vaultDocs: next
      });
      return next;
    });
  }, []);

  const addCourse = useCallback((data: { courseName: string; courseCode?: string; courseDescription?: string; hexColor: string }): Course => {
    const codeMatch = data.courseName.match(/^[A-Z]{2,5}\s*\d{2,4}/i);
    const resolvedCode = data.courseCode || (codeMatch ? codeMatch[0].toUpperCase() : data.courseName.slice(0, 8).toUpperCase());

    const newCourse: Course = {
      id: `c-${Date.now()}`,
      creatorId: 'user-self',
      courseName: data.courseName,
      courseCode: resolvedCode,
      courseDescription: data.courseDescription || '',
      hexColor: data.hexColor || MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length],
      termWeeks: 12,
      sharingCode: String(Math.floor(100000 + Math.random() * 900000)),
      isDeleted: false,
      isFavorite: false,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: []
    };
    coursesRef.current = [newCourse, ...coursesRef.current];
    setCourses(coursesRef.current);
    persistenceManager.saveImmediate({
      courses: coursesRef.current,
      readings: readingsRef.current,
      assignments: assignmentsRef.current,
      vaultDocs: vaultDocsRef.current
    });
    return newCourse;
  }, []);

  const addTask = useCallback((data: {
    category: 'assignment' | 'reading';
    title: string;
    courseId?: string;
    weekNumber: number;
    dueDate: Date;
    points?: number;
    weight?: number;
    mediaType?: MediaType;
    videoUrl?: string;
    notes?: string;
  }) => {
    const course = coursesRef.current.find(c => c.id === data.courseId) || coursesRef.current[0];
    const courseCode = course ? (course.courseCode || course.courseName) : 'GEN 101';
    const targetWeek = data.weekNumber > 0 ? data.weekNumber : 1;

    if (data.category === 'reading') {
      const newReading: Reading = {
        id: `r-${Date.now()}`,
        title: data.title,
        authorName: 'Instructor Assigned',
        resourceTitle: data.title,
        mediaTypeRaw: data.mediaType || 'textbook',
        mediaType: data.mediaType || 'textbook',
        isCompleted: false,
        isDeleted: false,
        summaryText: data.notes || '',
        keyTakeawaysText: '',
        estimatedTimeText: data.mediaType === 'video' ? '~20–30 min' : '~40–60 min',
        videoUrl: data.videoUrl,
        chapterText: undefined,
        pagesText: '',
        dueDate: data.dueDate,
        dateRangeStr: `Week ${targetWeek}`,
        courseCode,
        courseId: course ? course.id : data.courseId,
        relevantTopics: `Week ${targetWeek}`,
        isFavorite: false,
        weekNumber: targetWeek,
        weekId: `w-${targetWeek}`
      };
      const sanitized = sanitizeReading(newReading);
      setReadings(prev => {
        const next = [sanitized, ...prev];
        readingsRef.current = next;
        persistenceManager.saveImmediate({
          courses: coursesRef.current,
          readings: next,
          assignments: assignmentsRef.current,
          vaultDocs: vaultDocsRef.current
        });
        return next;
      });
    } else {
      const newAssignment: Assignment = sanitizeAssignment({
        id: `a-${Date.now()}`,
        title: data.title,
        weekNumber: targetWeek,
        dueDate: data.dueDate,
        pointsPossible: `${data.points || 100} Pts`,
        weightPercentage: `${data.weight || 10}%`,
        noteText: data.notes || '',
        isCompleted: false,
        isDeleted: false,
        courseCode,
        courseId: course ? course.id : data.courseId,
        relevantTopics: `Week ${targetWeek}`,
        isFavorite: false,
        rubricCriteria: []
      });
      setAssignments(prev => {
        const next = [newAssignment, ...prev];
        assignmentsRef.current = next;
        persistenceManager.saveImmediate({
          courses: coursesRef.current,
          readings: readingsRef.current,
          assignments: next,
          vaultDocs: vaultDocsRef.current
        });
        return next;
      });
    }
  }, []);

  const importShareCode = useCallback((codeOrLink: string): { success: boolean; message: string; course?: Course } => {
    const rawInput = (codeOrLink || '').trim();
    if (!rawInput) {
      return { success: false, message: 'Please enter a valid course code or link.' };
    }

    const cleanUpper = rawInput.toUpperCase();

    // 1. Direct match with existing courses already in local state
    const localFound = courses.find(
      c => c.sharingCode.toUpperCase() === cleanUpper || (c.courseCode && c.courseCode.toUpperCase() === cleanUpper)
    );

    if (localFound) {
      return {
        success: true,
        message: `Already enrolled in '${localFound.courseName}'!`,
        course: localFound
      };
    }

    // 2. Decode full course payload if URL, base64 data, or JSON is present
    const decodedDto = CourseSharingService.shared.decodeCourse(rawInput);

    if (decodedDto && decodedDto.courseName) {
      // Check if course already exists by decoded course code or name
      const existingMatch = courses.find(
        c => (decodedDto.sharingCode && c.sharingCode.toUpperCase() === decodedDto.sharingCode.toUpperCase()) ||
             (decodedDto.courseCode && c.courseCode && c.courseCode.toUpperCase() === decodedDto.courseCode.toUpperCase())
      );

      if (existingMatch) {
        return {
          success: true,
          message: `Already enrolled in '${existingMatch.courseName}'!`,
          course: existingMatch
        };
      }

      const newCourseId = `c-imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const assignedHexColor = MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length];
      const assignedCode = decodedDto.courseCode || decodedDto.sharingCode || 'CRS';

      // Unpack readings from weeks or items
      const importedReadings: Reading[] = [];
      const dWeeks = decodedDto.weeks || [];

      dWeeks.forEach(w => {
        const wNum = w.weekNumber || 1;
        (w.readings || []).forEach((r, rIdx) => {
          const rDate = parseSafeDate(r.dueDate);
          importedReadings.push({
            id: `r-imp-${Date.now()}-${wNum}-${rIdx}-${Math.random().toString(36).substring(2, 5)}`,
            title: r.title,
            authorName: r.authorName || null,
            resourceTitle: r.resourceTitle || r.title,
            mediaTypeRaw: r.mediaType || 'textbook',
            mediaType: (r.mediaType as MediaType) || 'textbook',
            isCompleted: Boolean(r.isCompleted),
            isDeleted: false,
            summaryText: r.summaryText || '',
            keyTakeawaysText: r.keyTakeawaysText || `• Study ${r.title}`,
            estimatedTimeText: r.estimatedTimeText || '~45 min read',
            dueDate: rDate,
            dateRangeStr: rDate ? rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
            chapterText: r.chapterText || null,
            pagesText: r.pagesText || null,
            courseCode: assignedCode,
            relevantTopics: r.relevantTopics || null,
            sourceDocumentName: `${decodedDto.courseName} Shared`,
            docColorHex: assignedHexColor,
            isFavorite: false,
            weekId: `w-${wNum}`,
            weekNumber: wNum
          });
        });
      });

      // If readings were packed as top-level items
      if (importedReadings.length === 0 && Array.isArray(decodedDto.items)) {
        decodedDto.items.filter(i => (i.category || '').toLowerCase() === 'reading').forEach((r, rIdx) => {
          const wNum = r.weekNumber || 1;
          const rDate = parseSafeDate(r.dueDateIso);
          importedReadings.push({
            id: `r-imp-${Date.now()}-${wNum}-${rIdx}`,
            title: r.title,
            authorName: r.authorName || null,
            resourceTitle: r.resourceTitle || r.title,
            mediaTypeRaw: r.subType || 'textbook',
            mediaType: (r.subType as MediaType) || 'textbook',
            isCompleted: false,
            isDeleted: false,
            summaryText: r.summaryText || r.description || '',
            keyTakeawaysText: r.keyTakeaways || `• Study ${r.title}`,
            estimatedTimeText: r.estimatedTime || '~45 min read',
            dueDate: rDate,
            dateRangeStr: rDate ? rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
            chapterText: r.chapterText || null,
            pagesText: r.pagesText || null,
            courseCode: assignedCode,
            relevantTopics: r.relevantTopics || null,
            sourceDocumentName: `${decodedDto.courseName} Shared`,
            docColorHex: assignedHexColor,
            isFavorite: false,
            weekId: `w-${wNum}`,
            weekNumber: wNum
          });
        });
      }

      // Unpack assignments
      const importedAssignments: Assignment[] = [];
      const dAssignments = decodedDto.assignments || [];
      dAssignments.forEach((a, aIdx) => {
        let aWeek = typeof a.weekNumber === 'number' && a.weekNumber > 0 ? a.weekNumber : 0;
        if (aWeek <= 0 && a.moduleMention) {
          const m = a.moduleMention.match(/\d+/);
          if (m) aWeek = parseInt(m[0], 10);
        }
        if (aWeek <= 0 && a.title) {
          const m = a.title.match(/\b(?:week|wk|module|mod)\s*[:\-–#.]*\s*(\d{1,2})\b/i);
          if (m) aWeek = parseInt(m[1], 10);
        }
        if (aWeek <= 0 && a.dueDate) {
          const d = parseSafeDate(a.dueDate);
          if (d) aWeek = weekNumberForDate(d);
        }
        if (aWeek <= 0) aWeek = 1;

        importedAssignments.push(sanitizeAssignment({
          id: `a-imp-${Date.now()}-${aIdx}-${Math.random().toString(36).substring(2, 5)}`,
          title: a.title,
          weekNumber: aWeek,
          dueDate: parseSafeDate(a.dueDate),
          fullInstructions: a.fullInstructions || 'Imported via CoursePal share link.',
          pointsPossible: a.pointsPossible || null,
          pointsBreakdown: a.pointsBreakdown || null,
          rubricJSON: null,
          noteText: a.noteText || null,
          isCompleted: Boolean(a.isCompleted),
          isDeleted: false,
          courseCode: assignedCode,
          moduleMention: a.moduleMention || `Week ${aWeek}`,
          weightPercentage: a.weightPercentage || null,
          subTypeRaw: 'assignment',
          mediaUrl: a.mediaUrl || null,
          relevantTopics: a.relevantTopics || `Week ${aWeek}`,
          sourceDocumentName: `${decodedDto.courseName} Shared`,
          docColorHex: assignedHexColor,
          isFavorite: false,
          courseId: newCourseId,
          rubricCriteria: a.rubricCriteria || a.rubric || []
        }));
      });

      if (importedAssignments.length === 0 && Array.isArray(decodedDto.items)) {
        decodedDto.items.filter(i => (i.category || '').toLowerCase() === 'assignment').forEach((a, aIdx) => {
          let aWeek = typeof a.weekNumber === 'number' && a.weekNumber > 0 ? a.weekNumber : 0;
          if (aWeek <= 0 && a.title) {
            const m = a.title.match(/\b(?:week|wk|module|mod)\s*[:\-–#.]*\s*(\d{1,2})\b/i);
            if (m) aWeek = parseInt(m[1], 10);
          }
          if (aWeek <= 0 && a.dueDateIso) {
            const d = parseSafeDate(a.dueDateIso);
            if (d) aWeek = weekNumberForDate(d);
          }
          if (aWeek <= 0) aWeek = 1;

          importedAssignments.push(sanitizeAssignment({
            id: `a-imp-${Date.now()}-${aIdx}-${Math.random().toString(36).substring(2, 5)}`,
            title: a.title,
            weekNumber: aWeek,
            dueDate: parseSafeDate(a.dueDateIso),
            fullInstructions: a.description || 'Imported via CoursePal share link.',
            pointsPossible: a.points || null,
            pointsBreakdown: null,
            rubricJSON: null,
            noteText: a.mediaUrl || null,
            isCompleted: false,
            isDeleted: false,
            courseCode: assignedCode,
            moduleMention: `Week ${aWeek}`,
            weightPercentage: a.percentage || null,
            subTypeRaw: 'assignment',
            mediaUrl: a.mediaUrl || null,
            relevantTopics: `Week ${aWeek}`,
            sourceDocumentName: `${decodedDto.courseName} Shared`,
            docColorHex: assignedHexColor,
            isFavorite: false,
            courseId: newCourseId,
            rubricCriteria: a.rubricCriteria || a.rubric || []
          }));
        });
      }

      // Construct weeks
      const maxW = Math.max(
        ...importedReadings.map(r => {
          const m = (r.weekId || '').match(/\d+/);
          return m ? parseInt(m[0], 10) : 1;
        }),
        decodedDto.termWeeks || 1,
        1
      );

      const courseWeeks: Week[] = [];
      for (let w = 1; w <= maxW; w++) {
        const wkReadings = importedReadings.filter(r => r.weekId === `w-${w}`);
        const foundTheme = dWeeks.find(dw => dw.weekNumber === w)?.theme || `Week ${w}`;
        courseWeeks.push({
          id: `w-${w}`,
          weekNumber: w,
          theme: foundTheme,
          courseId: newCourseId,
          readings: wkReadings
        });
      }

      const newCourse: Course = {
        id: newCourseId,
        creatorId: decodedDto.creatorId || 'shared-peer',
        courseName: decodedDto.courseName,
        courseCode: assignedCode,
        courseDescription: decodedDto.courseDescription || `Joined via course share. Instructor: ${decodedDto.instructorName || 'Academic Faculty'}`,
        instructorName: decodedDto.instructorName || null,
        instructorEmail: decodedDto.instructorEmail || null,
        hexColor: assignedHexColor,
        termWeeks: maxW,
        sharingCode: decodedDto.sharingCode || (cleanUpper.length === 6 ? cleanUpper : String(Math.floor(100000 + Math.random() * 900000))),
        isDeleted: false,
        isFavorite: true,
        createdAt: new Date(),
        weeks: courseWeeks,
        assignments: importedAssignments,
        syllabusDocs: []
      };

      const updatedCourses = [newCourse, ...coursesRef.current];
      const sanitizedReadings = importedReadings
        .filter(r => !isGenericPlaceholderReadingTitle(r.title))
        .map(sanitizeReading);
      const updatedReadings = [...sanitizedReadings, ...readingsRef.current];
      const updatedAssignments = [...importedAssignments, ...assignmentsRef.current];

      coursesRef.current = updatedCourses;
      readingsRef.current = updatedReadings;
      assignmentsRef.current = updatedAssignments;

      setCourses(updatedCourses);
      setReadings(updatedReadings);
      setAssignments(updatedAssignments);

      persistenceManager.saveImmediate({
        courses: updatedCourses,
        readings: updatedReadings,
        assignments: updatedAssignments,
        vaultDocs: vaultDocsRef.current
      });

      return {
        success: true,
        message: `Successfully joined '${newCourse.courseName}' with ${importedReadings.length} readings and ${importedAssignments.length} assignments!`,
        course: newCourse
      };
    }

    // 3. Fallback for raw 6-digit code or simple code: check bundled syllabi or create placeholder course
    const catalogMatch = BundledSyllabiCatalog.find(
      b => b.courseCode.toUpperCase() === cleanUpper || b.id.toUpperCase() === cleanUpper
    );

    const initialCourseName = catalogMatch ? catalogMatch.courseName : `Joined Course (${cleanUpper})`;
    const initialCourseCode = catalogMatch ? catalogMatch.courseCode : (cleanUpper.length <= 8 ? cleanUpper : 'CRS');

    const newCourse: Course = {
      id: `c-joined-${Date.now()}`,
      creatorId: 'shared-peer',
      courseName: initialCourseName,
      courseCode: initialCourseCode,
      courseDescription: catalogMatch ? `Imported syllabus for ${catalogMatch.courseName}` : 'Joined via course sharing code.',
      hexColor: catalogMatch ? catalogMatch.hexColor : MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length],
      termWeeks: 12,
      sharingCode: cleanUpper.length === 6 ? cleanUpper : String(Math.floor(100000 + Math.random() * 900000)),
      isDeleted: false,
      isFavorite: true,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: []
    };

    const updatedCourses = [newCourse, ...coursesRef.current];
    coursesRef.current = updatedCourses;
    setCourses(updatedCourses);

    persistenceManager.saveImmediate({
      courses: updatedCourses,
      readings: readingsRef.current,
      assignments: assignmentsRef.current,
      vaultDocs: vaultDocsRef.current
    });

    return {
      success: true,
      message: `Enrolled in '${newCourse.courseName}'!`,
      course: newCourse
    };
  }, [courses]);

  const acceptTerms = useCallback(() => {
    setHasAcceptedTerms(true);
    persistenceManager.saveTermsAccepted();
  }, []);

  const isImportingRef = useRef<boolean>(false);
  const lastImportStartTimeRef = useRef<number>(0);

  const importSyllabusDocument = useCallback(async (params: ImportSyllabusParams) => {
    const now = Date.now();
    // Auto-recover if UI is not in uploading state or if import lock is stale (over 15s)
    if (isUploading && now - lastImportStartTimeRef.current > 15000) {
      isImportingRef.current = false;
      setIsUploading(false);
    } else if (!isUploading) {
      isImportingRef.current = false;
    }

    if (isImportingRef.current || isUploading) {
      console.warn('Import already in progress, skipping duplicate invocation.');
      return { success: false, message: 'An import is already in progress. Please wait for it to complete.' };
    }
    isImportingRef.current = true;
    lastImportStartTimeRef.current = now;

    const { fileName, fileUri, fileSize, targetCourseId, preferredHexColor } = params;
    let rawText = params.rawText || '';

    const importStartTime = Date.now();

    // Switch immediately to syllabus tab so user sees the in-page upload status
    setSelectedTab('syllabus');
    setIsUploading(true);
    setUploadProgress(0.01);
    setUploadStatusText('Reading syllabus, please wait a moment...');

    let currentSimulatedProgress = 0.01;
    const progressTimer = setInterval(() => {
      if (currentSimulatedProgress < 0.25) {
        currentSimulatedProgress += 0.015; // 1% -> 25% steadily during file reading & page rendering
      } else if (currentSimulatedProgress < 0.60) {
        currentSimulatedProgress += 0.01; // 25% -> 60% during processing
      } else if (currentSimulatedProgress < 0.85) {
        currentSimulatedProgress += 0.006; // 60% -> 85% during normalization
      } else if (currentSimulatedProgress < 0.94) {
        currentSimulatedProgress += 0.002; // 85% -> 94% during synthesis
      }
      setUploadProgress(Number(currentSimulatedProgress.toFixed(3)));
    }, 200);

    // Request iOS background execution assertion to prevent suspension if app is minimized
    await beginBackgroundTask('SyllabusUpload');

    try {
      let base64Pdf: string | undefined = undefined;
      let renderedPageImageUris: string[] = [];
      let renderedPageBase64: string[] = [];

      // Step 1: Render high-resolution page pictures of the PDF and load binary base64 file data
      let persistentFileUri = fileUri;
      if (fileUri) {
        try {
          if (FileSystem.documentDirectory) {
            const syllabiDir = `${FileSystem.documentDirectory}syllabi/`;
            const dirInfo = await FileSystem.getInfoAsync(syllabiDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(syllabiDir, { intermediates: true });
            }
            const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const destUri = `${syllabiDir}${Date.now()}_${cleanName}`;
            await FileSystem.copyAsync({ from: fileUri, to: destUri });
            persistentFileUri = destUri;
          }
        } catch (copyErr) {
          console.warn('Could not copy syllabus to permanent storage:', copyErr);
        }
      } else {
        try {
          const matchedBundled = await ensureBundledPdfFile(
            fileName,
            targetCourseId,
            params.preserveCourseCode,
            rawText
          );
          if (matchedBundled) {
            persistentFileUri = matchedBundled;
          }
        } catch (err) {
          console.warn('Could not match bundled PDF for import:', err);
        }
      }

      const effectiveFileUri = persistentFileUri || fileUri;

      if (effectiveFileUri) {
        // Save pending upload job so if app is backgrounded/interrupted, it can be auto-recovered
        await persistenceManager.savePendingUploadJob({
          fileName,
          fileUri: effectiveFileUri,
          persistentFileUri: effectiveFileUri,
          fileSize,
          targetCourseId,
          preferredHexColor,
          rawText,
          timestamp: Date.now()
        });

        try {
          const lower = (fileName + ' ' + effectiveFileUri).toLowerCase();
          const isDocxFile = lower.includes('.docx');
          const isDoc = lower.includes('.pdf') || lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || isDocxFile;
          if (isDoc || !rawText) {
            const b64 = await FileSystem.readAsStringAsync(effectiveFileUri, {
              encoding: FileSystem.EncodingType.Base64
            });
            if (b64 && b64.length > 50) {
              if (isDocxFile || b64.startsWith('UEsDB')) {
                try {
                  const docxText = extractTextFromDocxBase64(b64);
                  if (docxText && docxText.trim().length > 20) {
                    rawText = docxText.trim();
                  }
                } catch (docxErr) {
                  console.warn('extractTextFromDocxBase64 warning:', docxErr);
                }
              } else {
                base64Pdf = b64;
              }
            }
          }
        } catch (b64Err) {
          console.warn('Base64 document read warning:', b64Err);
        }

        // Render individual PDF pages as high-resolution JPEG photos for visual reading
        try {
          const pageResult = await renderPDFPages(effectiveFileUri, 30);
          if (pageResult && pageResult.imageUris.length > 0) {
            renderedPageImageUris = pageResult.imageUris;
            renderedPageBase64 = pageResult.base64Pages;
          }
        } catch (renderErr) {
          console.warn('renderPDFPages error:', renderErr);
        }

        // Also extract native text as auxiliary context or offline fallback
        if (!rawText) {
          try {
            const extracted = await extractTextFromPDF(effectiveFileUri);
            if (extracted && extracted.trim().length > 20 && !extracted.startsWith('%PDF-')) {
              rawText = extracted.trim();
            }
          } catch (extractorErr) {
            // Ignore native extraction error
          }
        }
      }

      // Fallback: extract text directly from base64 PDF stream if native extraction was sparse
      if (!rawText && base64Pdf) {
        try {
          const latin = Buffer.from(base64Pdf, 'base64').toString('latin1');
          const streamText = extractTextFromPDFContent(latin);
          if (streamText && streamText.trim().length > 50) {
            rawText = streamText.trim();
          }
        } catch {}
      }

      // Safety check: ensure rawText is never binary garbage
      if (rawText && (rawText.startsWith('%PDF-') || /[\x00-\x08\x0E-\x1F]/.test(rawText.slice(0, 200)))) {
        rawText = '';
      }

      // Check bundled catalog if rawText is empty or too short, so local parser and prompt always have accurate text
      if (!rawText || rawText.trim().length < 50) {
        const cleanName = (fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const catalogMatch = BundledSyllabiCatalog.find(item => {
          const itemCode = (item.courseCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const itemId = (item.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const itemFile = (item.fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const itemName = (item.courseName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return (
            (itemCode.length >= 4 && cleanName.includes(itemCode)) ||
            (itemId.length >= 4 && cleanName.includes(itemId)) ||
            (cleanName.includes('groupcounselling') && itemCode.includes('527')) ||
            (cleanName.includes('cpc527')) ||
            (cleanName.includes('research') && (itemCode.includes('514') || itemId.includes('514') || itemName.includes('research'))) ||
            (cleanName.includes('514') && (itemCode.includes('514') || itemId.includes('514'))) ||
            cleanName.includes('sexuality') ||
            cleanName.includes('prjsex') ||
            cleanName === itemFile
          );
        });
        if (catalogMatch && catalogMatch.rawText) {
          rawText = catalogMatch.rawText;
        }
      }

      // Update saved pending job with extracted rawText for resilient background recovery
      if (effectiveFileUri && rawText) {
        await persistenceManager.savePendingUploadJob({
          fileName,
          fileUri: effectiveFileUri,
          persistentFileUri: effectiveFileUri,
          fileSize,
          targetCourseId,
          preferredHexColor,
          rawText,
          timestamp: Date.now()
        });
      }

      // Stage 2: 100% On-Device Deterministic Parsing Engine (Offline & Private)
      setUploadStatusText('Processing coursework, please wait...');
      currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.25);

      let localDto: CourseDTO | null = null;
      if (rawText && rawText.trim().length > 50) {
        try {
          localDto = LocalSyllabusParser.shared.parseText(rawText);
        } catch (localErr) {
          console.warn('Local parser parsing error:', localErr);
        }
      }

      const dto: any = localDto;
      const apiError: string | undefined = undefined;
      const isFallbackUsed = false;
      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, rawText);

      const aiHasData = Boolean(
        dto &&
        (normalized.candidateAssignments.length > 0 ||
         normalized.candidateReadings.length > 0 ||
         normalized.weeks.length > 0)
      );

      // Deduplicate readings and assignments without merging different books or recurring deliverables
      const cleanReadingsList = SyllabusImportManager.shared.deduplicateReadings(
        normalized.candidateReadings,
        normalized.textbooks,
        normalized.termYear
      );

      const cleanAssignmentsList = SyllabusImportManager.shared.deduplicateAssignments(
        normalized.candidateAssignments,
        normalized.termYear,
        normalized.weekDateMap
      );

      // Stage 3: Synthesizing Course Repository
      setUploadStatusText('Organizing your schedule, please wait...');
      currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.75);

      const safePreserveCode = !isGenericToken(params.preserveCourseCode) ? params.preserveCourseCode : undefined;
      const safeDtoCode = !isGenericToken(normalized.courseCode) ? normalized.courseCode : undefined;
      const safeFallbackDtoCode = !isGenericToken(dto?.courseCode) ? dto?.courseCode : undefined;
      const rawFallback = fileName.replace(/\.[^/.]+$/, '').trim();
      const codeMatchInFilename = rawFallback.match(/\b([A-Z]{2,6}\s*\d{2,4}[A-Z]?)\b/i);
      const extractedCodeFromFilename = codeMatchInFilename ? codeMatchInFilename[1].toUpperCase().replace(/\s+/g, ' ') : undefined;
      const fallbackCode = extractedCodeFromFilename || (isGenericToken(rawFallback) ? undefined : rawFallback.slice(0, 8).toUpperCase());
      const courseCode = safePreserveCode || safeDtoCode || safeFallbackDtoCode || (isGenericToken(fallbackCode) ? undefined : fallbackCode);
      const cleanCustomTitle = (params.preserveCourseTitle && !isStubOrFileName(params.preserveCourseTitle) && params.preserveCourseTitle.trim().toLowerCase() !== (courseCode || '').toLowerCase())
        ? params.preserveCourseTitle.trim()
        : undefined;
      const courseName = cleanCustomTitle || normalized.courseName || dto?.courseName || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const hexColor = preferredHexColor || MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length];

      // Find or create course using coursesRef.current (avoids stale closures)
      // When isNewCourse is true, strictly bypass existing course matching so a brand-new course is always created!
      let targetCourse = (!params.isNewCourse && targetCourseId) ? coursesRef.current.find(c => c.id === targetCourseId) : undefined;

      // If targetCourse was not explicitly specified and NOT explicitly marked as a new course creation,
      // search for an existing course by course code, course title, or matching syllabus document so uploading the same document
      // or multiple copies from phone files updates the existing course instead of creating duplicate courses and documents!
      // Strictly ignore generic tokens (e.g. "Syllabus", "Document", "Course") so new documents for different courses never collapse!
      if (!targetCourse && !params.isNewCourse) {
        const candidateCode = (courseCode || '').replace(/\s+/g, '').toUpperCase();
        const candidateName = (courseName || '').trim().toLowerCase();
        const cleanDocTitle = formatShortDocumentTitle(fileName).toLowerCase();
        const baseFileName = fileName.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

        targetCourse = coursesRef.current.find(c => {
          const cCode = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
          if (candidateCode && cCode && !isGenericToken(candidateCode) && !isGenericToken(cCode) && candidateCode === cCode) return true;

          const cName = (c.courseName || '').trim().toLowerCase();
          if (candidateName && cName && !isGenericToken(candidateName) && !isGenericToken(cName)) {
            if (candidateName === cName) return true;
          }

          // Check if this course already owns this document (matching non-generic title or filename)
          if (!isGenericToken(cleanDocTitle) && !isGenericToken(baseFileName)) {
            const hasMatchingDoc = vaultDocsRef.current.some(vd =>
              ((vd as any).courseId === c.id || (vd.courseCode && c.courseCode && !isGenericToken(c.courseCode) && vd.courseCode.toUpperCase() === c.courseCode.toUpperCase())) &&
              (vd.title?.toLowerCase() === cleanDocTitle || vd.title?.toLowerCase() === fileName.toLowerCase() || vd.title?.toLowerCase() === baseFileName)
            );
            if (hasMatchingDoc) return true;
          }

          return false;
        });
      }

      const courseId = targetCourse ? targetCourse.id : `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const effectiveCourseCode = safePreserveCode || safeDtoCode || safeFallbackDtoCode || targetCourse?.courseCode || courseCode;
      const effectiveCourseName = cleanCustomTitle || normalized.courseName || dto?.courseName || (!isStubOrFileName(targetCourse?.courseName) ? targetCourse?.courseName : undefined) || params.preserveCourseTitle || courseName;

      const existingVaultDoc = targetCourse
        ? vaultDocsRef.current.find(vd =>
            (vd as any).courseId === targetCourse!.id ||
            (vd.courseCode && targetCourse!.courseCode && vd.courseCode.toUpperCase() === targetCourse!.courseCode.toUpperCase()) ||
            vd.title?.toLowerCase() === formatShortDocumentTitle(fileName).toLowerCase() ||
            vd.title?.toLowerCase() === fileName.toLowerCase()
          )
        : undefined;
      const vaultDocId = existingVaultDoc ? existingVaultDoc.id : `vd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // Convert clean readings into Reading objects
      const newReadings: Reading[] = cleanReadingsList.map((r, rIdx) => {
        const weekNum = r.weekNumber || 0;
        const matchedWeek = (normalized.weeks as any[])?.find((dw: any) => dw.weekNumber === weekNum);
        const resolvedDueDate = r.dueDate
          ? parseSafeDate(r.dueDate)
          : matchedWeek?.startDate
          ? parseSafeDate(matchedWeek.startDate)
          : matchedWeek?.date
          ? parseSafeDate(matchedWeek.date)
          : matchedWeek?.dateRangeStr
          ? parseSafeDate(matchedWeek.dateRangeStr)
          : null;
        const resolvedDateRange = r.dateRangeStr || matchedWeek?.dateRangeStr || null;

        const genuineTopic = cleanAcademicWeekTheme(r.relevantTopics)
          || cleanAcademicWeekTheme(matchedWeek?.theme)
          || (weekNum > 0 ? `Week ${weekNum}` : null);

        const isReq = r.isRequired !== undefined
          ? (r.isRequired !== false && r.requirementType !== 'optional')
          : (r.requirementType === 'optional' ? false : true);
        const reqType: 'required' | 'optional' = (r.requirementType === 'optional' || isReq === false) ? 'optional' : 'required';

        const resolvedModuleNumber = r.moduleNumber || (matchedWeek as any)?.moduleNumber || ((matchedWeek as any)?.moduleMention && /\d+/.test((matchedWeek as any).moduleMention) ? parseInt((matchedWeek as any).moduleMention.match(/\d+/)![0], 10) : null);
        const resolvedModuleMention = r.moduleMention || (matchedWeek as any)?.moduleMention || (resolvedModuleNumber ? `Module ${resolvedModuleNumber}` : null);

        return {
          ...r,
          id: `r-${Date.now()}-${rIdx}`,
          courseCode: effectiveCourseCode,
          sourceDocumentName: fileName,
          sourceDocumentId: vaultDocId,
          docColorHex: targetCourse?.hexColor || hexColor,
          courseId: courseId,
          dueDate: resolvedDueDate,
          dateRangeStr: resolvedDateRange,
          relevantTopics: genuineTopic,
          isRequired: isReq,
          requirementType: reqType,
          moduleNumber: resolvedModuleNumber,
          moduleMention: resolvedModuleMention
        };
      });

      // Convert clean assignments into Assignment objects
      const newAssignments: Assignment[] = cleanAssignmentsList
        .filter(a => !isInvalidAssignmentTitle(a.title))
        .map((a, aIdx) => {
          const resolvedWeek = a.weekNumber || 0;
          return sanitizeAssignment({
            ...a,
            id: `a-${Date.now()}-${aIdx}`,
            courseCode: effectiveCourseCode,
            sourceDocumentName: fileName,
            sourceDocumentId: vaultDocId,
            docColorHex: targetCourse?.hexColor || hexColor,
            courseId: courseId,
            moduleMention: a.moduleMention || (resolvedWeek > 0 ? `Week ${resolvedWeek}` : undefined),
            relevantTopics: a.relevantTopics || (resolvedWeek > 0 ? `Week ${resolvedWeek}` : undefined)
          });
        });

      const maxWeek = Math.max(
        ...newReadings.map(r => r.weekNumber || 1),
        ...newAssignments.map(a => a.weekNumber || 1),
        targetCourse?.termWeeks || normalized.termWeeks || 1,
        1
      );

      const courseWeeks: Week[] = [];
      for (let w = 1; w <= maxWeek; w++) {
        const weekReadings = newReadings.filter(r => (r.weekNumber || 0) === w);
        const foundWeek = (normalized.weeks as any[])?.find((dw: any) => dw.weekNumber === w);
        const foundTheme = cleanAcademicWeekTheme(foundWeek?.theme) || `Week ${w}`;
        const foundDate = foundWeek?.startDate
          ? parseSafeDate(foundWeek.startDate)
          : (foundWeek?.date ? parseSafeDate(foundWeek.date) : null);
        const foundModNum = (foundWeek as any)?.moduleNumber || (weekReadings.find(r => r.moduleNumber)?.moduleNumber) || null;
        const foundModMention = (foundWeek as any)?.moduleMention || (foundModNum ? `Module ${foundModNum}` : null);
        courseWeeks.push({
          id: `w-${w}`,
          weekNumber: w,
          theme: foundTheme,
          startDate: foundDate,
          dateRangeStr: foundWeek?.dateRangeStr || null,
          moduleNumber: foundModNum,
          moduleMention: foundModMention,
          courseId,
          readings: weekReadings
        });
      }

      const finalCourse: Course = {
        id: courseId,
        creatorId: targetCourse?.creatorId || 'user-self',
        courseName: effectiveCourseName,
        courseCode: effectiveCourseCode,
        courseDescription: targetCourse?.courseDescription || normalized.courseDescription || `Imported from ${fileName}.`,
        instructorName: targetCourse?.instructorName || normalized.instructorName || null,
        instructorEmail: targetCourse?.instructorEmail || normalized.instructorEmail || null,
        officeHours: targetCourse?.officeHours || normalized.officeHours || dto?.officeHours || null,
        externalScheduleNotice: targetCourse?.externalScheduleNotice || normalized.externalScheduleNotice || (dto?.externalScheduleNotice ?? null),
        gradingScale: targetCourse?.gradingScale || normalized.gradingScale || (dto?.gradingScale ?? null),
        gradingScaleRows: targetCourse?.gradingScaleRows || normalized.gradingScaleRows || (dto?.gradingScaleRows ?? null),
        hexColor: targetCourse?.hexColor || hexColor,
        termWeeks: maxWeek,
        sharingCode: targetCourse?.sharingCode || String(Math.floor(100000 + Math.random() * 900000)),
        isDeleted: false,
        isFavorite: true,
        createdAt: targetCourse?.createdAt || new Date(),
        weeks: courseWeeks,
        assignments: newAssignments,
        syllabusDocs: targetCourse?.syllabusDocs || [],
        textbooks: (normalized.textbooks && normalized.textbooks.length > 0)
          ? normalized.textbooks
          : (dto?.textbooks && dto.textbooks.length > 0 ? dto.textbooks : (targetCourse?.textbooks || []))
      };

      // Add VaultDocument with visual page images & real file URI
      const newVaultDoc: VaultDocument = {
        id: vaultDocId,
        title: formatShortDocumentTitle(fileName),
        category: 'Syllabi',
        fileSize: fileSize || '1.4 MB',
        fileType: fileName.split('.').pop()?.toUpperCase() || 'PDF',
        courseCode: effectiveCourseCode,
        courseId: courseId,
        fileContent: rawText.slice(0, 5000),
        docColorHex: finalCourse.hexColor,
        rawFileDataUri: persistentFileUri || fileUri || effectiveFileUri || null,
        pageImages: renderedPageImageUris.length > 0 ? renderedPageImageUris : null,
        uploadedAt: new Date()
      };

      // Handle Reimport Reconciliation vs New Course
      let updatedCourses: Course[];
      let updatedReadings: Reading[];
      let updatedAssignments: Assignment[];
      let updatedVaultDocs: VaultDocument[];

      if (targetCourse) {
        const reconciled = SyllabusImportManager.shared.mergeReimportedCourse({
          targetCourseId: targetCourse.id,
          existingCourses: coursesRef.current,
          existingReadings: readingsRef.current,
          existingAssignments: assignmentsRef.current,
          existingVaultDocs: vaultDocsRef.current,
          newCourseData: finalCourse,
          newReadings,
          newAssignments,
          newVaultDoc
        });
        updatedCourses = reconciled.updatedCourses;
        updatedReadings = reconciled.updatedReadings;
        updatedAssignments = reconciled.updatedAssignments;
        updatedVaultDocs = reconciled.updatedVaultDocs;
      } else {
        updatedCourses = [finalCourse, ...coursesRef.current];
        updatedReadings = [...newReadings, ...readingsRef.current];
        updatedAssignments = [...newAssignments, ...assignmentsRef.current];
        updatedVaultDocs = [newVaultDoc, ...vaultDocsRef.current];
      }

      // Construct and persist DiagnosticImportRecord
      const rawTextBytes = rawText ? rawText.length : 0;
      const pdfBytes = base64Pdf ? Math.round((base64Pdf.length * 3) / 4) : 0;
      const calcByteCount = pdfBytes > 0 ? pdfBytes : rawTextBytes;

      let localHash = '';
      let hashNum = 0;
      const hashTarget = rawText || fileName;
      for (let i = 0; i < hashTarget.length; i++) {
        hashNum = ((hashNum << 5) - hashNum) + hashTarget.charCodeAt(i);
        hashNum |= 0;
      }
      localHash = Math.abs(hashNum).toString(16).padStart(16, '0');

      const hasReadablePayload = Boolean(rawText || base64Pdf || renderedPageBase64.length > 0);

      // Determine outcome honestly
      const outcomeDetails = SyllabusImportManager.shared.determineImportOutcome({
        fileName,
        hasReadablePayload,
        isApiSuccess: Boolean(aiHasData),
        isFallbackUsed: false,
        isPartial: normalized.isPartial,
        readingsCount: newReadings.length,
        assignmentsCount: newAssignments.length,
        saveSuccess: true,
        errorMessage: undefined
      });

      const diagRecord: DiagnosticImportRecord = {
        importId: `diag-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        appBuildVersion: '2.0.0 (Build 42)',
        documentHash: localHash,
        receivedByteCount: calcByteCount,
        parserSource: 'LOCAL_DETERMINISTIC',
        providerModel: 'on-device-engine',
        responseStatus: outcomeDetails.success ? 'SUCCESS' : 'FAILED',
        fallbackReason: null,
        extractedCounts: {
          assignments: newAssignments.length,
          readings: newReadings.length,
          weeks: courseWeeks.length,
          textbooks: normalized.textbooks.length
        },
        saveOutcome: 'SAVED_TO_DISK',
        timestamp: new Date().toISOString()
      };

      setLatestDiagnosticRecord(diagRecord);
      persistenceManager.setLastDiagnosticRecord(diagRecord);

      // Persist to disk backup asynchronously in background with diagnostic record
      await persistenceManager.saveImmediate({
        courses: updatedCourses,
        readings: updatedReadings,
        assignments: updatedAssignments,
        vaultDocs: updatedVaultDocs,
        diagnosticRecord: diagRecord
      });

      // Ensure minimum display duration so the user sees the loading bar and message telling them to wait
      const elapsed = Date.now() - importStartTime;
      const minDisplayMs = 3200; // 3.2s graceful display window
      if (elapsed < minDisplayMs) {
        currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.90);
        setUploadProgress(0.90);
        setUploadStatusText('Organizing your schedule, please wait...');
        const pause1 = Math.min(800, minDisplayMs - elapsed);
        await new Promise(r => setTimeout(r, pause1));

        currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.96);
        setUploadProgress(0.96);
        setUploadStatusText('Setting up your course, please wait...');
        const remaining = minDisplayMs - (Date.now() - importStartTime);
        if (remaining > 0) {
          await new Promise(r => setTimeout(r, remaining));
        }
      }

      clearInterval(progressTimer);
      setUploadProgress(1.0);

      if (outcomeDetails.success) {
        // Step 1: The course is actually fully loaded. Display the Success state in the blue pill first
        setUploadStatusText('Success! Course ready');
        await new Promise(r => setTimeout(r, 1200));

        // Step 2: Clear upload job before state commit so no async pause interrupts rendering
        await persistenceManager.clearPendingUploadJob();

        // Step 3: Now that the course is fully loaded and the blue pill has said success,
        // atomically transition out of uploading state AND put the course up in state together in one batched frame!
        coursesRef.current = updatedCourses;
        readingsRef.current = updatedReadings;
        assignmentsRef.current = updatedAssignments;
        vaultDocsRef.current = updatedVaultDocs;

        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
        isImportingRef.current = false;

        setCourses(updatedCourses);
        setReadings(updatedReadings);
        setAssignments(updatedAssignments);
        setVaultDocs(updatedVaultDocs);
        setSelectedCourseFilter(finalCourse);

        setImportBanner({
          type: isFallbackUsed || normalized.isPartial ? 'warning' : 'success',
          title: isFallbackUsed ? 'Extracted (Offline / Fast Fallback)' : `Imported ${finalCourse.courseCode || finalCourse.courseName}`,
          message: outcomeDetails.message || `Added ${newReadings.length} readings & ${newAssignments.length} assignments.`
        });
      } else {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
        isImportingRef.current = false;
      }

      // Allow UI layout and course cards to render smoothly before launching confetti
      await new Promise(r => setTimeout(r, 250));

      // Strictly suppress celebration confetti on local fallback or partial extraction
      if (outcomeDetails.celebrationAllowed && !isFallbackUsed && !normalized.isPartial) {
        triggerConfetti(`Extracted ${finalCourse.courseCode || finalCourse.courseName}! Added ${newReadings.length} readings & ${newAssignments.length} assignments.`);
      }

      return {
        success: outcomeDetails.success,
        outcome: outcomeDetails.outcome,
        course: finalCourse,
        message: outcomeDetails.message,
        readingsCount: newReadings.length,
        assignmentsCount: newAssignments.length
      };
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatusText('');
      console.error('Failed to import syllabus:', err);

      setImportBanner({
        type: 'error',
        title: 'Import Failed',
        message: err.message || 'Failed to parse syllabus document.'
      });

      const errDiag: DiagnosticImportRecord = {
        importId: `diag-err-${Date.now()}`,
        appBuildVersion: '2.0.0 (Build 42)',
        documentHash: '00000000',
        receivedByteCount: 0,
        parserSource: 'LOCAL_DEVICE_FALLBACK',
        providerModel: null,
        responseStatus: 'FAILED',
        fallbackReason: err.message || 'Unknown import failure',
        extractedCounts: { assignments: 0, readings: 0, weeks: 0, textbooks: 0 },
        saveOutcome: 'SAVE_FAILED',
        timestamp: new Date().toISOString()
      };
      setLatestDiagnosticRecord(errDiag);

      return {
        success: false,
        message: err.message || 'Failed to parse syllabus document.'
      };
    } finally {
      clearInterval(progressTimer);
      isImportingRef.current = false;
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
      await persistenceManager.clearPendingUploadJob();
      await endBackgroundTask('SyllabusUpload');
    }
  }, [courses, triggerConfetti, setSelectedTab, isUploading]);

  const cancelUpload = useCallback(async () => {
    isImportingRef.current = false;
    lastImportStartTimeRef.current = 0;
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatusText('');
    await persistenceManager.clearPendingUploadJob();
    await endBackgroundTask('SyllabusUpload');
  }, []);

  const startUploadSimulation = useCallback((fileName: string, targetCourseId?: string) => {
    importSyllabusDocument({ fileName, targetCourseId });
  }, [importSyllabusDocument]);

  const turnOffAllWeeks = useCallback(() => {
    setReadings(prev => prev.map(r => ({ ...r, weekId: undefined, weekNumber: 0 })));
    setAssignments(prev => prev.map(a => ({ ...a, weekNumber: 0 })));
    persistenceManager.saveImmediate({
      courses: coursesRef.current,
      readings: readingsRef.current.map(r => ({ ...r, weekId: undefined, weekNumber: 0 })),
      assignments: assignmentsRef.current.map(a => ({ ...a, weekNumber: 0 })),
      vaultDocs: vaultDocsRef.current
    });
  }, []);

  const isResumingUploadRef = useRef<boolean>(false);

  const checkAndResumeInterruptedUpload = useCallback(async () => {
    if (isResumingUploadRef.current || isUploading || isImportingRef.current) return;

    isResumingUploadRef.current = true;
    try {
      const job = await persistenceManager.loadPendingUploadJob();
      if (!job) return;

      // Discard and delete stale jobs older than 3 minutes to avoid zombie resume loops
      const ageMs = Date.now() - (job.timestamp || 0);
      if (ageMs > 180000 || !job.timestamp) {
        console.warn('Discarding stale pending upload job (age > 3 min):', job.fileName);
        await persistenceManager.clearPendingUploadJob();
        return;
      }

      const targetPath = job.persistentFileUri || job.fileUri;
      let textToParse = job.rawText || '';
      if (!textToParse && targetPath) {
        try {
          textToParse = await extractTextFromPDF(targetPath);
        } catch {}
      }

      if (!textToParse && !targetPath) {
        await persistenceManager.clearPendingUploadJob();
        return;
      }

      setUploadStatusText(`Resuming schedule setup for ${job.fileName}...`);

      try {
        await importSyllabusDocument({
          fileName: job.fileName,
          rawText: textToParse,
          fileUri: targetPath,
          fileSize: job.fileSize,
          targetCourseId: job.targetCourseId,
          preferredHexColor: job.preferredHexColor
        });
      } finally {
        await persistenceManager.clearPendingUploadJob();
      }
    } catch (e) {
      console.warn('checkAndResumeInterruptedUpload error:', e);
      await persistenceManager.clearPendingUploadJob();
    } finally {
      isResumingUploadRef.current = false;
    }
  }, [importSyllabusDocument, isUploading]);

  return (
    <CoursePalContext.Provider
      value={{
        courses,
        readings,
        assignments,
        vaultDocs,
        selectedTab,
        selectedCourseFilter,
        isUploading,
        uploadStatusText,
        uploadProgress,
        hasAcceptedTerms,
        hasLoadedTerms,
        showConfetti,
        confettiTitle,
        latestDiagnosticRecord,
        importBanner,
        dismissImportBanner,
        setSelectedTab,
        setSelectedCourseFilter,
        toggleReading,
        toggleAssignment,
        updateAssignment,
        updateReading,
        restoreAssignment,
        restoreReading,
        emptyTrash,
        emptyReadingsTrash,
        emptyAssignmentsTrash,
        permanentlyDeleteReading,
        permanentlyDeleteAssignment,
        deleteReading,
        deleteAssignment,
        deleteCourse,
        deleteVaultDoc,
        addCourse,
        updateCourse,
        addTask,
        importShareCode,
        acceptTerms,
        importSyllabusDocument,
        startUploadSimulation,
        triggerConfetti,
        dismissConfetti,
        turnOffAllWeeks,
        checkAndResumeInterruptedUpload,
        cancelUpload
      }}
    >
      {children}
    </CoursePalContext.Provider>
  );
};

export const useCoursePal = (): CoursePalContextType => {
  const context = useContext(CoursePalContext);
  if (!context) {
    throw new Error('useCoursePal must be used within a CoursePalProvider');
  }
  return context;
};
