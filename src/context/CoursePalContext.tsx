import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Course, Week, Reading, Assignment, VaultDocument, MediaType, ImportOutcome, DiagnosticImportRecord, CourseDTO, RubricCriterionDTO } from '../types/models';
import { MasterCoursePalette } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import { persistenceManager } from '../services/DataPersistenceBackupManager';
import { LocalSyllabusParser } from '../services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../utils/syllabusCatalog';
import cityuSyllabi from '../utils/cityu_syllabi_texts.json';
import { SyllabusImportManager } from '../services/SyllabusImportManager';
import { FacultyExtractor } from '../services/FacultyExtractor';
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
  isItemForCourse,
  extractAllModuleNumbers,
  cleanAssignmentTitle,
  cleanDocumentTitle
} from '../utils/readingDisplayHelper';
import { weekNumberForDate } from '../utils/timeFormatters';
import { extractTextFromPDF, extractTextFromPDFContent, renderPDFPages, extractTextFromDocxBase64, extractLayoutFromPDF, needsVisionOCR } from '../services/PDFTextExtractor';
import { PageLayout, reconstructPage } from '../services/LayoutReconstructor';
import { runAIExtractionIfNeeded, PageText } from '../services/AIExtractionService';
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
  unacceptedAccuracyCourseIds: string[];
  activeAccuracyNotice: { courseId: string; courseName: string } | null;

  // Actions
  dismissImportBanner: () => void;
  acceptAccuracyNotice: (courseId?: string) => void;
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
  resetAllData: () => Promise<void>;
}

const CoursePalContext = createContext<CoursePalContextType | undefined>(undefined);

const initialCourses: Course[] = [];

