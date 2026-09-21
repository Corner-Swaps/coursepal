import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { Course, Week, Reading, Assignment, VaultDocument, MediaType, ImportOutcome, DiagnosticImportRecord } from '../types/models';
import { MasterCoursePalette } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import { persistenceManager } from '../services/DataPersistenceBackupManager';
import { LocalSyllabusParser } from '../services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../utils/syllabusCatalog';
import cityuSyllabi from '../utils/cityu_syllabi_texts.json';
import { APIService } from '../services/APIService';
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
import { extractTextFromPDF, renderPDFPages, extractTextFromDocxBase64 } from '../services/PDFTextExtractor';
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
  if (cleanPts && /^\d+$/.test(cleanPts)) {
    cleanPts = `${cleanPts} Pts`;
  }
  let cleanWeight = a.weightPercentage ? a.weightPercentage.trim() : null;
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

  // Guard against fabricated 100 points or points fabricated from weight percentage
  if (cleanPts) {
    if (/^\s*100\s*(?:pts?|points)?\s*$/i.test(cleanPts) && ((a.courseCode || '').toUpperCase().includes('CPC') || (a.title && /assessment and intervention|family mapping|case conceptualization/i.test(a.title)))) {
      cleanPts = null;
    }
  }
  if (cleanPts && cleanWeight) {
    const wtNum = cleanWeight.replace(/[^0-9]/g, '');
    const ptNum = cleanPts.replace(/[^0-9]/g, '');
    if (wtNum && ptNum && wtNum === ptNum) {
      const combinedText = `${cleanTitle} ${cleanInstr || ''} ${cleanNotes || ''}`.toLowerCase();
      const hasRealPointsMention = /\b\d{1,4}\s*(?:points|pts|pt)\b/i.test(combinedText);
      const hasRubricPoints = (a.rubricCriteria || []).some(r => r.points && r.points > 0);
      const isDecimalScale = (a.courseCode || '').toUpperCase().includes('PSYC') || cleanTitle.toLowerCase().includes('psyc');
      if (!hasRealPointsMention && !hasRubricPoints && !isDecimalScale) {
        cleanPts = null;
      }
    }
  }

  return {
    ...a,
    title: cleanTitle,
    dueDate: cleanDueDate,
    pointsPossible: cleanPts,
    weightPercentage: cleanWeight,
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

export const isGenericToken = (t?: string | null) =>
  !t || /^(new|new course|new cou|reading|assignment|crs|gen\s*101)$/i.test(t.trim());

export const isStubOrFileName = (n?: string | null) =>
  !n || isGenericToken(n) || /syllabus$/i.test(n.trim()) || /_syllabus$/i.test(n.trim());

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
    const isPsyc = id.includes('psyc') || id.includes('612');
    const pdfFileName = isPsyc ? 'PSYC612_Advanced_CBT_Interventions.pdf' : 'CPC527_Group_Counselling_Syllabus.pdf';
    const initialPdfUri = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}syllabi/${pdfFileName}` : null;

    allVaultDocs.push({
      id: `vd-${id}-syllabus`,
      title: formatShortDocumentTitle(fileName),
      category: 'Syllabi',
      fileSize: cpcItem.fileSize || (isPsyc ? '410 KB' : '480 KB'),
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
  assignments: Assignment[]
): { courses: Course[]; readings: Reading[]; assignments: Assignment[] } {
  const cleanCourses = [...courses];
  let rawReadings = [...readings];
  let rawAssignments = [...assignments];

  const cpc512Course = cleanCourses.find(c =>
    (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC512' ||
    (c.courseName || '').toLowerCase().includes('family systems')
  );
  if (!cpc512Course) {
    return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments };
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
  const hasUnfabricatedPoints = !cpcAssignmentsExisting.some(a =>
    Boolean(a.pointsPossible && (/^\s*100\s*(?:pts?|points)?\s*$/i.test(a.pointsPossible) || Boolean(a.weightPercentage)))
  );
  const hasCleanWeeklyTitles = !cpcWeeklyReadings.some(r =>
    (r.title || '').includes('· Evidence Based Practice') ||
    (r.title || '').includes('· Evidenced-Based Practice') ||
    (r.title || '').includes('· Case Conceptualization')
  );
  const needsHealing =
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
    cpcReadings.forEach(r => {
      if (r.isCompleted && r.weekNumber) completedWeeks.add(r.weekNumber);
    });

    rawReadings = rawReadings.filter(r =>
      r.courseId ? r.courseId !== cpc512Course.id : (r.courseCode || '').replace(/\s+/g, '').toUpperCase() !== 'CPC512'
    );

    // Canonical Weekly Schedule Readings (Weeks 1..12 Calendar Schedule with Module Mappings)
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

  return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments };
}

export function healCanonicalCPC527(
  courses: Course[],
  readings: Reading[],
  assignments: Assignment[]
): { courses: Course[]; readings: Reading[]; assignments: Assignment[] } {
  const cleanCourses = [...courses];
  let rawReadings = [...readings];
  let rawAssignments = [...assignments];

  const cpc527Course = cleanCourses.find(c =>
    (c.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'CPC527' ||
    (c.courseName || '').toLowerCase().includes('group counselling') ||
    c.id === 'c-1789827902676'
  );
  if (!cpc527Course) {
    return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments };
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

  return { courses: cleanCourses, readings: rawReadings, assignments: rawAssignments };
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

        // If user has old dummy seed courses (cpc-514, cpc-523, cpc-511), filter them out so they don't clutter the view
        const isLegacyDummySeed = (id: string) => /^c-cpc-(514|523|511)-active$/.test(id);
        cleanCourses = cleanCourses.filter(c => !isLegacyDummySeed(c.id));

        // Deduplicate courses if user previously imported the same course/syllabus twice
        const deduplicatedCourses: Course[] = [];
        const seenCourseKeys = new Map<string, Course>();
        for (const c of cleanCourses) {
          const codeKey = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
          const nameKey = (c.courseName || '').trim().toLowerCase();
          const key = codeKey || nameKey;
          if (key && !isGenericToken(key)) {
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

        // Deduplicate Vault Documents so the same syllabus is never loaded twice
        const seenDocs = new Set<string>();
        cleanVaultDocs = cleanVaultDocs.filter(vd => {
          const docKey = `${(vd.courseCode || '').toUpperCase()}_${(vd.title || '').toLowerCase()}`;
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
          // If user has 0 courses stored, seed default courses (PSYC 612 and CPC 527)
          const defaultSeed = createDefaultCoursesSeed();
          cleanCourses = defaultSeed.courses;
          rawReadings = defaultSeed.readings;
          rawAssignments = defaultSeed.assignments;
          cleanVaultDocs = defaultSeed.vaultDocs;
        }

        // Heal existing CPC 512 course in storage to canonical modules if it contains old un-reconciled reading patterns
        const cpcHealed = healCanonicalCPC512(cleanCourses, rawReadings, rawAssignments);
        cleanCourses = cpcHealed.courses;
        rawReadings = cpcHealed.readings;
        rawAssignments = cpcHealed.assignments;

        // Heal existing CPC 527 course in storage to canonical syllabus if empty or incomplete
        const cpc527Healed = healCanonicalCPC527(cleanCourses, rawReadings, rawAssignments);
        cleanCourses = cpc527Healed.courses;
        rawReadings = cpc527Healed.readings;
        rawAssignments = cpc527Healed.assignments;

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
        // Initial baseline disk save: seed default CityU courses
        const defaultSeed = createDefaultCoursesSeed();
        coursesRef.current = defaultSeed.courses;
        readingsRef.current = defaultSeed.readings;
        assignmentsRef.current = defaultSeed.assignments;
        vaultDocsRef.current = defaultSeed.vaultDocs;

        setCourses(defaultSeed.courses);
        setReadings(defaultSeed.readings);
        setAssignments(defaultSeed.assignments);
        setVaultDocs(defaultSeed.vaultDocs);

        persistenceManager.saveImmediate({
          courses: defaultSeed.courses,
          readings: defaultSeed.readings,
          assignments: defaultSeed.assignments,
          vaultDocs: defaultSeed.vaultDocs
        });

        // Background PDF hydration: ensure bundled PDF files exist on disk with rendered pages
        (async () => {
          try {
            const hydrated = await Promise.all(
              defaultSeed.vaultDocs.map(vd => hydrateVaultDocWithRealPdf(vd))
            );
            if (isMounted) {
              vaultDocsRef.current = hydrated;
              setVaultDocs([...hydrated]);
              persistenceManager.saveImmediate({
                courses: defaultSeed.courses,
                readings: defaultSeed.readings,
                assignments: defaultSeed.assignments,
                vaultDocs: hydrated
              });
            }
          } catch (e) {
            // Non-blocking
          }
        })();
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
    setReadings(prev =>
      prev.map(item => {
        if (item.id === id) {
          const nextVal = !item.isCompleted;
          if (nextVal) {
            triggerConfetti(`Completed: ${item.title}`);
          }
          return { ...item, isCompleted: nextVal };
        }
        return item;
      })
    );
  }, [triggerConfetti]);

  const toggleAssignment = useCallback((id: string) => {
    setAssignments(prev =>
      prev.map(item => {
        if (item.id === id) {
          const nextVal = !item.isCompleted;
          if (nextVal) {
            triggerConfetti(`Completed: ${item.title}`);
          }
          return { ...item, isCompleted: nextVal };
        }
        return item;
      })
    );
  }, [triggerConfetti]);

  const updateAssignment = useCallback((updated: Assignment) => {
    const sanitized = sanitizeAssignment(updated);
    setAssignments(prev => prev.map(a => (a.id === sanitized.id ? sanitized : a)));
  }, []);

  const updateReading = useCallback((updated: Reading) => {
    const sanitized = sanitizeReading(updated);
    setReadings(prev => prev.map(r => (r.id === sanitized.id ? sanitized : r)));
  }, []);

  const restoreAssignment = useCallback((id: string) => {
    setAssignments(prev => prev.map(a => (a.id === id ? { ...a, isDeleted: false } : a)));
  }, []);

  const restoreReading = useCallback((id: string) => {
    setReadings(prev => prev.map(r => (r.id === id ? { ...r, isDeleted: false } : r)));
  }, []);

  const emptyReadingsTrash = useCallback(() => {
    setReadings(prev => {
      const next = prev.filter(r => !r.isDeleted);
      persistenceManager.saveImmediate({
        courses,
        readings: next,
        assignments,
        vaultDocs
      });
      return next;
    });
  }, [courses, assignments, vaultDocs]);

  const emptyAssignmentsTrash = useCallback(() => {
    setAssignments(prev => {
      const next = prev.filter(a => !a.isDeleted);
      persistenceManager.saveImmediate({
        courses,
        readings,
        assignments: next,
        vaultDocs
      });
      return next;
    });
  }, [courses, readings, vaultDocs]);

  const permanentlyDeleteReading = useCallback((id: string) => {
    setReadings(prev => {
      const next = prev.filter(r => r.id !== id);
      persistenceManager.saveImmediate({
        courses,
        readings: next,
        assignments,
        vaultDocs
      });
      return next;
    });
  }, [courses, assignments, vaultDocs]);

  const permanentlyDeleteAssignment = useCallback((id: string) => {
    setAssignments(prev => {
      const next = prev.filter(a => a.id !== id);
      persistenceManager.saveImmediate({
        courses,
        readings,
        assignments: next,
        vaultDocs
      });
      return next;
    });
  }, [courses, readings, vaultDocs]);

  const emptyTrash = useCallback(() => {
    emptyReadingsTrash();
    emptyAssignmentsTrash();
  }, [emptyReadingsTrash, emptyAssignmentsTrash]);

  const deleteReading = useCallback((id: string) => {
    setReadings(prev => {
      const next = prev.map(r => (r.id === id ? { ...r, isDeleted: true } : r));
      persistenceManager.saveImmediate({
        courses,
        readings: next,
        assignments,
        vaultDocs
      });
      return next;
    });
  }, [courses, assignments, vaultDocs]);

  const deleteAssignment = useCallback((id: string) => {
    setAssignments(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, isDeleted: true } : a));
      persistenceManager.saveImmediate({
        courses,
        readings,
        assignments: next,
        vaultDocs
      });
      return next;
    });
  }, [courses, readings, vaultDocs]);

  const deleteCourse = useCallback((id: string) => {
    const courseToDelete = courses.find(c => c.id === id);

    const nextCourses = courses.filter(c => c.id !== id);
    const nextReadings = readings.filter(
      r => (courseToDelete ? !isItemForCourse(r, courseToDelete) : r.courseId !== id)
    );
    const nextAssignments = assignments.filter(
      a => (courseToDelete ? !isItemForCourse(a, courseToDelete) : a.courseId !== id)
    );
    const nextVaultDocs = vaultDocs.filter(
      v => (courseToDelete ? !isItemForCourse(v, courseToDelete) : (v.courseId ? v.courseId !== id : true))
    );

    setCourses(nextCourses);
    setReadings(nextReadings);
    setAssignments(nextAssignments);
    setVaultDocs(nextVaultDocs);

    persistenceManager.saveImmediate({
      courses: nextCourses,
      readings: nextReadings,
      assignments: nextAssignments,
      vaultDocs: nextVaultDocs
    });
  }, [courses, readings, assignments, vaultDocs]);

  const updateCourse = useCallback((updated: Course) => {
    setCourses(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  }, []);

  const deleteVaultDoc = useCallback((id: string) => {
    setVaultDocs(prev => prev.filter(d => d.id !== id));
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
    const course = courses.find(c => c.id === data.courseId) || courses[0];
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
      setReadings(prev => [sanitizeReading(newReading), ...prev]);
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
      setAssignments(prev => [newAssignment, ...prev]);
    }
  }, [courses]);

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

  const importSyllabusDocument = useCallback(async (params: ImportSyllabusParams) => {
    if (isImportingRef.current) {
      console.warn('Import already in progress, skipping duplicate invocation.');
      return { success: false, message: 'An import is already in progress.' };
    }
    isImportingRef.current = true;

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

        // Save pending upload job so if app is backgrounded/interrupted, it can be auto-recovered
        await persistenceManager.savePendingUploadJob({
          fileName,
          fileUri,
          persistentFileUri,
          fileSize,
          targetCourseId,
          preferredHexColor,
          rawText,
          timestamp: Date.now()
        });

        const effectiveFileUri = persistentFileUri || fileUri;

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
            cleanName === itemFile
          );
        });
        if (catalogMatch && catalogMatch.rawText) {
          rawText = catalogMatch.rawText;
        }
      }

      // Stage 2: Multimodal Syllabus Parsing
      setUploadStatusText('Processing coursework, please wait...');
      currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.25);

      let dto: any = null;
      let apiError: string | undefined = undefined;
      let isFallbackUsed = false;
      let normalized: any = null;
      const hasReadablePayload = Boolean(rawText || base64Pdf || renderedPageBase64.length > 0);

      // 1. Primary Engine: Multimodal AI Parsing (Gemini 3.5/3.6 Flash)
      if (hasReadablePayload) {
        try {
          const syllabusTextSnippet = rawText ? `\n\nExtracted Text Context:\n${rawText.slice(0, 150000)}` : '';
          const visualGuidance = renderedPageBase64.length > 0
            ? `\n\nVISUAL PAGE IMAGES ATTACHED:
