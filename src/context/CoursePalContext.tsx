import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { Course, Week, Reading, Assignment, VaultDocument, MediaType } from '../types/models';
import { MasterCoursePalette } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import { persistenceManager } from '../services/DataPersistenceBackupManager';
import { LocalSyllabusParser } from '../services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../utils/syllabusCatalog';
import { APIService } from '../services/APIService';
import {
  cleanChapterFromRaw,
  formatDisplayTitleWithChapter,
  parseSafeDate
} from '../utils/readingDisplayHelper';
import { extractTextFromPDF } from '../services/PDFTextExtractor';
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
  showConfetti: boolean;
  confettiTitle: string;

  // Actions
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
  importSyllabusDocument: (params: ImportSyllabusParams) => Promise<{ success: boolean; course?: Course; message: string }>;
  startUploadSimulation: (fileName: string, targetCourseId?: string) => void;
  triggerConfetti: (title: string) => void;
  dismissConfetti: () => void;
}

const CoursePalContext = createContext<CoursePalContextType | undefined>(undefined);

const initialCourses: Course[] = [];

export function sanitizeReading(r: Reading): Reading {
  const canonicalCh = cleanChapterFromRaw(r.chapterText || r.title);
  const displayTitle = formatDisplayTitleWithChapter(r, canonicalCh);
  const cleanDueDate = parseSafeDate(r.dueDate);
  return {
    ...r,
    title: displayTitle,
    chapterText: canonicalCh || undefined,
    dueDate: cleanDueDate
  };
}