export const isMockSeed = (id?: string | null): boolean => {
  if (!id) return false;
  return (
    id === 'c-cpc527-static-seed' ||
    id === 'c-seed-mock' ||
    id === 'c-cpc527' ||
    id.startsWith('c-seed-') ||
    id.startsWith('c-mock-') ||
    id.startsWith('c-sample-') ||
    id.endsWith('-active') ||
    id.endsWith('-canonical') ||
    id.includes('static-seed') ||
    /^c-cpc-(523|511|512|514|527)-active$/.test(id) ||
    /^c-psyc-612-active$/.test(id)
  );
};

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
  const rawTitle = a.title ? a.title.replace(/\|{2,}/g, ' - ').trim() : 'Assignment';
  const cleanTitle = cleanAssignmentTitle(rawTitle) || (cleanNotes ? cleanNotes.split('\n')[0].replace(/^•\s*/, '') : '') || rawTitle;

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
    assignmentNumberLabel: a.assignmentNumber ? (a.assignmentNumberLabel && !/assignment\s*\d+/i.test(a.assignmentNumberLabel) ? a.assignmentNumberLabel : `Task`) : null,
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
      courseDescription: parsed.courseDescription || '',
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
        moduleMention: a.moduleMention || undefined,
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
  const [acceptedAccuracyCourseIds, setAcceptedAccuracyCourseIds] = useState<string[]>([]);
  const [unacceptedAccuracyCourseIds, setUnacceptedAccuracyCourseIds] = useState<string[]>([]);
  const [activeAccuracyNotice, setActiveAccuracyNotice] = useState<{
    courseId: string;
    courseName: string;
  } | null>(null);

  const dismissImportBanner = useCallback(() => {
    setImportBanner(null);
  }, []);

  const acceptAccuracyNotice = useCallback((courseId?: string) => {
    setUnacceptedAccuracyCourseIds(prev => {
      const next = courseId ? prev.filter(id => id !== courseId) : [];
      return next;
    });
    setAcceptedAccuracyCourseIds(prev => {
      const next = courseId ? Array.from(new Set([...prev, courseId])) : [...prev, ...unacceptedAccuracyCourseIds];
      persistenceManager.saveAccuracyAccepted(next);
      return next;
    });
    if (!courseId || activeAccuracyNotice?.courseId === courseId) {
      setActiveAccuracyNotice(null);
    }
  }, [activeAccuracyNotice, unacceptedAccuracyCourseIds]);

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

    persistenceManager.loadAccuracyAccepted().then(acceptedIds => {
      if (!isMounted) return;
      if (Array.isArray(acceptedIds)) {
        setAcceptedAccuracyCourseIds(acceptedIds);
      }
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
          .filter(r => !r.id?.startsWith('r-seed-') && !r.id?.startsWith('r-mock-') && !isMockSeed(r.courseId) && !isMockSeed(r.id) && !isSyntheticReading(r))
          .map(r => {
            const sanitized = sanitizeReading(r);
            if (isGenericPlaceholderTheme(sanitized.relevantTopics)) {
              sanitized.relevantTopics = undefined;
            }
            return sanitized;
          });
        let rawAssignments = (Array.isArray(backup.assignments) ? backup.assignments : [])
          .filter(a => !a.id?.startsWith('a-seed-') && !a.id?.startsWith('a-mock-') && !isMockSeed(a.courseId) && !isMockSeed(a.id) && !isSyntheticAssignment(a))
          .map(a => sanitizeAssignment(a));
        let cleanVaultDocs = (Array.isArray(backup.vaultDocs) ? backup.vaultDocs : [])
          .filter(vd => vd.id !== 'vd-cpc527-static-seed' && !vd.id?.startsWith('vd-seed-') && !vd.id?.startsWith('vd-mock-') && !isMockSeed((vd as any).courseId) && !isMockSeed(vd.id))
          .map(vd => ({
            ...vd,
            title: formatShortDocumentTitle(vd.title),
            uploadedAt: parseSafeDate(vd.uploadedAt) || new Date()
          }));

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
        // Preserve all genuine user courses; never drop a user course just because it has no readings yet
        cleanCourses = deduplicatedCourses.filter(c => {
          if (isMockSeed(c.id)) return false;
          return Boolean(
            (c.courseCode && !isGenericToken(c.courseCode)) ||
            (c.courseName && !isGenericToken(c.courseName))
          );
        });

        // Deduplicate Vault Documents so the same syllabus is never loaded twice for the same course
        const seenDocs = new Set<string>();
        cleanVaultDocs = cleanVaultDocs.filter(vd => {
          const safeCode = vd.courseCode && !isGenericToken(vd.courseCode) ? vd.courseCode.toUpperCase() : '';
          const docKey = `${vd.courseId || safeCode || 'doc'}_${(vd.title || '').toLowerCase()}`;
          if (seenDocs.has(docKey)) return false;
          seenDocs.add(docKey);
          return true;
        });

        // If no courses remain, clean out any orphaned items
        if (cleanCourses.length === 0) {
          rawReadings = [];
          rawAssignments = [];
          cleanVaultDocs = [];
        } else {
          rawReadings = rawReadings.filter(r => cleanCourses.some(c => isItemForCourse(r, c)));
          rawAssignments = rawAssignments.filter(a => cleanCourses.some(c => isItemForCourse(a, c)));
          cleanVaultDocs = cleanVaultDocs.filter(d => cleanCourses.some(c => isItemForCourse(d, c)));
        }

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
// All canonical heals retired
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

  // Flush latest state to disk immediately whenever app is backgrounded or becomes inactive
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        persistenceManager.saveImmediate({
          courses: coursesRef.current,
          readings: readingsRef.current,
          assignments: assignmentsRef.current,
          vaultDocs: vaultDocsRef.current
        });
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

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
    const docsToDelete = vaultDocsRef.current.filter(
      v => (courseToDelete ? isItemForCourse(v, courseToDelete) : (v.courseId ? v.courseId === id : false))
    );
    let nextVaultDocs = vaultDocsRef.current.filter(
      v => (courseToDelete ? !isItemForCourse(v, courseToDelete) : (v.courseId ? v.courseId !== id : true))
    );

    if (nextCourses.length === 0) {
      nextReadings = [];
      nextAssignments = [];
      nextVaultDocs = [];
    }

    // Clean up physical syllabus files from disk for deleted vault docs
    for (const doc of docsToDelete) {
      if (doc.rawFileDataUri) {
        FileSystem.deleteAsync(doc.rawFileDataUri, { idempotent: true }).catch(() => {});
      }
    }
    if (nextCourses.length === 0 && FileSystem.documentDirectory) {
      const syllabiDir = `${FileSystem.documentDirectory}syllabi/`;
      FileSystem.deleteAsync(syllabiDir, { idempotent: true }).catch(() => {});
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
          moduleMention: a.moduleMention || undefined,
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
            moduleMention: a.moduleMention || undefined,
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
      let extractedLayouts: PageLayout[] = [];

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

        // Layer 1: Extract layout-aware geometry if available
        if (effectiveFileUri && (effectiveFileUri.toLowerCase().includes('.pdf') || (fileName || '').toLowerCase().includes('.pdf'))) {
          try {
            const rawPages = await extractLayoutFromPDF(effectiveFileUri);
            if (Array.isArray(rawPages) && rawPages.length > 0) {
              extractedLayouts = rawPages.map((p: any) => reconstructPage(p.observations || [], p.pageNumber || 1));
            }
          } catch (layoutErr) {
            console.warn('Layout extraction error:', layoutErr);
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

      // Check bundled catalog ONLY if this is an explicitly bundled sample course (exact filename or ID match)
      if (!rawText || rawText.trim().length < 50) {
        const cleanName = (fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const catalogMatch = BundledSyllabiCatalog.find(item => {
          const itemId = (item.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const itemFile = (item.fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return Boolean(cleanName && (cleanName === itemFile || cleanName === itemId));
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

      // Give users ample time to read the initial upload pill
      const firstPillElapsed = Date.now() - importStartTime;
      const MIN_FIRST_STAGE_TIME = process.env.NODE_ENV === 'test' ? 10 : 3500;
      if (firstPillElapsed < MIN_FIRST_STAGE_TIME) {
        await new Promise(r => setTimeout(r, MIN_FIRST_STAGE_TIME - firstPillElapsed));
      }

      // Stage 2: 100% On-Device Deterministic Parsing Engine (Offline & Private)
      setUploadStatusText('Processing coursework, please wait...');
      currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.25);

      let localDto: CourseDTO | null = null;
      if (rawText && rawText.trim().length > 50) {
        try {
          localDto = LocalSyllabusParser.shared.parseText(rawText, extractedLayouts);
        } catch (localErr) {
          console.warn('Local parser parsing error:', localErr);
        }
      }

      const dto: any = localDto;
      const apiError: string | undefined = undefined;
      const isFallbackUsed = false;
      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, rawText);

      // Layer 4: Gated AI Extraction (fires ONLY when lowConfidence AND apiKey AND consent)
      const userConsent = Boolean((params as any).allowAIExtraction);
      const apiKey = null; // No key configured -> never fires without explicit user key & consent
      if (normalized.lowConfidence && apiKey && userConsent) {
        try {
          const pagesForAI: PageText[] = extractedLayouts.length > 0
            ? extractedLayouts.map(l => ({ pageNumber: l.pageNumber, text: l.lines.map(line => line.text).join('\n') }))
            : [{ pageNumber: 1, text: rawText }];
          const aiResult = await runAIExtractionIfNeeded({
            score: normalized.confidenceScore ?? 50,
            apiKey,
            consent: userConsent,
            pages: pagesForAI,
            onDeviceFallback: {
              weeks: normalized.weeks,
              readings: normalized.candidateReadings,
              assignments: normalized.candidateAssignments
            }
          });
          if (aiResult) {
            if (Array.isArray(aiResult.readings) && aiResult.readings.length > 0) {
              normalized.candidateReadings = aiResult.readings;
            }
            if (Array.isArray(aiResult.assignments) && aiResult.assignments.length > 0) {
              normalized.candidateAssignments = aiResult.assignments;
            }
            if (Array.isArray(aiResult.weeks) && aiResult.weeks.length > 0) {
              normalized.weeks = aiResult.weeks;
            }
          }
        } catch (aiErr) {
          console.warn('Gated AI extraction fallback:', aiErr);
        }
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
        normalized.weekDateMap,
        (normalized.weeks as any)
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
        const cleanDocTitle = cleanDocumentTitle(fileName).toLowerCase();
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

      const cleanDocTitle = cleanDocumentTitle(fileName).toLowerCase();
      const baseFileName = fileName.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      const existingVaultDoc = targetCourse
        ? vaultDocsRef.current.find(vd => {
            if ((vd as any).courseId !== targetCourse!.id) return false;
            const vdTitle = (vd.title || '').toLowerCase().trim();
            const vdBase = vdTitle.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
            return (
              vdTitle === fileName.toLowerCase() ||
              vdTitle === cleanDocTitle ||
              vdBase === baseFileName ||
              (vd.rawFileDataUri && vd.rawFileDataUri.endsWith(fileName))
            );
          })
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

        // Zero Cross-Bleed Rule: If r is a calendar weekly reading (r.weekNumber > 0) in a course with dedicated Table 1 module readings (e.g. CPC 512), do not artificially inject module metadata from weeks unless explicitly set on r
        const hasDedicatedTable1 = Boolean(
          ((normalized as any).moduleReadings && (normalized as any).moduleReadings.length >= 5) ||
          cleanReadingsList.filter(cr => cr.moduleNumber && (!cr.weekNumber || cr.weekNumber === 0)).length >= 5
        );
        const rModNums = extractAllModuleNumbers(r);
        const resolvedModuleNumber = (r.weekNumber && r.weekNumber > 0 && hasDedicatedTable1)
          ? (r.moduleNumber || null)
          : (r.moduleNumber || (matchedWeek as any)?.moduleNumber || (rModNums[0] ?? null));
        const resolvedModuleMention = (r.weekNumber && r.weekNumber > 0 && hasDedicatedTable1)
          ? (r.moduleMention || null)
          : (r.moduleMention || (matchedWeek as any)?.moduleMention || (resolvedModuleNumber ? `Module ${resolvedModuleNumber}` : null));

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

      const hasGenuineWeeks = Boolean(
        (normalized.weeks && normalized.weeks.length > 0) ||
        newReadings.some(r => typeof r.weekNumber === 'number' && r.weekNumber > 0) ||
        cleanAssignmentsList.some(a => typeof a.weekNumber === 'number' && a.weekNumber > 0)
      );

      const courseWeeks: Week[] = [];
      let finalTermWeeks = 0;

      if (hasGenuineWeeks) {
        const weekNumbers = [
          ...newReadings.map(r => r.weekNumber || 0),
          ...cleanAssignmentsList.map(a => a.weekNumber || 0),
          ...(normalized.weeks || []).map((w: any) => w.weekNumber || 0),
          targetCourse?.termWeeks || normalized.termWeeks || 0
        ].filter(n => n > 0);

        if (weekNumbers.length > 0) {
          const maxWeek = Math.max(...weekNumbers);
          finalTermWeeks = maxWeek;

          for (let w = 1; w <= maxWeek; w++) {
            const weekReadings = newReadings.filter(r => (r.weekNumber || 0) === w);
            const foundWeek = (normalized.weeks as any[])?.find((dw: any) => dw.weekNumber === w);
            const foundTheme = cleanAcademicWeekTheme(foundWeek?.theme) || `Week ${w}`;
            const foundDate = foundWeek?.startDate
              ? parseSafeDate(foundWeek.startDate)
              : (foundWeek?.date ? parseSafeDate(foundWeek.date) : null);
            const wModNums = extractAllModuleNumbers(foundWeek);
            const foundModNum = (foundWeek as any)?.moduleNumber || (wModNums[0] ?? null);
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
        }
      }


      // Convert clean assignments into Assignment objects
      const newAssignments: Assignment[] = cleanAssignmentsList
        .filter(a => !isInvalidAssignmentTitle(a.title))
        .map((a, aIdx) => {
          const aModNums = extractAllModuleNumbers(a);
          const resolvedModNum = (typeof a.moduleNumber === 'number' && a.moduleNumber > 0)
            ? a.moduleNumber
            : (aModNums[0] ?? undefined);
          const resolvedModMention = a.moduleMention || (resolvedModNum ? `Module ${resolvedModNum}` : undefined);
          let resolvedWeek = a.weekNumber || 0;
          if (resolvedWeek === 0 && resolvedModNum && courseWeeks.length > 0) {
            const matchingWeek = courseWeeks.find(w => w.moduleNumber === resolvedModNum || w.weekNumber === resolvedModNum);
            if (matchingWeek) {
              resolvedWeek = matchingWeek.weekNumber;
            }
          }
          return sanitizeAssignment({
            ...a,
            id: `a-${Date.now()}-${aIdx}`,
            courseCode: effectiveCourseCode,
            sourceDocumentName: fileName,
            sourceDocumentId: vaultDocId,
            docColorHex: targetCourse?.hexColor || hexColor,
            courseId: courseId,
            weekNumber: resolvedWeek,
            moduleNumber: resolvedModNum,
            moduleMention: resolvedModMention,
            relevantTopics: a.relevantTopics || resolvedModMention
          });
        });

      const finalCourse: Course = {
        id: courseId,
        creatorId: targetCourse?.creatorId || 'user-self',
        courseName: effectiveCourseName,
        courseCode: effectiveCourseCode,
        courseDescription: normalized.courseDescription || targetCourse?.courseDescription || '',
        instructorName: normalized.instructorName || dto?.instructorName || (rawText ? FacultyExtractor.extractFaculty(rawText).name : null) || targetCourse?.instructorName || null,
        instructorEmail: normalized.instructorEmail || dto?.instructorEmail || (rawText ? FacultyExtractor.extractFaculty(rawText).email : null) || targetCourse?.instructorEmail || null,
        officeHours: normalized.officeHours || dto?.officeHours || (rawText ? FacultyExtractor.extractFaculty(rawText).officeHours : null) || targetCourse?.officeHours || null,
        externalScheduleNotice: targetCourse?.externalScheduleNotice || normalized.externalScheduleNotice || (dto?.externalScheduleNotice ?? null),
        gradingScale: targetCourse?.gradingScale || normalized.gradingScale || (dto?.gradingScale ?? null),
        gradingScaleRows: targetCourse?.gradingScaleRows || normalized.gradingScaleRows || (dto?.gradingScaleRows ?? null),
        hexColor: targetCourse?.hexColor || hexColor,
        termWeeks: finalTermWeeks,
        sharingCode: targetCourse?.sharingCode || String(Math.floor(100000 + Math.random() * 900000)),
        isDeleted: false,
        isFavorite: true,
        createdAt: targetCourse?.createdAt || new Date(),
        weeks: courseWeeks,
        assignments: newAssignments,
        syllabusDocs: targetCourse?.syllabusDocs || [],
        textbooks: (normalized.textbooks && normalized.textbooks.length > 0)
          ? normalized.textbooks
          : (dto?.textbooks && dto.textbooks.length > 0 ? dto.textbooks : (targetCourse?.textbooks || [])),
        confidenceScore: normalized.confidenceScore ?? null,
        lowConfidence: normalized.lowConfidence ?? false,
        topics: normalized.topics || targetCourse?.topics || []
      };

      // Add VaultDocument with visual page images & real file URI
      const fullCleanDocTitle = cleanDocumentTitle(fileName);
      const newVaultDoc: VaultDocument = {
        id: vaultDocId,
        title: fullCleanDocTitle || formatShortDocumentTitle(fileName),
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
        // ALWAYS retain finalCourse and newVaultDoc so uploaded documents and courses are always loaded
        updatedCourses = [finalCourse, ...coursesRef.current.filter(c => c.id !== finalCourse.id)];
        updatedReadings = [...newReadings, ...readingsRef.current];
        updatedAssignments = [...newAssignments, ...assignmentsRef.current];
        updatedVaultDocs = [newVaultDoc, ...vaultDocsRef.current.filter(d => d.id !== newVaultDoc.id)];
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
      const minDisplayMs = process.env.NODE_ENV === 'test' ? 20 : 4500; // Graceful display window
      if (elapsed < minDisplayMs) {
        currentSimulatedProgress = Math.max(currentSimulatedProgress, 0.90);
        setUploadProgress(0.90);
        setUploadStatusText('Organizing your schedule, please wait...');
        const pause1 = Math.min(1000, Math.max(200, Math.floor((minDisplayMs - elapsed) / 2)));
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

      if (outcomeDetails.success || hasReadablePayload) {
        const isTasklessDoc = newReadings.length === 0 && newAssignments.length === 0;
        // Step 1: The course and document are loaded. Display the state in the blue pill first
        setUploadStatusText(isTasklessDoc ? 'Document Stored in Vault' : 'Success! Course ready');
        await new Promise(r => setTimeout(r, process.env.NODE_ENV === 'test' ? 10 : 2200));

        // Step 2: Clear upload job before state commit so no async pause interrupts rendering
        await persistenceManager.clearPendingUploadJob();

        // Step 3: Atomically transition out of uploading state AND put the course and docs up in state together!
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
        // If there is only 1 course, focus on it; if multiple courses exist, clear filter so all are visible!
        setSelectedCourseFilter(updatedCourses.length === 1 ? finalCourse : null);

        if (!isTasklessDoc) {
          // Mark course as requiring accuracy verification review
          setUnacceptedAccuracyCourseIds(prev => Array.from(new Set([...prev, finalCourse.id])));
          setActiveAccuracyNotice({
            courseId: finalCourse.id,
            courseName: finalCourse.courseCode || finalCourse.courseName
          });
        }

        setImportBanner({
          type: isTasklessDoc ? 'info' : (isFallbackUsed || normalized.isPartial ? 'warning' : 'success'),
          title: isTasklessDoc ? 'Document Stored in Vault' : (isFallbackUsed ? 'Extracted (Offline / Fast Fallback)' : `Imported ${finalCourse.courseCode || finalCourse.courseName}`),
          message: outcomeDetails.message || (isTasklessDoc ? `Stored ${fileName} in Vault.` : `Added ${newReadings.length} readings & ${newAssignments.length} assignments.`)
        });
      } else {
        await persistenceManager.clearPendingUploadJob();

        coursesRef.current = updatedCourses;
        vaultDocsRef.current = updatedVaultDocs;
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
        isImportingRef.current = false;

        setCourses(updatedCourses);
        setVaultDocs(updatedVaultDocs);
        setSelectedCourseFilter(updatedCourses.length === 1 ? finalCourse : null);

        setImportBanner({
          type: 'warning',
          title: 'Document Stored in Vault',
          message: outcomeDetails.message || 'No readings or assignments were detected in this document.'
        });
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

  const resetAllData = useCallback(async () => {
    coursesRef.current = [];
    readingsRef.current = [];
    assignmentsRef.current = [];
    vaultDocsRef.current = [];

    setCourses([]);
    setReadings([]);
    setAssignments([]);
    setVaultDocs([]);
    setSelectedCourseFilter(null);
    setLatestDiagnosticRecord(null);

    await persistenceManager.resetAllStoredData();
    await persistenceManager.saveImmediate({
      courses: [],
      readings: [],
      assignments: [],
      vaultDocs: []
    });
  }, []);

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
        unacceptedAccuracyCourseIds,
        activeAccuracyNotice,
        acceptAccuracyNotice,
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
        cancelUpload,
        resetAllData
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