You are provided with ${renderedPageBase64.length} high-resolution visual page images of this document.
Examine each page image directly. Use the visual tables, columns, headings, and layout to identify the exact course schedule, weekly module themes, required readings, textbook chapters, and assignment due dates.
Tables often have columns like (Week/Module | Topic | Required Readings | Deliverables). Ensure you associate the readings from each row with that specific week.`
            : '';
          const geminiPrompt = `Extract course details, schedule, textbooks, readings, and assignments from this syllabus into this JSON structure:
{
  "courseName": "Course Name",
  "courseCode": "Course Code (e.g. CPC 511)",
  "instructorName": "Instructor Name",
  "instructorEmail": "Instructor Email",
  "termWeeks": 12,
  "termYear": null,
  "textbooks": [
    {
      "title": "Full Book Title",
      "authorName": "Author Name(s)",
      "edition": "Edition if stated"
    }
  ],
  "assignments": [
    {
      "title": "Exact Assignment Title",
      "dueDate": "YYYY-MM-DD or null",
      "rawDueDate": "Text date if stated",
      "pointsPossible": "Total points (e.g. 100 Points)",
      "weightPercentage": "Weight (e.g. 20%)",
      "rubricCriteria": [
        { "criterionName": "Rubric criterion description", "points": 20 }
      ],
      "fullInstructions": "Instructions from document",
      "mediaUrl": "https://...",
      "weekNumber": 1,
      "scheduledWeeks": [5, 7, 8],
      "subType": "presentation",
      "noteText": "Presentations: Weeks 5, 7, 8"
    }
  ],
  "readings": [
    {
      "title": "Reading Title or Chapter Topic",
      "authorName": "Author Name(s)",
      "chapterText": "Chapter 1",
      "pagesText": "pp. 1-25",
      "mediaType": "textbook | video | podcast | article",
      "videoUrl": "https://...",
      "weekNumber": 1,
      "moduleNumber": 1,
      "moduleMention": "Module 1",
      "dueDate": "YYYY-MM-DD or null",
      "isRequired": true,
      "requirementType": "required"
    }
  ],
  "moduleReadings": [
    {
      "title": "Module Topic or Reading Title",
      "authorName": "Author Name(s)",
      "chapterText": "Chapter 1",
      "pagesText": "pp. 1-25",
      "mediaType": "textbook | video | podcast | article",
      "moduleNumber": 1,
      "moduleMention": "Module 1",
      "dueDate": "YYYY-MM-DD or null",
      "isRequired": true,
      "requirementType": "required"
    }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "moduleNumber": 1,
      "moduleMention": "Module 1",
      "theme": "Weekly Topic / Session Focus",
      "date": "YYYY-MM-DD or null",
      "dateRangeStr": "Explicit date or range if stated (e.g. July 2/3 or Jul 2 – Jul 3)",
      "readings": [],
      "assignments": []
    }
  ]
}