export function sanitizeAssignment(a: Assignment): Assignment {
  const cleanDueDate = parseSafeDate(a.dueDate);
  let cleanPts = a.pointsPossible || '100 Pts';
  if (/^\d+$/.test(cleanPts.trim())) {
    cleanPts = `${cleanPts.trim()} Pts`;
  }
  let cleanWeight = a.weightPercentage || null;
  if (cleanWeight && /^\d+$/.test(cleanWeight.trim())) {
    cleanWeight = `${cleanWeight.trim()}%`;
  }

  return {
    ...a,
    title: a.title ? a.title.trim() : 'Assignment',
    dueDate: cleanDueDate,
    pointsPossible: cleanPts,
    weightPercentage: cleanWeight,
    weekNumber: a.weekNumber || 1,
    rubricCriteria: a.rubricCriteria || []
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
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [confettiTitle, setConfettiTitle] = useState<string>('');

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

    persistenceManager.loadLatestBackup().then(backup => {
      if (!isMounted) return;
      if (backup) {
        const isMockSeed = (id?: string | null) =>
          id === 'c-cpc527-static-seed' || id === 'c-seed-mock';

        const isSyntheticReading = (r: any) => {
          const t = (r.title || '').toLowerCase();
          return t.includes('required reading & core materials') || t.startsWith('required reading (week');
        };

        const isSyntheticAssignment = (a: any) => {
          const t = (a.title || '').trim();
          return t === 'Initial Research & Literature Review' ||
                 t === 'Midterm Case Analysis' ||
                 t === 'Final Capstone Project & Defense';
        };

        const cleanCourses = (Array.isArray(backup.courses) ? backup.courses : [])
          .filter(c => !isMockSeed(c.id))
          .map(c => ({
            ...c,
            createdAt: parseSafeDate(c.createdAt) || new Date()
          }));
        const cleanReadings = (Array.isArray(backup.readings) ? backup.readings : [])
          .filter(r => !r.id?.startsWith('r-seed-') && !isMockSeed(r.id) && !isSyntheticReading(r))
          .map(sanitizeReading);
        const cleanAssignments = (Array.isArray(backup.assignments) ? backup.assignments : [])
          .filter(a => !a.id?.startsWith('a-seed-') && !isMockSeed(a.id) && !isSyntheticAssignment(a))
          .map(sanitizeAssignment);
        const cleanVaultDocs = (Array.isArray(backup.vaultDocs) ? backup.vaultDocs : [])
          .filter(vd => vd.id !== 'vd-cpc527-static-seed')
          .map(vd => ({
            ...vd,
            uploadedAt: parseSafeDate(vd.uploadedAt) || new Date()
          }));

        coursesRef.current = cleanCourses;
        readingsRef.current = cleanReadings;
        assignmentsRef.current = cleanAssignments;
        vaultDocsRef.current = cleanVaultDocs;

        setCourses(cleanCourses);
        setReadings(cleanReadings);
        setAssignments(cleanAssignments);
        setVaultDocs(cleanVaultDocs);

        persistenceManager.saveImmediate({
          courses: cleanCourses,
          readings: cleanReadings,
          assignments: cleanAssignments,
          vaultDocs: cleanVaultDocs
        });
      } else {
        // Initial baseline disk save: empty state
        coursesRef.current = [];
        readingsRef.current = [];
        assignmentsRef.current = [];
        vaultDocsRef.current = [];

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
        summaryText: data.notes || `Assigned reading for Week ${data.weekNumber}`,
        keyTakeawaysText: `• Review ${data.title}`,
        estimatedTimeText: data.mediaType === 'video' ? '~20–30 min' : '~40–60 min',
        videoUrl: data.videoUrl,
        chapterText: undefined,
        pagesText: '',
        dueDate: data.dueDate,
        dateRangeStr: `Week ${data.weekNumber}`,
        courseCode,
        relevantTopics: `Week ${data.weekNumber}`,
        isFavorite: false
      };
      setReadings(prev => [sanitizeReading(newReading), ...prev]);
    } else {
      const newAssignment: Assignment = sanitizeAssignment({
        id: `a-${Date.now()}`,
        title: data.title,
        weekNumber: data.weekNumber,
        dueDate: data.dueDate,
        pointsPossible: `${data.points || 100} Pts`,
        weightPercentage: `${data.weight || 10}%`,
        noteText: data.notes || '',
        isCompleted: false,
        isDeleted: false,
        courseCode,
        relevantTopics: `Week ${data.weekNumber}`,
        isFavorite: false,
        rubricCriteria: []
      });
      setAssignments(prev => [newAssignment, ...prev]);
    }
  }, [courses]);

  const importShareCode = useCallback((codeOrLink: string): { success: boolean; message: string; course?: Course } => {
    const clean = codeOrLink.trim().toUpperCase();
    if (!clean) {
      return { success: false, message: 'Please enter a valid course code or link.' };
    }

    // Direct match with existing course sharing code or course code
    const found = courses.find(
      c => c.sharingCode.toUpperCase() === clean || (c.courseCode && c.courseCode.toUpperCase() === clean)
    );

    if (found) {
      return {
        success: true,
        message: `Enrolled in '${found.courseName}' successfully!`,
        course: found
      };
    }

    // Create joined course container
    const newCourse: Course = {
      id: `c-joined-${Date.now()}`,
      creatorId: 'shared-peer',
      courseName: `Joined Course (${clean})`,
      courseCode: clean.length <= 8 ? clean : 'CRS',
      courseDescription: 'Joined via course sharing code.',
      hexColor: MasterCoursePalette[Math.floor(Math.random() * MasterCoursePalette.length)],
      termWeeks: 12,
      sharingCode: clean.length === 6 ? clean : String(Math.floor(100000 + Math.random() * 900000)),
      isDeleted: false,
      isFavorite: false,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: []
    };

    setCourses(prev => [newCourse, ...prev]);
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
    setUploadStatusText(`Extracting syllabus: ${fileName}...`);

    // Request iOS background execution assertion to prevent suspension if app is minimized
    await beginBackgroundTask('SyllabusUpload');

    try {
      let base64Pdf: string | undefined = undefined;

      // Step 1: Extract real text from fileUri or catalog
      if (!rawText && fileUri) {
        try {
          // Native multi-format extractor (PDF, DOCX, RTF, TXT)
          try {
            const extracted = await extractTextFromPDF(fileUri);
            if (extracted && extracted.trim().length > 20 && !extracted.startsWith('%PDF-')) {
              rawText = extracted.trim();
            }
          } catch (extractorErr) {
            // Ignore native extraction error silently
          }

          // If raw text still not found, try reading as plain text or base64
          if (!rawText || rawText.trim().length < 20) {
            const lower = (fileName + ' ' + fileUri).toLowerCase();
            const isBinary = lower.includes('.pdf') || lower.includes('.docx') || lower.includes('.doc');

            if (isBinary) {
              try {
                const b64 = await FileSystem.readAsStringAsync(fileUri, {
                  encoding: FileSystem.EncodingType.Base64
                });
                if (b64 && b64.length > 50) {
                  base64Pdf = b64;
                }
              } catch (b64Err) {
                // Ignore silently
              }
            } else {
              try {
                const directText = await FileSystem.readAsStringAsync(fileUri);
                if (directText && !directText.startsWith('%PDF-') && directText.trim().length > 20) {
                  rawText = directText.trim();
                }
              } catch (txtErr) {
                try {
                  const b64 = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: FileSystem.EncodingType.Base64
                  });
                  if (b64 && b64.length > 50) {
                    base64Pdf = b64;
                  }
                } catch (b64Fallback) {}
              }
            }
          }
        } catch (e) {
          // Handled safely
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
      setUploadStatusText('Analyzing schedule, readings & assignments with Gemini AI...');

      let dto: any = null;
      if (rawText || base64Pdf) {
        try {
          const syllabusTextSnippet = rawText ? `\n\nSyllabus Content:\n${rawText.slice(0, 32000)}` : '';
          const geminiPrompt = `You are an expert academic syllabus extraction engine.
Carefully extract all real course information, weekly schedule, required readings, textbooks, and deliverables/assignments from this syllabus into structured JSON matching:
{
  "courseName": "Course Name",
  "courseCode": "Course Code",
  "instructorName": "Instructor Name",
  "instructorEmail": "Instructor Email",
  "termWeeks": 12,
  "assignments": [
    {
      "title": "Exact Assignment Title",
      "dueDate": "2026-05-15 or description",
      "pointsPossible": "100 Points",
      "weightPercentage": "25%",
      "fullInstructions": "Detailed instructions from syllabus",
      "weekNumber": 1
    }
  ],
  "readings": [
    {
      "title": "Exact Reading Title or Book Title",
      "authorName": "Author Name(s)",
      "chapterText": "Chapter 1",
      "pagesText": "pp. 1-25",
      "mediaType": "textbook",
      "weekNumber": 1
    }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Weekly Topic",
      "readings": [
        {
          "title": "Reading Title",
          "authorName": "Author",
          "chapterText": "Chapter 1",
          "pagesText": "pp. 1-25",
          "mediaType": "textbook"
        }
      ],
      "assignments": [
        {
          "title": "Assignment Title",
          "dueDate": "2026-05-15",
          "pointsPossible": "100 Points",
          "weightPercentage": "25%"
        }
      ]
    }
  ]
}
${syllabusTextSnippet}

Output ONLY valid JSON.`;

          const aiResult = await APIService.shared.generateContentWithGemini(geminiPrompt, undefined, base64Pdf);
          let cleanJson = aiResult.trim();
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.split('\n').slice(1).join('\n');
            if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3).trim();
          }
          dto = JSON.parse(cleanJson);
        } catch (aiErr) {
          console.warn('Gemini syllabus parse error:', aiErr);
        }
      }

      // Merge with LocalSyllabusParser to guarantee 100% extraction coverage
      let localDto: any = null;
      if (rawText) {
        try {
          localDto = LocalSyllabusParser.shared.parseText(rawText);
        } catch (localErr) {
          console.warn('Local parser error:', localErr);
        }
      }

      // Extract and normalize all real assignments from all sources
      const candidateAssignments: any[] = [
        ...(Array.isArray(dto?.assignments) ? dto.assignments : []),
        ...(Array.isArray(dto?.deliverables) ? dto.deliverables : []),
        ...(Array.isArray(dto?.items) ? dto.items.filter((i: any) => (i.category || '').toLowerCase() === 'assignment') : []),
        ...(Array.isArray(dto?.weeks) ? dto.weeks.flatMap((w: any) => (w.assignments || []).map((wa: any) => ({ ...wa, weekNumber: wa.weekNumber || w.weekNumber }))) : []),
        ...(Array.isArray(localDto?.assignments) ? localDto.assignments : []),
        ...(Array.isArray(localDto?.items) ? localDto.items.filter((i: any) => (i.category || '').toLowerCase() === 'assignment') : [])
      ];

      const cleanAssignmentsList: any[] = [];
      for (const a of candidateAssignments) {
        const rawTitle = (a.title || a.name || a.assignmentName || a.assignment_name || a.deliverable || '').trim();
        if (!rawTitle || rawTitle.toLowerCase() === 'item title' || rawTitle.toLowerCase().includes('total 100%')) continue;
        const normKey = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existing = cleanAssignmentsList.find(e => e.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
        if (existing) {
          if (!existing.dueDate && (a.dueDate || a.due_date || a.dueDateIso || a.date)) {
            existing.dueDate = a.dueDate || a.due_date || a.dueDateIso || a.date;
          }
          if (!existing.weightPercentage && (a.weightPercentage || a.weight || a.weight_percentage || a.percentage)) {
            existing.weightPercentage = a.weightPercentage || a.weight || a.weight_percentage || a.percentage;
          }
          if ((!existing.fullInstructions || existing.fullInstructions === 'Parsed from course syllabus.') && (a.fullInstructions || a.instructions || a.description)) {
            existing.fullInstructions = a.fullInstructions || a.instructions || a.description;
          }
          continue;
        }

        cleanAssignmentsList.push({
          title: rawTitle,
          dueDate: a.dueDate || a.due_date || a.dueDateIso || a.date || a.rawDueDate || null,
          pointsPossible: a.pointsPossible || a.points || a.points_possible || a.totalPoints || '100 Points',
          weightPercentage: a.weightPercentage || a.weight || a.weight_percentage || a.percentage || null,
          fullInstructions: a.fullInstructions || a.instructions || a.description || 'Parsed from course syllabus.',
          weekNumber: a.weekNumber || a.week_number || undefined,
          subType: a.subType || a.subTypeRaw || a.category || 'PAPER',
          rubric: a.rubric || a.rubricCriteria || []
        });
      }

      // Extract and normalize all real readings from all sources
      const candidateReadings: any[] = [
        ...(Array.isArray(dto?.readings) ? dto.readings : []),
        ...(Array.isArray(dto?.textbooks) ? dto.textbooks : []),
        ...(Array.isArray(dto?.resources) ? dto.resources : []),
        ...(Array.isArray(dto?.items) ? dto.items.filter((i: any) => (i.category || '').toLowerCase() === 'reading') : []),
        ...(Array.isArray(dto?.weeks) ? dto.weeks.flatMap((w: any) => (w.readings || []).map((wr: any) => ({ ...wr, weekNumber: wr.weekNumber || w.weekNumber, relevantTopics: wr.relevantTopics || w.theme }))) : []),
        ...(Array.isArray(localDto?.weeks) ? localDto.weeks.flatMap((w: any) => (w.readings || []).map((wr: any) => ({ ...wr, weekNumber: wr.weekNumber || w.weekNumber, relevantTopics: wr.relevantTopics || w.theme }))) : []),
        ...(Array.isArray(localDto?.items) ? localDto.items.filter((i: any) => (i.category || '').toLowerCase() === 'reading') : [])
      ];

      const cleanReadingsList: any[] = [];
      for (const r of candidateReadings) {
        const rawTitle = (r.title || r.name || r.readingTitle || r.resourceTitle || r.bookTitle || '').trim();
        if (!rawTitle || rawTitle.toLowerCase().includes('required reading & core materials')) continue;
        const ch = (r.chapterText || r.chapter || r.chapters || r.chaptersOrPages || '').trim();
        const wk = r.weekNumber || r.week_number || 1;
        const normKey = `${rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}_${ch.toLowerCase().replace(/[^a-z0-9]/g, '')}_${wk}`;

        const existing = cleanReadingsList.find(e => (e as any)._normKey === normKey);
        if (existing) {
          if (!existing.authorName && (r.authorName || r.author || r.authors)) {
            existing.authorName = r.authorName || r.author || r.authors;
          }
          if (!existing.chapterText && ch) existing.chapterText = ch;
          if (!existing.pagesText && (r.pagesText || r.pages)) existing.pagesText = r.pagesText || r.pages;
          continue;
        }

        cleanReadingsList.push({
          _normKey: normKey,
          title: rawTitle,
          authorName: r.authorName || r.author || r.authors || null,
          resourceTitle: r.resourceTitle || r.bookTitle || rawTitle,
          chapterText: ch || null,
          pagesText: r.pagesText || r.pages || null,
          mediaType: r.mediaType || r.subType || 'textbook',
          weekNumber: wk,
          dueDate: r.dueDate || r.due_date || null,
          summaryText: r.summaryText || '',
          keyTakeawaysText: r.keyTakeawaysText || `• Study ${rawTitle}`,
          estimatedTimeText: r.estimatedTimeText || '~45 min read',
          relevantTopics: r.relevantTopics || null
        });
      }

      // Stage 3: Synthesizing Course Repository
      setUploadProgress(0.85);
      setUploadStatusText('Synthesizing course repository & weekly schedule...');

      const courseCode = params.preserveCourseCode || dto?.courseCode || fileName.replace(/\.[^/.]+$/, '').slice(0, 8).toUpperCase();
      const courseName = params.preserveCourseTitle || dto?.courseName || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const hexColor = preferredHexColor || MasterCoursePalette[coursesRef.current.length % MasterCoursePalette.length];

      // Find or create course using coursesRef.current (avoids stale closures)
      let targetCourse = targetCourseId ? coursesRef.current.find(c => c.id === targetCourseId) : undefined;
      if (!targetCourse && !targetCourseId) {
        targetCourse = coursesRef.current.find(
          c => (c.courseCode && c.courseCode.toUpperCase() === courseCode.toUpperCase()) ||
               c.courseName.toLowerCase() === courseName.toLowerCase()
        );
      }

      let finalCourse: Course;
      let courseId: string;
      let updatedCourses: Course[];

      if (targetCourse) {
        // Course was created by the user or previously imported:
        // STRICTLY preserve user's course title, subtitle (description), code, and color!
        finalCourse = {
          ...targetCourse,
          courseName: targetCourse.courseName,
          courseDescription: targetCourse.courseDescription,
          courseCode: targetCourse.courseCode,
          hexColor: targetCourse.hexColor,
          instructorName: targetCourse.instructorName || dto?.instructorName || null,
          instructorEmail: targetCourse.instructorEmail || dto?.instructorEmail || null,
          termWeeks: targetCourse.termWeeks || dto?.termWeeks || (dto?.weeks && dto.weeks.length > 0 ? dto.weeks.length : 12)
        };
        courseId = targetCourse.id;
        updatedCourses = coursesRef.current.map(c => c.id === targetCourse!.id ? finalCourse : c);
      } else {
        const finalName = params.preserveCourseTitle || courseName;
        const finalDesc = params.preserveCourseSubtitle !== undefined
          ? params.preserveCourseSubtitle
          : (dto?.courseDescription || `Imported from ${fileName}. Instructor: ${dto?.instructorName || 'Academic Faculty'}`);
        const finalCode = params.preserveCourseCode || courseCode;

        const newCourse: Course = {
          id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          creatorId: 'user-self',
          courseName: finalName,
          courseCode: finalCode,
          courseDescription: finalDesc,
          instructorName: dto?.instructorName || null,
          instructorEmail: dto?.instructorEmail || null,
          hexColor,
          termWeeks: dto?.termWeeks || (dto?.weeks && dto.weeks.length > 0 ? dto.weeks.length : 12),
          sharingCode: String(Math.floor(100000 + Math.random() * 900000)),
          isDeleted: false,
          isFavorite: true,
          createdAt: new Date(),
          weeks: [],
          assignments: [],
          syllabusDocs: []
        };
        finalCourse = newCourse;
        courseId = newCourse.id;
        updatedCourses = [newCourse, ...coursesRef.current];
      }
      coursesRef.current = updatedCourses;
      setCourses(updatedCourses);

      // Convert all clean readings into Reading objects
      const newReadings: Reading[] = cleanReadingsList.map((r: any, rIdx: number) => {
        const weekNum = r.weekNumber || 1;
        const readingDate = parseSafeDate(r.dueDate);
        return {
          id: `r-${Date.now()}-${rIdx}`,
          title: r.title,
          authorName: r.authorName || null,
          resourceTitle: r.resourceTitle || r.title,
          mediaTypeRaw: r.mediaType || 'textbook',
          mediaType: (r.mediaType as MediaType) || 'textbook',
          isCompleted: false,
          isDeleted: false,
          summaryText: r.summaryText || '',
          keyTakeawaysText: r.keyTakeawaysText || `• Study ${r.title}`,
          estimatedTimeText: r.estimatedTimeText || '~45 min read',
          dueDate: readingDate,
          dateRangeStr: readingDate ? readingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
          chapterText: r.chapterText || null,
          pagesText: r.pagesText || null,
          courseCode: finalCourse!.courseCode || courseCode,
          relevantTopics: r.relevantTopics || null,
          sourceDocumentName: fileName,
          docColorHex: finalCourse!.hexColor,
          isFavorite: false,
          weekId: `w-${weekNum}`
        };
      });

      // Convert all clean assignments into Assignment objects
      const newAssignments: Assignment[] = cleanAssignmentsList.map((a: any, aIdx: number) => {
        const dueDate = parseSafeDate(a.dueDate);
        let resolvedWeek = a.weekNumber || (aIdx + 1);
        return sanitizeAssignment({
          id: `a-${Date.now()}-${aIdx}`,
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
          courseCode: finalCourse!.courseCode || courseCode,
          moduleMention: a.moduleMention || null,
          weightPercentage: a.weightPercentage || null,
          subTypeRaw: a.subType || 'assignment',
          mediaUrl: a.mediaUrl || null,
          relevantTopics: a.relevantTopics || null,
          sourceDocumentName: fileName,
          docColorHex: finalCourse!.hexColor,
          isFavorite: false,
          courseId: courseId,
          rubricCriteria: a.rubric || []
        });
      });

      const maxWeek = Math.max(
        ...newReadings.map(r => {
          const m = (r.weekId || '').match(/\d+/);
          return m ? parseInt(m[0], 10) : 1;
        }),
        ...newAssignments.map(a => a.weekNumber),
        finalCourse?.termWeeks || 1,
        1
      );

      const courseWeeks: Week[] = [];
      for (let w = 1; w <= maxWeek; w++) {
        const weekReadings = newReadings.filter(r => r.weekId === `w-${w}`);
        const foundTheme = dto?.weeks?.find((dw: any) => dw.weekNumber === w)?.theme ||
                           localDto?.weeks?.find((lw: any) => lw.weekNumber === w)?.theme ||
                           `Week ${w}`;
        courseWeeks.push({
          id: `w-${w}`,
          weekNumber: w,
          theme: foundTheme,
          courseId,
          readings: weekReadings
        });
      }

      finalCourse = {
        ...finalCourse,
        termWeeks: maxWeek,
        weeks: courseWeeks,
        assignments: newAssignments
      };
      updatedCourses = updatedCourses.map(c => c.id === courseId ? finalCourse : c);
      coursesRef.current = updatedCourses;
      setCourses(updatedCourses);

      // Add VaultDocument
      const newVaultDoc: VaultDocument = {
        id: `vd-${Date.now()}`,
        title: fileName,
        category: 'Syllabi',
        fileSize: fileSize || '1.4 MB',
        fileType: fileName.split('.').pop()?.toUpperCase() || 'PDF',
        courseCode: finalCourse!.courseCode || courseCode,
        fileContent: rawText.slice(0, 5000),
        docColorHex: finalCourse!.hexColor,
        uploadedAt: new Date()
      };

      const sanitizedNewReadings = newReadings.map(sanitizeReading);
      const updatedReadings = [...sanitizedNewReadings, ...readingsRef.current];
      const updatedAssignments = [...newAssignments, ...assignmentsRef.current];
      const updatedVaultDocs = [newVaultDoc, ...vaultDocsRef.current];

      readingsRef.current = updatedReadings;
      assignmentsRef.current = updatedAssignments;
      vaultDocsRef.current = updatedVaultDocs;

      setReadings(updatedReadings);
      setAssignments(updatedAssignments);
      setVaultDocs(updatedVaultDocs);

      await persistenceManager.saveImmediate({
        courses: updatedCourses,
        readings: updatedReadings,
        assignments: updatedAssignments,
        vaultDocs: updatedVaultDocs
      });

      setUploadProgress(1.0);
      setIsUploading(false);
      setUploadStatusText('');

      const countMsg = `${newReadings.length} readings & ${newAssignments.length} assignments`;
      triggerConfetti(`Extracted ${finalCourse.courseCode || finalCourse.courseName}! Added ${countMsg}.`);

      setSelectedTab('syllabus');

      return {
        success: true,
        course: finalCourse,
        message: `Successfully imported ${fileName} with ${countMsg}!`
      };
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatusText('');
      console.error('Failed to import syllabus:', err);
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
        showConfetti,
        confettiTitle,
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
        dismissConfetti
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
