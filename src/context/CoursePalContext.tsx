import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { Course, Week, Reading, Assignment, VaultDocument, MediaType, ImportOutcome, DiagnosticImportRecord } from '../types/models';
import { MasterCoursePalette } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import { persistenceManager } from '../services/DataPersistenceBackupManager';
import { LocalSyllabusParser } from '../services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../utils/syllabusCatalog';
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
  formatShortDocumentTitle
} from '../utils/readingDisplayHelper';
import { weekNumberForDate } from '../utils/timeFormatters';
import { extractTextFromPDF, renderPDFPages } from '../services/PDFTextExtractor';
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
}

const CoursePalContext = createContext<CoursePalContextType | undefined>(undefined);

const initialCourses: Course[] = [];

export function sanitizeReading(r: Reading): Reading {
  const canonicalCh = cleanChapterFromRaw(r.chapterText || r.title);
  const displayTitle = formatDisplayTitleWithChapter(r, canonicalCh);
  const cleanDueDate = parseSafeDate(r.dueDate);
  const isWeekActive = r.weekNumber !== undefined && r.weekNumber !== null
    ? r.weekNumber > 0
    : Boolean(r.weekId && r.weekId !== 'none' && /\d+/.test(r.weekId));
  const cleanWeekNum = isWeekActive
    ? (r.weekNumber && r.weekNumber > 0 ? r.weekNumber : (r.weekId && /\d+/.test(r.weekId) ? parseInt(r.weekId.match(/\d+/)![0], 10) : 0))
    : 0;

  return {
    ...r,
    title: displayTitle,
    chapterText: canonicalCh || undefined,
    dueDate: cleanDueDate,
    weekId: isWeekActive && cleanWeekNum > 0 ? (r.weekId || `w-${cleanWeekNum}`) : undefined,
    weekNumber: cleanWeekNum
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

  return {
    ...a,
    title: a.title ? a.title.trim() : 'Assignment',
    dueDate: cleanDueDate,
    pointsPossible: cleanPts,
    weightPercentage: cleanWeight,
    weekNumber: typeof a.weekNumber === 'number' ? a.weekNumber : 0,
    rubricCriteria: a.rubricCriteria || []
  };
}

export function createDefaultCPC527Seed(): {
  courses: Course[];
  readings: Reading[];
  assignments: Assignment[];
  vaultDocs: VaultDocument[];
} {
  const cpcItem = BundledSyllabiCatalog.find(b => b.id === 'cpc-527');
  if (!cpcItem) {
    return { courses: [], readings: [], assignments: [], vaultDocs: [] };
  }

  const parsed: any = LocalSyllabusParser.shared.parseText(cpcItem.rawText);
  const seededCourseId = 'c-cpc527-active';
  const fileName = cpcItem.fileName || 'CPC527_Group_Counselling_Syllabus.pdf';
  const courseCode = parsed.courseCode || cpcItem.courseCode || 'CPC 527';

  const baseCourse: Course = {
    id: seededCourseId,
    creatorId: 'user-self',
    courseName: parsed.courseName || cpcItem.courseName || 'Group Counselling Psychology',
    courseCode: courseCode,
    courseDescription: `Imported from ${fileName}. Faculty: ${parsed.instructorName || cpcItem.instructorName || 'Kelsey Murrin'}`,
    instructorName: parsed.instructorName || cpcItem.instructorName || 'Kelsey Murrin',
    instructorEmail: parsed.instructorEmail || cpcItem.instructorEmail || 'murrinkelsey@cityu.edu',
    hexColor: cpcItem.hexColor || '#059669',
    termWeeks: parsed.termWeeks || 12,
    sharingCode: parsed.sharingCode || 'CPC527',
    isDeleted: false,
    isFavorite: true,
    createdAt: new Date(),
    weeks: [],
    assignments: [],
    syllabusDocs: []
  };

  const rawReadings: Reading[] = [];
  for (const w of (parsed.weeks || [])) {
    for (const r of (w.readings || [])) {
      const readingDate = parseSafeDate(r.dueDate);
      rawReadings.push(sanitizeReading({
        id: r.id || `r-cpc527-${Math.random().toString(36).substring(2, 10)}`,
        title: r.title,
        authorName: r.authorName || null,
        resourceTitle: r.resourceTitle || r.title,
        mediaTypeRaw: r.mediaType || 'textbook',
        mediaType: (r.mediaType as any) || 'textbook',
        isCompleted: false,
        isDeleted: false,
        summaryText: r.summaryText || '',
        keyTakeawaysText: r.keyTakeawaysText || `• Review ${r.title}`,
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
        weekNumber: w.weekNumber
      }));
    }
  }

  const rawAssignments: Assignment[] = (parsed.assignments || []).map((a: any, aIdx: number) => {
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
      id: a.id || `a-cpc527-${aIdx + 1}`,
      title: a.title,
      weekNumber: resolvedWeek,
      dueDate: dueDate,
      fullInstructions: a.fullInstructions || 'Parsed from course syllabus.',
      pointsPossible: a.pointsPossible || '100 Points',
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
      relevantTopics: `Week ${resolvedWeek}`,
      sourceDocumentName: fileName,
      docColorHex: baseCourse.hexColor,
      isFavorite: false,
      courseId: seededCourseId,
      rubricCriteria: a.rubric || []
    });
  });

  const { readings: cleanReadings, assignments: cleanAssignments } = healItemWeeks(
    [baseCourse],
    rawReadings,
    rawAssignments
  );

  const maxW = Math.max(
    ...cleanReadings.map(r => r.weekNumber || 1),
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
      readings: cleanReadings.filter(r => r.weekNumber === w)
    });
  }

  const seededCourse: Course = {
    ...baseCourse,
    termWeeks: maxW,
    weeks,
    assignments: cleanAssignments
  };

  const seededVaultDocs: VaultDocument[] = [{
    id: 'vd-cpc527-syllabus',
    title: formatShortDocumentTitle(fileName),
    category: 'Syllabi',
    fileSize: cpcItem.fileSize || '480 KB',
    fileType: 'PDF',
    courseCode: courseCode,
    fileContent: cpcItem.rawText.slice(0, 5000),
    docColorHex: baseCourse.hexColor,
    rawFileDataUri: null,
    pageImages: null,
    uploadedAt: new Date()
  }];

  return {
    courses: [seededCourse],
    readings: cleanReadings,
    assignments: cleanAssignments,
    vaultDocs: seededVaultDocs
  };
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
            createdAt: parseSafeDate(c.createdAt) || new Date()
          }));
        let rawReadings = (Array.isArray(backup.readings) ? backup.readings : [])
          .filter(r => !r.id?.startsWith('r-seed-') && !isMockSeed(r.id) && !isSyntheticReading(r))
          .map(r => sanitizeReading(r));
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

        // If user has 0 courses stored, automatically seed CPC 527 with full Corey & Yalom readings
        if (cleanCourses.length === 0) {
          const defaultSeed = createDefaultCPC527Seed();
          cleanCourses = defaultSeed.courses;
          rawReadings = defaultSeed.readings;
          rawAssignments = defaultSeed.assignments;
          cleanVaultDocs = defaultSeed.vaultDocs;
        }

        // Heal and organize weeks: turn ON weeks that were previously zeroed/auto-off
        const { readings: cleanReadings, assignments: cleanAssignments } = healItemWeeks(
          cleanCourses,
          rawReadings,
          rawAssignments
        );

        // Populate course weeks with organized readings
        const updatedCourses = cleanCourses.map(c => {
          const cCode = (c.courseCode || c.courseName || '').toLowerCase().trim();
          const cReadings = cleanReadings.filter(
            r => (r.courseCode || '').toLowerCase().trim() === cCode
          );
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

        coursesRef.current = updatedCourses;
        readingsRef.current = cleanReadings;
        assignmentsRef.current = cleanAssignments;
        vaultDocsRef.current = cleanVaultDocs;

        setCourses(updatedCourses);
        setReadings(cleanReadings);
        setAssignments(cleanAssignments);
        setVaultDocs(cleanVaultDocs);
        if (backup.diagnosticRecord) {
          setLatestDiagnosticRecord(backup.diagnosticRecord);
        }

        persistenceManager.saveImmediate({
          courses: updatedCourses,
          readings: cleanReadings,
          assignments: cleanAssignments,
          vaultDocs: cleanVaultDocs
        });
      } else {
        // Initial baseline disk save: seed default CPC 527
        const defaultSeed = createDefaultCPC527Seed();
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
    const targetCode = courseToDelete
      ? (courseToDelete.courseCode || courseToDelete.courseName).toLowerCase()
      : null;

    const nextCourses = courses.filter(c => c.id !== id);
    const nextReadings = targetCode
      ? readings.filter(r => (r.courseCode || '').toLowerCase() !== targetCode)
      : readings;
    const nextAssignments = targetCode
      ? assignments.filter(
          a => a.courseId !== id && (a.courseCode || '').toLowerCase() !== targetCode
        )
      : assignments.filter(a => a.courseId !== id);
    const nextVaultDocs = targetCode
      ? vaultDocs.filter(v => (v.courseCode || '').toLowerCase() !== targetCode)
      : vaultDocs;

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
        summaryText: data.notes || `Assigned reading for Week ${targetWeek}`,
        keyTakeawaysText: `• Review ${data.title}`,
        estimatedTimeText: data.mediaType === 'video' ? '~20–30 min' : '~40–60 min',
        videoUrl: data.videoUrl,
        chapterText: undefined,
        pagesText: '',
        dueDate: data.dueDate,
        dateRangeStr: `Week ${targetWeek}`,
        courseCode,
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
          pointsPossible: a.pointsPossible || '100 Points',
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
          rubricCriteria: a.rubric || []
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
            pointsPossible: a.points || '100 Points',
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
            rubricCriteria: a.rubric || []
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

  const importSyllabusDocument = useCallback(async (params: ImportSyllabusParams) => {
    const { fileName, fileUri, fileSize, targetCourseId, preferredHexColor } = params;
    let rawText = params.rawText || '';

    // Switch immediately to syllabus tab so user sees the in-page upload status
    setSelectedTab('syllabus');
    setIsUploading(true);
    setUploadProgress(0.12);
    setUploadStatusText(`Opening ${fileName}...`);

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

        const effectiveFileUri = persistentFileUri || fileUri;

        try {
          const lower = (fileName + ' ' + effectiveFileUri).toLowerCase();
          const isDoc = lower.includes('.pdf') || lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.docx');
          if (isDoc || !rawText) {
            const b64 = await FileSystem.readAsStringAsync(effectiveFileUri, {
              encoding: FileSystem.EncodingType.Base64
            });
            if (b64 && b64.length > 50) {
              base64Pdf = b64;
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

      // Check bundled catalog if applicable
      if (!rawText && !base64Pdf) {
        const catalogMatch = BundledSyllabiCatalog.find(
          item => fileName.toLowerCase().includes(item.courseCode.toLowerCase().replace(/\s+/g, '')) ||
                  fileName.toLowerCase().includes(item.id.toLowerCase()) ||
                  fileName.toLowerCase() === item.fileName.toLowerCase()
        );
        if (catalogMatch) {
          rawText = catalogMatch.rawText;
        }
      }

      // Stage 2: AI Parsing with Gemini API
      setUploadProgress(0.45);
      setUploadStatusText('Reading your syllabus...');

      let dto: any = null;
      let apiError: string | undefined = undefined;
      const hasReadablePayload = Boolean(rawText || base64Pdf || renderedPageBase64.length > 0);

      if (hasReadablePayload) {
        try {
          const syllabusTextSnippet = rawText ? `\n\nExtracted Text Context:\n${rawText.slice(0, 250000)}` : '';
          const visualGuidance = renderedPageBase64.length > 0
            ? `\n\nVISUAL PAGE IMAGES ATTACHED:
You are provided with ${renderedPageBase64.length} high-resolution visual page images of this document.
Examine each page image directly. Use the visual tables, columns, headings, and layout to identify the exact course schedule, weekly module themes, required readings, textbook chapters, and assignment due dates.
Tables often have columns like (Week/Module | Topic | Required Readings | Deliverables). Ensure you associate the readings from each row with that specific week.`
            : '';
          const geminiPrompt = `You are an expert academic syllabus extraction engine.
Carefully extract all real course information, weekly schedule, required textbooks, and deliverables/assignments from this syllabus into structured JSON matching:
{
  "courseName": "Course Name",
  "courseCode": "Course Code (e.g. CPC 511, CPC 523, CPC 527)",
  "instructorName": "Instructor Name",
  "instructorEmail": "Instructor Email",
  "termWeeks": 12,
  "termYear": null,
  "textbooks": [
    {
      "title": "Exact Full Book Title",
      "authorName": "Author Name(s)",
      "edition": "Edition if stated"
    }
  ],
  "assignments": [
    {
      "title": "Exact Assignment Title",
      "dueDate": "YYYY-MM-DD (strict calendar date, or null if no explicit calendar date)",
      "rawDueDate": "Original text from document if stated",
      "pointsPossible": null,
      "weightPercentage": null,
      "fullInstructions": "Detailed instructions from syllabus",
      "mediaUrl": "https://...",
      "weekNumber": 5
    }
  ],
  "readings": [
    {
      "title": "Exact Reading Title, Chapter Topic, or Book Title",
      "authorName": "Author Name(s)",
      "chapterText": "Chapter 1",
      "pagesText": "pp. 1-25",
      "mediaType": "textbook | video | podcast | article",
      "videoUrl": "https://...",
      "weekNumber": 1,
      "dueDate": "YYYY-MM-DD (strict calendar date if stated, else null)"
    }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Weekly Topic",
      "date": "YYYY-MM-DD (calendar date if specified in schedule table, else null)",
      "readings": [],
      "assignments": []
    }
  ]
}

CRITICAL RULES:
1. OVERVIEW TABLE AS TRUTH FOR ASSIGNMENTS & WEIGHTS:
   The "Overview of Required Assignments" or "Course Assignments and Grading" table provides the definitive list of course deliverables and weights. Extract ONLY genuine deliverables from it.
2. RUBRIC IMMUNITY:
   NEVER extract grading rubric sub-criteria as separate assignments. These are grading rubrics, NOT deliverables.
3. STRICT ISO-8601 DUE DATES & ZERO FABRICATION:
   Do NOT invent due dates, points, or years. If missing, leave them null. Do NOT convert a week's class date into an assignment deadline. Keep scheduled week and explicit due date separate.
4. TEXTBOOK & AUTHOR RESOLUTION:
   First extract all textbooks and required resources into the "textbooks" array with their full titles and authors from the Course Resources, Required Textbooks, or Bibliography section.
   When extracting weekly readings from the schedule, match each assigned chapter back to its corresponding textbook to populate authorName and full book title.
   Textbooks in the bibliography are NOT reading tasks; do not include whole textbooks from the bibliography in "readings".
5. MEDIA & VIDEO URL EXTRACTION:
   Extract exact URLs into "videoUrl" or "mediaUrl". Clean titles so they do not contain raw URLs.
6. SPLIT MULTI-BOOK CITATIONS:
   When multiple textbooks are listed on the same line, split them into distinct reading items.
7. READING WEEKS:
   Preserve break weeks with no mandatory readings.
8. STRIP BOILERPLATE:
   Strip out territorial acknowledgements, social justice questions, institutional policies, and student codes of conduct.
${visualGuidance}
${syllabusTextSnippet}

Output ONLY valid JSON.`;

          const aiResult = await APIService.shared.generateContentWithGemini(
            geminiPrompt,
            rawText,
            base64Pdf,
            renderedPageBase64,
            fileName
          );
          dto = aiResult;
        } catch (aiErr: any) {
          apiError = aiErr?.message || 'AI parsing failed';
          console.warn('AI parsing error:', aiErr);
        }
      }

      // Stage 2.5: Normalize and Validate Payload
      let normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(dto, rawText);
      const aiHasData = normalized.candidateAssignments.length > 0 || normalized.candidateReadings.length > 0;

      let isFallbackUsed = false;
      let localDto: any = null;
      if (!aiHasData && rawText) {
        try {
          localDto = LocalSyllabusParser.shared.parseText(rawText);
          const localNormalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(localDto, rawText);
          if (
            localNormalized.candidateAssignments.length > 0 ||
            localNormalized.candidateReadings.length > 0 ||
            localNormalized.weeks.length > 0
          ) {
            normalized = localNormalized;
            isFallbackUsed = true;
          }
        } catch (localErr) {
          console.warn('Local parser fallback error:', localErr);
        }
      }

      // Deduplicate readings and assignments without merging different books or recurring deliverables
      const cleanReadingsList = SyllabusImportManager.shared.deduplicateReadings(
        normalized.candidateReadings,
        normalized.textbooks,
        normalized.termYear
      );

      const cleanAssignmentsList = SyllabusImportManager.shared.deduplicateAssignments(
        normalized.candidateAssignments,
        normalized.termYear
      );

      // Stage 3: Synthesizing Course Repository
      setUploadProgress(0.85);
      setUploadStatusText('Setting up your schedule...');

      const isGenericToken = (t?: string | null) =>
        !t || /^(new|new course|new cou|reading|assignment|crs|gen\s*101)$/i.test(t.trim());

      const safePreserveCode = !isGenericToken(params.preserveCourseCode) ? params.preserveCourseCode : undefined;
      const safeDtoCode = !isGenericToken(normalized.courseCode) ? normalized.courseCode : undefined;
      const safeLocalCode = !isGenericToken(localDto?.courseCode) ? localDto?.courseCode : undefined;
      const fallbackCode = fileName.replace(/\.[^/.]+$/, '').slice(0, 8).toUpperCase();
      const courseCode = safePreserveCode || safeDtoCode || safeLocalCode || (isGenericToken(fallbackCode) ? undefined : fallbackCode);
      const courseName = params.preserveCourseTitle || normalized.courseName || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const hexColor = preferredHexColor || MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length];

      // Find or create course using coursesRef.current (avoids stale closures)
      let targetCourse = targetCourseId ? coursesRef.current.find(c => c.id === targetCourseId) : undefined;
      if (!targetCourse && !targetCourseId) {
        targetCourse = coursesRef.current.find(
          c => (c.courseCode && courseCode && c.courseCode.toUpperCase() === courseCode.toUpperCase()) ||
               (c.courseName && courseName && c.courseName.toLowerCase() === courseName.toLowerCase())
        );
      }

      const courseId = targetCourse ? targetCourse.id : `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const effectiveCourseCode = targetCourse?.courseCode || courseCode;
      const effectiveCourseName = params.preserveCourseTitle || targetCourse?.courseName || courseName;

      // Convert clean readings into Reading objects
      const newReadings: Reading[] = cleanReadingsList.map((r, rIdx) => {
        const weekNum = r.weekNumber || 0;
        return {
          ...r,
          id: `r-${Date.now()}-${rIdx}`,
          courseCode: effectiveCourseCode,
          sourceDocumentName: fileName,
          docColorHex: targetCourse?.hexColor || hexColor,
          courseId: courseId,
          relevantTopics: r.relevantTopics || (weekNum > 0 ? `Week ${weekNum}` : null)
        };
      });

      // Convert clean assignments into Assignment objects
      const newAssignments: Assignment[] = cleanAssignmentsList.map((a, aIdx) => {
        const resolvedWeek = a.weekNumber || 0;
        return sanitizeAssignment({
          ...a,
          id: `a-${Date.now()}-${aIdx}`,
          courseCode: effectiveCourseCode,
          sourceDocumentName: fileName,
          docColorHex: targetCourse?.hexColor || hexColor,
          courseId: courseId,
          moduleMention: resolvedWeek > 0 ? `Week ${resolvedWeek}` : undefined,
          relevantTopics: resolvedWeek > 0 ? `Week ${resolvedWeek}` : undefined
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
        const foundTheme = normalized.weeks.find(dw => dw.weekNumber === w)?.theme || `Week ${w}`;
        courseWeeks.push({
          id: `w-${w}`,
          weekNumber: w,
          theme: foundTheme,
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
        id: `vd-${Date.now()}`,
        title: formatShortDocumentTitle(fileName),
        category: 'Syllabi',
        fileSize: fileSize || '1.4 MB',
        fileType: fileName.split('.').pop()?.toUpperCase() || 'PDF',
        courseCode: effectiveCourseCode,
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

      // Configure truthful UI status banner
      let bannerType: 'success' | 'warning' | 'info' | 'error' = 'info';
      let bannerTitle = '';
      let bannerMessage = outcomeDetails.message;

      if (!outcomeDetails.success) {
        bannerType = 'error';
        bannerTitle = 'Import failed';
      } else if (isFallbackUsed) {
        bannerType = 'warning';
        bannerTitle = `Local fallback used: ${apiError || 'Server AI unavailable'}`;
        bannerMessage = `Extracted ${newReadings.length} readings & ${newAssignments.length} assignments offline.`;
      } else if (normalized.isPartial) {
        bannerType = 'warning';
        bannerTitle = 'Partial extraction—review needed';
      } else {
        bannerType = 'success';
        bannerTitle = 'AI extraction completed';
      }

      setImportBanner({
        type: bannerType,
        title: bannerTitle,
        message: bannerMessage,
        diagnosticRecord: diagRecord
      });

      setUploadProgress(1.0);
      setIsUploading(false);
      setUploadStatusText('');

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
      setImportBanner({
        type: 'error',
        title: 'Import failed',
        message: err.message || 'Failed to parse syllabus document.',
        diagnosticRecord: errDiag
      });

      return {
        success: false,
        message: err.message || 'Failed to parse syllabus document.'
      };
    } finally {
      await endBackgroundTask('SyllabusUpload');
    }
  }, [courses, triggerConfetti, setSelectedTab]);

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
        turnOffAllWeeks
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