EXTRACTION RULES:
1. ASSIGNMENTS & DELIVERABLES:
   - Extract all major assignments, projects, papers, and percentage weights from the "Overview of Required Assignments" or grading policy table.
   - CRITICAL - CHECK SCHEDULE TABLES FOR DELIVERABLES: In weekly schedule tables, examine all columns (e.g. "Deliverables", "Due Date", "Assignments", "Tasks", or notes like "Due: Family Mapping Papers", "In-class case conceptualization worth 20%", "Midterm Exam", "Quiz"). Extract every deliverable into "assignments" with its exact weekNumber, weightPercentage, and dueDate. Never omit a deliverable because it appears in a schedule row!
   - DELIVERABLE FORMATS & NOTES: If an assignments table or specifications list includes a "Deliverable Format" column or description (e.g. "Weekly Case Contributions & Diagnostic Briefs", "10–12 Page Full Diagnostic Report & Table", "Timed standardized administration"), extract this exact string into "noteText" and "fullInstructions" so students immediately see their required format.
   - NEVER INVENT OR FABRICATE POINTS: If an assignment specifies a percentage weight (e.g. 20%, 30%), record "weightPercentage". Leave "pointsPossible" null unless the document explicitly states a total points scale for that assignment. Never convert weight percentages into points, never invent "100 Points", and NEVER sum rubric criteria percentages into "pointsPossible".
   - RUBRICS: Do NOT create separate assignment items from rubric grading criteria rows; nest rubric criteria rows into "rubricCriteria" of the parent assignment with criterionName and points.
   - SEMESTER-LONG / CONTINUOUS GRADES: For continuous components like Collaboration, Attendance, or Participation evaluated across the semester, set "weekNumber": null and "dueDate": null. NEVER schedule continuous items into a single week and NEVER schedule assignments during break weeks.
2. WEEKS & CALENDAR DATES:
   - For every week in the weekly schedule, extract the exact calendar date or date range string into "dateRangeStr" (e.g. "July 2/3", "Jul 2 – Jul 3", "Sep 3/4").
   - Extract the full session focus / topic into "theme" (e.g. "Creating a caring community / Introduction to Family Systems / Course overview"). Never leave "theme" blank or generic when a topic is stated.
   - Clean theme: Strip notes like "(group presentations)" from the "theme" string when a presentation deliverable card is scheduled that week.
   - READING WEEKS & BREAKS: If a week indicates "Reading Week", "Spring Break", or "No Classes", record theme as "Reading Week – No Class" and ensure 0 readings and 0 assignments are placed in that week.
   - For "date", use strict YYYY-MM-DD only when an explicit calendar date exists; otherwise null. Never invent dates.
3. MODULES & CURRICULUM:
   - ALWAYS EXTRACT MODULE NUMBERS: Whenever a syllabus organizes topics into modules, sessions, or curriculum units, extract "moduleNumber" (e.g. 1, 2, 3...) and "moduleMention" (e.g. "Module 1") on BOTH "weeks" and "readings".
   - UNIFIED WEEKLY-MODULE SCHEDULE: When a syllabus has a schedule table where rows list both a Week and a Module (e.g. "Week 01", "Module 01"), extract each row into "weeks" (and "readings") with BOTH "weekNumber": 1 and "moduleNumber": 1. Leave "moduleReadings": [] EMPTY! Do NOT extract duplicate items into both "readings" and "moduleReadings".
   - DUAL / STANDALONE MODULES TABLE: ONLY populate "moduleReadings" when the syllabus document has two completely distinct tables: an independent curriculum modules table (e.g. Table 1: Modules 1–10 with curriculum themes) AND a separate weekly calendar schedule table (e.g. Table 2: Weekly Schedule Weeks 1–12).
   - When a separate curriculum modules table exists, extract ALL modules into "moduleReadings" with their moduleNumber (e.g. Modules 1 through 10) and full module topic name in "title".
4. TEXTBOOKS & READINGS:
   - Extract required textbooks to "textbooks". Link reading chapters back to their textbook author and title.
   - CRITICAL - SPLIT MULTIPLE READINGS PER ROW / CELL (SEMICOLONS & MULTIPLE CITATIONS):
     Whenever a schedule row, table cell, or reading list contains multiple books, articles, or citations separated by semicolons (`;`), commas, line breaks, or distinct citation blocks:
     You MUST recognize that EVERY semicolon (`;`) indicates a brand new, separate reading, and you MUST emit an independent reading object in the JSON array for EACH reading!
   - CRITICAL - REQUIRED VS. OPTIONAL READINGS:
     Identify whether readings are required or optional:
     - Readings introduced by "Required:" (or listed in a "Required Readings" column or section) MUST have "isRequired": true and "requirementType": "required".
     - Readings introduced by "Optional:", "Recommended:", or "Supplemental:" (or in an Optional section) MUST have "isRequired": false and "requirementType": "optional".
     - Strip "Required:" and "Optional:" prefixes from the reading title string.
     - Extract any URL (e.g. http://... or https://...) into "videoUrl" or media link, and DO NOT leave raw URLs inside the title string!

     CONCRETE 4-READING CITATION EXAMPLE:
     Given this syllabus text:
     "Required: Wada & Fellner, 2025; Maddux & Winstead, (2019): Ch 1&2, 4-6; DSM 5-TR: Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859. Optional: World Health Organization (2010) ICD. http://www.who.int/classifications/icd/en."
     This contains FOUR distinct readings separated by semicolons and requirement headings:
       Object 1: { "title": "Wada & Fellner, 2025", "authorName": "Wada & Fellner", "chapterText": null, "isRequired": true, "requirementType": "required", "weekNumber": 1 }
       Object 2: { "title": "Maddux & Winstead, (2019): Ch 1&2, 4-6", "authorName": "Maddux & Winstead", "chapterText": "Chapters 1, 2, 4–6", "isRequired": true, "requirementType": "required", "weekNumber": 1 }
       Object 3: { "title": "DSM 5-TR: Section 1, Section 3 - Culture and Psychiatric Diagnosis pg. 859", "authorName": "DSM 5-TR", "chapterText": "Section 1, Section 3", "pagesText": "pg. 859", "isRequired": true, "requirementType": "required", "weekNumber": 1 }
       Object 4: { "title": "World Health Organization (2010) ICD", "authorName": "World Health Organization", "videoUrl": "http://www.who.int/classifications/icd/en", "mediaType": "article", "isRequired": false, "requirementType": "optional", "weekNumber": 1 }

     Example 2: Row lists "Lezak et al. (Ch. 1–3); Luria (Ch. 2)"
     MUST produce TWO distinct reading objects:
       Object 1: { "title": "Lezak et al. (Ch. 1–3)", "authorName": "Lezak et al.", "chapterText": "Chapters 1–3", "isRequired": true, "requirementType": "required", "weekNumber": 1 }
       Object 2: { "title": "Luria (Ch. 2)", "authorName": "Luria", "chapterText": "Chapter 2", "isRequired": true, "requirementType": "required", "weekNumber": 1 }
     Example 3: Row lists "Groth-Marnat (Ch. 4 & 5); Lichtenberger (Ch. 2)"
     MUST produce TWO distinct reading objects:
       Object 1: { "title": "Groth-Marnat (Ch. 4 & 5)", "authorName": "Groth-Marnat", "chapterText": "Chapters 4 & 5", "isRequired": true, "requirementType": "required", "weekNumber": 2 }
       Object 2: { "title": "Lichtenberger (Ch. 2)", "authorName": "Lichtenberger", "chapterText": "Chapter 2", "isRequired": true, "requirementType": "required", "weekNumber": 2 }
     Example 4: Standalone manuals or guidelines (e.g. "Lab Testing Manual & Scoring Protocols" or "APA Division 40 Ethics Guidelines"):
       Object: { "title": "Lab Testing Manual & Scoring Protocols", "authorName": null, "chapterText": null, "mediaType": "article", "isRequired": true, "requirementType": "required", "weekNumber": 8 }
     STRICT PROHIBITION: NEVER combine multiple authors into one author string (e.g. NEVER emit "authorName": "Lezak et al.; Luria" or "Groth-Marnat; Lichtenberger").
     STRICT PROHIBITION: NEVER discard the second, third, or fourth reading or its chapter/URL!
     STRICT PROHIBITION: NEVER set "title" to a bare chapter number like "Chapters 1–3"! When cited by author, set "title" to the citation e.g. "Lezak et al. (Ch. 1–3)" or the full book title.
   - DO NOT REPEAT SESSION THEMES IN READING TITLES: When a weekly schedule row lists a topic and reading (e.g. Topic "Evidence Based Practice..." and Reading "Gehart chapter 7"), record reading title cleanly as "Gehart (Chapter 7)" or "Diane R. Gehart". Do NOT append or concatenate the session topic into the reading title. The week's theme already represents the topic; repeating it creates redundant clutter.
   - Never leave parenthesized artifacts or dangling punctuation in titles (e.g. do NOT produce "· ( 3) –" or "(Chapters 1-3)" inside the title string).
5. NO GENERATED NOTES: Do NOT generate fake notes, takeaways, or summaries. Notes are strictly for students to write.
6. CLEANUP: Strip out institutional policies, student conduct codes, and generic university boilerplate. Extract media/video URLs cleanly.
7. PRESENTATIONS & GROUP DELIVERABLES (IN-CLASS PRESENTATIONS):
   - When schedule tables or session themes note "(group presentations)", "(presentations)", "Group Presentation", or in-class role plays across multiple weeks (e.g. Weeks 5, 7, and 8):
     a. Explicitly identify group deliverables (e.g. "Group Presentation / Project" or "Assessment and Intervention Presentation/Project").
     b. Extract all scheduled session weeks into "scheduledWeeks" (e.g. [5, 7, 8]) and set "weekNumber" to the first presentation week (e.g. 5).
     c. Set "noteText" to indicate the scheduled presentation window (e.g. "Group Presentations: Weeks 5, 7, 8").
     d. In "weeks[].assignments", include the presentation deliverable item in EACH scheduled presentation week (e.g. Weeks 5, 7, and 8) so students see upcoming presentation cards across each scheduled session in their weekly calendar.
     e. Extract full presentation instructions: group format ("small groups"), practical intervention scope, simulated video or in-class role-play requirements, facilitated class discussion, and peer feedback.
     f. Nest all rubric criteria (e.g. Oral Presentation, Diversity & Collaboration, Analysis & Concepts, Professional Ethics, Cultural Competence, Organization & Coherence).
     g. Set "subType" to "presentation".
${visualGuidance}
${syllabusTextSnippet}

Output ONLY valid JSON.`;

          // If base64Pdf is present, the model already gets the complete document.
          // Omit rendered page JPEGs to avoid a bloated 15-20MB payload causing mobile network timeouts.
          const imagesToSend = base64Pdf ? undefined : (renderedPageBase64.length > 0 ? renderedPageBase64.slice(0, 5) : undefined);
          const aiResult = await APIService.shared.generateContentWithGemini(
            geminiPrompt,
            rawText,
            base64Pdf,
            imagesToSend,
            fileName
          );
          dto = aiResult;
          normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
          isFallbackUsed = false;
        } catch (aiErr: any) {
          apiError = aiErr?.message || 'AI parsing failed';
          console.warn('AI parsing error:', aiErr);
        }
      }

      // 2. Dual-Engine Local Enrichment / Fallback: Extract deterministic rubrics and overview weights
      if (rawText && rawText.trim().length > 50) {
        try {
          const localDto = LocalSyllabusParser.shared.parseText(rawText);
          const hasAiData = normalized && (normalized.candidateAssignments.length > 0 || normalized.candidateReadings.length > 0);
          if (hasAiData) {
            // Enrich AI extraction with deterministic local parser (rubrics, overview weights, points)
            normalized = SyllabusImportManager.shared.enrichPayloadWithLocalExtraction(normalized, localDto);
          } else {
            // Primary AI unavailable or failed: Fall back completely to local parser
            const fallbackNormalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, rawText);
            if (fallbackNormalized.candidateAssignments.length > 0 || fallbackNormalized.candidateReadings.length > 0) {
              normalized = fallbackNormalized;
              dto = localDto;
              isFallbackUsed = true;
            }
          }
        } catch (localErr) {
          console.warn('Local parser enrichment/fallback error:', localErr);
        }
      }

      if (!normalized) {
        normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(null, rawText);
      }

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

      const isGenericToken = (t?: string | null) =>
        !t || /^(new|new course|new cou|reading|assignment|crs|gen\s*101)$/i.test(t.trim());
      const isStubOrFileName = (n?: string | null) =>
        !n || isGenericToken(n) || /syllabus$/i.test(n.trim()) || /_syllabus$/i.test(n.trim());

      const safePreserveCode = !isGenericToken(params.preserveCourseCode) ? params.preserveCourseCode : undefined;
      const safeDtoCode = !isGenericToken(normalized.courseCode) ? normalized.courseCode : undefined;
      const safeFallbackDtoCode = !isGenericToken(dto?.courseCode) ? dto?.courseCode : undefined;
      const fallbackCode = fileName.replace(/\.[^/.]+$/, '').slice(0, 8).toUpperCase();
      const courseCode = safePreserveCode || safeDtoCode || safeFallbackDtoCode || (isGenericToken(fallbackCode) ? undefined : fallbackCode);
      const courseName = params.preserveCourseTitle || normalized.courseName || dto?.courseName || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const hexColor = preferredHexColor || MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length];

      // Find or create course using coursesRef.current (avoids stale closures)
      let targetCourse = targetCourseId ? coursesRef.current.find(c => c.id === targetCourseId) : undefined;

      // If targetCourse was not explicitly specified, search for an existing course by course code,
      // course title, or matching syllabus document so uploading the same document or multiple copies from phone files
      // updates the existing course instead of creating duplicate courses and documents!
      if (!targetCourse) {
        const candidateCode = (courseCode || '').replace(/\s+/g, '').toUpperCase();
        const candidateName = (courseName || '').trim().toLowerCase();
        const cleanDocTitle = formatShortDocumentTitle(fileName).toLowerCase();
        const baseFileName = fileName.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

        targetCourse = coursesRef.current.find(c => {
          const cCode = (c.courseCode || '').replace(/\s+/g, '').toUpperCase();
          if (candidateCode && cCode && candidateCode === cCode) return true;

          const cName = (c.courseName || '').trim().toLowerCase();
          if (candidateName && cName && !isGenericToken(cName)) {
            if (candidateName === cName) return true;
          }

          // Check if this course already owns this document (matching title or filename)
          const hasMatchingDoc = vaultDocsRef.current.some(vd =>
            ((vd as any).courseId === c.id || (vd.courseCode && c.courseCode && vd.courseCode.toUpperCase() === c.courseCode.toUpperCase())) &&
            (vd.title?.toLowerCase() === cleanDocTitle || vd.title?.toLowerCase() === fileName.toLowerCase() || vd.title?.toLowerCase() === baseFileName)
          );
          if (hasMatchingDoc) return true;

          return false;
        });
      }

      const courseId = targetCourse ? targetCourse.id : `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const effectiveCourseCode = safePreserveCode || safeDtoCode || safeFallbackDtoCode || targetCourse?.courseCode || courseCode;
      const effectiveCourseName = params.preserveCourseTitle || (!isStubOrFileName(targetCourse?.courseName) ? targetCourse?.courseName : undefined) || normalized.courseName || dto?.courseName || targetCourse?.courseName || courseName;

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
        externalScheduleNotice: targetCourse?.externalScheduleNotice || normalized.externalScheduleNotice || (dto?.externalScheduleNotice ?? null),
        hexColor: targetCourse?.hexColor || hexColor,
        termWeeks: maxWeek,
        sharingCode: targetCourse?.sharingCode || String(Math.floor(100000 + Math.random() * 900000)),
        isDeleted: false,
        isFavorite: true,
        createdAt: targetCourse?.createdAt || new Date(),
        weeks: courseWeeks,
        assignments: newAssignments,
        syllabusDocs: targetCourse?.syllabusDocs || [],
        textbooks: normalized.textbooks
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
        rawFileDataUri: persistentFileUri || fileUri,
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

      // Check persistence results: do not report success until save succeeds!
      const saveSuccess = await persistenceManager.saveImmediate({
        courses: updatedCourses,
        readings: updatedReadings,
        assignments: updatedAssignments,
        vaultDocs: updatedVaultDocs
      });

      if (saveSuccess) {
        coursesRef.current = updatedCourses;
        readingsRef.current = updatedReadings;
        assignmentsRef.current = updatedAssignments;
        vaultDocsRef.current = updatedVaultDocs;
        setCourses(updatedCourses);
        setReadings(updatedReadings);
        setAssignments(updatedAssignments);
        setVaultDocs(updatedVaultDocs);
        setSelectedCourseFilter(finalCourse);
      }

      // Determine outcome honestly
      const outcomeDetails = SyllabusImportManager.shared.determineImportOutcome({
        fileName,
        hasReadablePayload,
        isApiSuccess: Boolean(aiHasData),
        isFallbackUsed,
        isPartial: normalized.isPartial,
        readingsCount: newReadings.length,
        assignmentsCount: newAssignments.length,
        saveSuccess,
        errorMessage: apiError
      });

      // Construct and persist DiagnosticImportRecord
      const lastDiag = APIService.shared.getLastDiagnostic();
      const rawTextBytes = rawText ? rawText.length : 0;
      const pdfBytes = base64Pdf ? Math.round((base64Pdf.length * 3) / 4) : 0;
      const calcByteCount = lastDiag?.receivedByteCount || (pdfBytes > 0 ? pdfBytes : rawTextBytes);

      let localHash = lastDiag?.documentHash;
      if (!localHash) {
        let hashNum = 0;
        const hashTarget = rawText || fileName;
        for (let i = 0; i < hashTarget.length; i++) {
          hashNum = ((hashNum << 5) - hashNum) + hashTarget.charCodeAt(i);
          hashNum |= 0;
        }
        localHash = Math.abs(hashNum).toString(16).padStart(16, '0');
      }

      const diagRecord: DiagnosticImportRecord = {
        importId: lastDiag?.diagnosticImportId || `diag-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        appBuildVersion: '2.0.0 (Build 42)',
        documentHash: localHash,
        receivedByteCount: calcByteCount,
        parserSource: isFallbackUsed ? 'LOCAL_DEVICE_FALLBACK' : (lastDiag?.parserSource || 'PROVIDER_AI'),
        providerModel: isFallbackUsed ? null : (lastDiag?.providerModel || 'gemini-2.5-flash'),
        responseStatus: outcomeDetails.success ? 'SUCCESS' : 'FAILED',
        fallbackReason: isFallbackUsed ? (apiError || 'Server AI unavailable; local device fallback used') : null,
        extractedCounts: {
          assignments: newAssignments.length,
          readings: newReadings.length,
          weeks: courseWeeks.length,
          textbooks: normalized.textbooks.length
        },
        saveOutcome: saveSuccess ? 'SAVED_TO_DISK' : 'SAVE_FAILED',
        timestamp: new Date().toISOString()
      };

      setLatestDiagnosticRecord(diagRecord);
      persistenceManager.setLastDiagnosticRecord(diagRecord);

      if (saveSuccess) {
        persistenceManager.saveImmediate({
          courses: updatedCourses,
          readings: updatedReadings,
          assignments: updatedAssignments,
          vaultDocs: updatedVaultDocs,
          diagnosticRecord: diagRecord
        });
      }

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
      setUploadStatusText('Course ready!');
      await new Promise(r => setTimeout(r, 600));

      setImportBanner({
        type: isFallbackUsed || normalized.isPartial ? 'warning' : 'success',
        title: isFallbackUsed ? 'Extracted (Offline / Fast Fallback)' : `Imported ${finalCourse.courseCode || finalCourse.courseName}`,
        message: outcomeDetails.message || `Added ${newReadings.length} readings & ${newAssignments.length} assignments.`
      });

      // Strictly suppress celebration confetti on local fallback or partial extraction
      if (outcomeDetails.celebrationAllowed && !isFallbackUsed && !normalized.isPartial) {
        triggerConfetti(`Extracted ${finalCourse.courseCode || finalCourse.courseName}! Added ${newReadings.length} readings & ${newAssignments.length} assignments.`);
      }

      setSelectedTab('syllabus');

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
  }, [courses, triggerConfetti, setSelectedTab]);

  const cancelUpload = useCallback(async () => {
    isImportingRef.current = false;
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
    if (isResumingUploadRef.current) return;
    isResumingUploadRef.current = true;
    try {
      const job = await persistenceManager.loadPendingUploadJob();
      if (!job) return;

      // If job was created less than 15s ago, it might still be running in the foreground
      if (Date.now() - job.timestamp < 15000) return;

      // Clear immediately to prevent repeat execution loops
      await persistenceManager.clearPendingUploadJob();

      const targetPath = job.persistentFileUri || job.fileUri;
      let textToParse = job.rawText || '';
      if (!textToParse && targetPath) {
        try {
          textToParse = await extractTextFromPDF(targetPath);
        } catch {}
      }

      if (!textToParse && !targetPath) return;

      setIsUploading(true);
      setUploadProgress(0.01);
      setUploadStatusText(`Resuming schedule setup for ${job.fileName}...`);

      await importSyllabusDocument({
        fileName: job.fileName,
        rawText: textToParse,
        fileUri: targetPath,
        fileSize: job.fileSize,
        targetCourseId: job.targetCourseId,
        preferredHexColor: job.preferredHexColor
      });
    } catch (e) {
      console.warn('checkAndResumeInterruptedUpload error:', e);
    } finally {
      isResumingUploadRef.current = false;
      setIsUploading(false);
      setUploadStatusText('');
      await persistenceManager.clearPendingUploadJob();
    }
  }, [importSyllabusDocument]);

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
