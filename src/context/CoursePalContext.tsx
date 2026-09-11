import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { Course, Reading, Assignment, VaultDocument, MediaType } from '../types/models';
import { MasterCoursePalette } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import { persistenceManager } from '../services/DataPersistenceBackupManager';
import { LocalSyllabusParser } from '../services/LocalSyllabusParser';
import { BundledSyllabiCatalog } from '../utils/syllabusCatalog';

export type TabKey = 'readings' | 'assignments' | 'syllabus' | 'invite';

export interface ImportSyllabusParams {
  fileName: string;
  fileUri?: string;
  rawText?: string;
  fileSize?: string;
  targetCourseId?: string;
  preferredHexColor?: string;
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

// Initial Mock Data matching SwiftData seed
// Initial Mock Data matching SwiftData seed with full authentic schedule
const initialCourses: Course[] = [
  {
    id: 'c-cpc527',
    creatorId: 'user-self',
    courseName: 'Group Counselling & Psychotherapy',
    courseCode: 'CPC 527',
    courseDescription: 'Advanced group dynamics, therapeutic stages, experiential interventions, and ethical facilitation.',
    instructorName: 'Dr. Elena Rostova',
    instructorEmail: 'e.rostova@university.edu',
    hexColor: '#E11D48', // Crimson / Rose (Matching device screenshot)
    termWeeks: 12,
    sharingCode: '527318',
    isDeleted: false,
    isFavorite: true,
    createdAt: new Date('2026-03-01T08:00:00Z'),
    weeks: [],
    assignments: [],
    syllabusDocs: []
  }
];

const initialReadings: Reading[] = [
  // CPC 527 (18 readings from April 2 to June 18, 2026 - Exactly matching Swift app & device screenshot)
  {
    id: 'r-527-1',
    title: 'Chapter 1 · Ch. 1',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapter 1',
    estimatedTimeText: '~40–60 min',
    chapterText: 'Ch. 1',
    dueDate: new Date(2026, 3, 2), // Thursday, April 2, 2026
    dateRangeStr: 'April 2',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 1: Intro to Group Work',
    isFavorite: false,
    weekId: 'w1'
  },
  {
    id: 'r-527-2',
    title: 'Chapters 1 & 2',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 1 & 2',
    estimatedTimeText: '~45–60 min',
    chapterText: 'Ch. 1 & 2',
    dueDate: new Date(2026, 3, 2), // Thursday, April 2, 2026
    dateRangeStr: 'April 2',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 1: Intro to Group Work',
    isFavorite: false,
    weekId: 'w1'
  },
  {
    id: 'r-527-3',
    title: 'Chapter 2 · Ch. 2',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapter 2',
    estimatedTimeText: '~40–60 min',
    chapterText: 'Ch. 2',
    dueDate: new Date(2026, 3, 9), // Thursday, April 9, 2026
    dateRangeStr: 'April 9',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 2: Introduction to Group Work Pt. 2',
    isFavorite: false,
    weekId: 'w2'
  },
  {
    id: 'r-527-4',
    title: 'Chapters 3 & 4',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 3 & 4',
    estimatedTimeText: '~45–60 min',
    chapterText: 'Ch. 3 & 4',
    dueDate: new Date(2026, 3, 9), // Thursday, April 9, 2026
    dateRangeStr: 'April 9',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 2: Introduction to Group Work Pt. 2',
    isFavorite: false,
    weekId: 'w2'
  },
  {
    id: 'r-527-5',
    title: 'Chapter 3 · Ch. 3',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapter 3',
    estimatedTimeText: '~40–60 min',
    chapterText: 'Ch. 3',
    dueDate: new Date(2026, 3, 16), // Thursday, April 16, 2026
    dateRangeStr: 'April 16',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 3: Group Stages: Initial Stages',
    isFavorite: false,
    weekId: 'w3'
  },
  {
    id: 'r-527-6',
    title: 'Chapters 5 & 6',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 5 & 6',
    estimatedTimeText: '~45–60 min',
    chapterText: 'Ch. 5 & 6',
    dueDate: new Date(2026, 3, 16), // Thursday, April 16, 2026
    dateRangeStr: 'April 16',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 3: Group Stages: Initial Stages',
    isFavorite: false,
    weekId: 'w3'
  },
  {
    id: 'r-527-7',
    title: 'Chapter 7',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapter 7',
    estimatedTimeText: '~40–50 min',
    chapterText: 'Ch. 7',
    dueDate: new Date(2026, 3, 23), // Thursday, April 23, 2026
    dateRangeStr: 'April 23',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 4: Group Stages: Transition',
    isFavorite: false,
    weekId: 'w4'
  },
  {
    id: 'r-527-8',
    title: 'Chapters 4 & 5',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 4 & 5',
    estimatedTimeText: '~50–70 min',
    chapterText: 'Ch. 4 & 5',
    dueDate: new Date(2026, 3, 23), // Thursday, April 23, 2026
    dateRangeStr: 'April 23',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 4: Group Stages: Transition',
    isFavorite: false,
    weekId: 'w4'
  },
  {
    id: 'r-527-9',
    title: 'Chapter 8',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapter 8',
    estimatedTimeText: '~40–50 min',
    chapterText: 'Ch. 8',
    dueDate: new Date(2026, 3, 30), // Thursday, April 30, 2026
    dateRangeStr: 'April 30',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 5: Group Stages: Working',
    isFavorite: false,
    weekId: 'w5'
  },
  {
    id: 'r-527-10',
    title: 'Chapters 6 & 7',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 6 & 7',
    estimatedTimeText: '~50–70 min',
    chapterText: 'Ch. 6 & 7',
    dueDate: new Date(2026, 3, 30), // Thursday, April 30, 2026
    dateRangeStr: 'April 30',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 5: Group Stages: Working',
    isFavorite: false,
    weekId: 'w5'
  },
  {
    id: 'r-527-11',
    title: 'Chapters 8 & 9',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 8 & 9',
    estimatedTimeText: '~50–70 min',
    chapterText: 'Ch. 8 & 9',
    dueDate: new Date(2026, 4, 7), // Thursday, May 7, 2026
    dateRangeStr: 'May 7',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 6: Presentations',
    isFavorite: false,
    weekId: 'w6'
  },
  {
    id: 'r-527-12',
    title: 'Chapters 10 & 11',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 10 & 11',
    estimatedTimeText: '~50–70 min',
    chapterText: 'Ch. 10 & 11',
    dueDate: new Date(2026, 4, 14), // Thursday, May 14, 2026
    dateRangeStr: 'May 14',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 7: Presentations',
    isFavorite: false,
    weekId: 'w7'
  },
  {
    id: 'r-527-13',
    title: 'Chapters 12 & 13',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 12 & 13',
    estimatedTimeText: '~50–70 min',
    chapterText: 'Ch. 12 & 13',
    dueDate: new Date(2026, 4, 28), // Thursday, May 28, 2026
    dateRangeStr: 'May 28',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 8: Presentations',
    isFavorite: false,
    weekId: 'w9'
  },
  {
    id: 'r-527-14',
    title: 'Chapter 9',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapter 9',
    estimatedTimeText: '~40–50 min',
    chapterText: 'Ch. 9',
    dueDate: new Date(2026, 4, 28), // Thursday, May 28, 2026
    dateRangeStr: 'May 28',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 8: Presentations',
    isFavorite: false,
    weekId: 'w9'
  },
  {
    id: 'r-527-15',
    title: 'Assigned Readings',
    authorName: 'Brightspace',
    resourceTitle: 'Course Shell Readings',
    mediaTypeRaw: 'article',
    mediaType: 'article',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• See Brightspace for Assigned Readings',
    estimatedTimeText: '~30–45 min',
    chapterText: 'Assigned Readings',
    dueDate: new Date(2026, 5, 4), // Thursday, June 4, 2026
    dateRangeStr: 'June 4',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 9: Group Stages: Final',
    isFavorite: false,
    weekId: 'w10'
  },
  {
    id: 'r-527-16',
    title: 'Chapters 10 & 11',
    authorName: 'Corey',
    resourceTitle: 'Groups: Process and Practice',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 10 & 11',
    estimatedTimeText: '~45–60 min',
    chapterText: 'Ch. 10 & 11',
    dueDate: new Date(2026, 5, 11), // Thursday, June 11, 2026
    dateRangeStr: 'June 11',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 10: Groups in Diverse Settings',
    isFavorite: false,
    weekId: 'w11'
  },
  {
    id: 'r-527-17',
    title: 'Chapters 14 & 15',
    authorName: 'Yalom',
    resourceTitle: 'Theory and Practice of Group Psychotherapy',
    mediaTypeRaw: 'textbook',
    mediaType: 'textbook',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• Review Chapters 14 & 15',
    estimatedTimeText: '~50–70 min',
    chapterText: 'Ch. 14 & 15',
    dueDate: new Date(2026, 5, 11), // Thursday, June 11, 2026
    dateRangeStr: 'June 11',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 10: Groups in Diverse Settings',
    isFavorite: false,
    weekId: 'w11'
  },
  {
    id: 'r-527-18',
    title: 'Assigned Readings',
    authorName: 'Brightspace',
    resourceTitle: 'Course Shell Readings',
    mediaTypeRaw: 'article',
    mediaType: 'article',
    isCompleted: false,
    isDeleted: false,
    summaryText: '',
    keyTakeawaysText: '• See Brightspace for Assigned Readings',
    estimatedTimeText: '~30–45 min',
    chapterText: 'Assigned Readings',
    dueDate: new Date(2026, 5, 18), // Thursday, June 18, 2026
    dateRangeStr: 'June 18',
    courseCode: 'CPC 527',
    relevantTopics: 'Module 11: Effective Closings',
    isFavorite: false,
    weekId: 'w12'
  }
];

const initialAssignments: Assignment[] = [
  // CPC 527 Deliverable (Exact match to media_1788720741700.png)
  {
    id: 'a-527-1',
    title: 'Group Process & Self-Regulation Assessment',
    weekNumber: 7,
    dueDate: new Date(2026, 4, 14), // May 14, 2026
    pointsPossible: '100 Points',
    weightPercentage: '25%',
    noteText: '',
    isCompleted: false,
    isDeleted: false,
    courseCode: 'CPC 527',
    relevantTopics: 'Module 1',
    isFavorite: true,
    rubricCriteria: [
      { criterionName: 'Communication', points: 20, percentage: 20 },
      { criterionName: 'Engagement & Attendance', points: 20, percentage: 20 },
      { criterionName: 'Empathy & Compassion', points: 20, percentage: 20 },
      { criterionName: 'Self Awareness', points: 20, percentage: 20 },
      { criterionName: 'Self Regulation', points: 20, percentage: 20 }
    ]
  }
];

const initialVaultDocs: VaultDocument[] = [
  {
    id: 'vd-cpc527',
    title: 'CPC 527: Group Psychotherapy Syllabus.pdf',
    category: 'Syllabi',
    fileSize: '2.4 MB',
    fileType: 'PDF',
    courseCode: 'CPC 527',
    fileContent: 'Syllabus and clinical schedule for CPC 527 Group Psychotherapy.',
    docColorHex: '#E11D48',
    uploadedAt: new Date('2026-03-01T09:00:00Z')
  }
];

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
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(true);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [confettiTitle, setConfettiTitle] = useState<string>('');

  const isInitialMount = useRef(true);

  // Restore latest backup from disk on app launch
  useEffect(() => {
    let isMounted = true;
    persistenceManager.loadLatestBackup().then(backup => {
      if (!isMounted || !backup) return;
      if (Array.isArray(backup.courses) && backup.courses.length > 0) {
        setCourses(backup.courses);
      }
      if (Array.isArray(backup.readings) && backup.readings.length > 0) {
        setReadings(backup.readings);
      }
      if (Array.isArray(backup.assignments) && backup.assignments.length > 0) {
        setAssignments(backup.assignments);
      }
      if (Array.isArray(backup.vaultDocs) && backup.vaultDocs.length > 0) {
        setVaultDocs(backup.vaultDocs);
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
    setAssignments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
  }, []);

  const updateReading = useCallback((updated: Reading) => {
    setReadings(prev => prev.map(r => (r.id === updated.id ? updated : r)));
  }, []);

  const restoreAssignment = useCallback((id: string) => {
    setAssignments(prev => prev.map(a => (a.id === id ? { ...a, isDeleted: false } : a)));
  }, []);

  const restoreReading = useCallback((id: string) => {
    setReadings(prev => prev.map(r => (r.id === id ? { ...r, isDeleted: false } : r)));
  }, []);

  const emptyTrash = useCallback(() => {
    setAssignments(prev => prev.filter(a => !a.isDeleted));
    setReadings(prev => prev.filter(r => !r.isDeleted));
  }, []);

  const deleteReading = useCallback((id: string) => {
    setReadings(prev => prev.map(r => (r.id === id ? { ...r, isDeleted: true } : r)));
  }, []);

  const deleteAssignment = useCallback((id: string) => {
    setAssignments(prev => prev.map(a => (a.id === id ? { ...a, isDeleted: true } : a)));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCourse = useCallback((updated: Course) => {
    setCourses(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  }, []);

  const deleteVaultDoc = useCallback((id: string) => {
    setVaultDocs(prev => prev.filter(d => d.id !== id));
  }, []);

  const addCourse = useCallback((data: { courseName: string; courseCode?: string; courseDescription?: string; hexColor: string }): Course => {
    const newCourse: Course = {
      id: `c-${Date.now()}`,
      creatorId: 'user-self',
      courseName: data.courseName,
      courseCode: data.courseCode || 'GEN 101',
      courseDescription: data.courseDescription || '',
      hexColor: data.hexColor || MasterCoursePalette[0],
      termWeeks: 12,
      sharingCode: String(Math.floor(100000 + Math.random() * 900000)),
      isDeleted: false,
      isFavorite: false,
      createdAt: new Date(),
      weeks: [],
      assignments: [],
      syllabusDocs: []
    };
    setCourses(prev => [newCourse, ...prev]);
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
        chapterText: `Week ${data.weekNumber}`,
        pagesText: 'Class Material',
        dueDate: data.dueDate,
        dateRangeStr: `Week ${data.weekNumber}`,
        courseCode,
        relevantTopics: `Week ${data.weekNumber}`,
        isFavorite: false
      };
      setReadings(prev => [newReading, ...prev]);
    } else {
      const newAssignment: Assignment = {
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
      };
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
  }, []);

  const importSyllabusDocument = useCallback(async (params: ImportSyllabusParams) => {
    const { fileName, fileUri, fileSize, targetCourseId, preferredHexColor } = params;
    let rawText = params.rawText || '';

    setIsUploading(true);
    setUploadProgress(0.15);
    setUploadStatusText(`Extracting syllabus: ${fileName}...`);

    try {
      // Step 1: If rawText is not provided, try to extract it from fileUri or catalog
      if (!rawText && fileUri) {
        try {
          if (fileName.toLowerCase().endsWith('.txt')) {
            rawText = await FileSystem.readAsStringAsync(fileUri);
          } else {
            // Check if fileName matches any item in BundledSyllabiCatalog
            const catalogMatch = BundledSyllabiCatalog.find(
              item => fileName.toLowerCase().includes(item.courseCode.toLowerCase().replace(/\s+/g, '')) ||
                      fileName.toLowerCase().includes(item.id.toLowerCase()) ||
                      fileName.toLowerCase() === item.fileName.toLowerCase()
            );
            if (catalogMatch) {
              rawText = catalogMatch.rawText;
            } else {
              try {
                const content = await FileSystem.readAsStringAsync(fileUri);
                if (content && content.length > 50 && !content.startsWith('%PDF-')) {
                  rawText = content;
                }
              } catch {
                // Keep rawText empty
              }
            }
          }
        } catch (e) {
          console.warn('Error reading fileUri:', e);
        }
      }

      // If still no rawText, check catalog again or fallback to clean academic template
      if (!rawText) {
        const catalogMatch = BundledSyllabiCatalog.find(
          item => fileName.toLowerCase().includes(item.courseCode.toLowerCase().replace(/\s+/g, '')) ||
                  fileName.toLowerCase().includes(item.id.toLowerCase())
        );
        if (catalogMatch) {
          rawText = catalogMatch.rawText;
        } else {
          const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          rawText = `Course: ${cleanName}\nTerm: Summer 2026\nInstructor: Academic Faculty\n\nSchedule:\nWeek 1: Introduction to ${cleanName}. Read Chapter 1.\nWeek 2: Fundamental Principles. Read Chapter 2 & 3.\nWeek 3: Core Frameworks. Read Chapter 4.\nWeek 4: Practical Applications. Read Chapter 5.\nWeek 5: Advanced Topics. Read Chapter 6.\n\nAssignments:\nAssignment 1: Initial Research Report. Due in Week 2. (100 Points, 25%)\nAssignment 2: Midterm Project. Due in Week 3. (100 Points, 35%)\nAssignment 3: Final Capstone Paper. Due in Week 5. (100 Points, 40%)`;
        }
      }

      setUploadProgress(0.5);
      setUploadStatusText('Analyzing schedule, readings & assignments...');
      await new Promise(r => setTimeout(r, 400));

      // Parse with LocalSyllabusParser
      const dto = LocalSyllabusParser.shared.parseText(rawText);

      setUploadProgress(0.8);
      setUploadStatusText('Synthesizing course repository...');
      await new Promise(r => setTimeout(r, 300));

      const courseCode = dto.courseCode || fileName.replace(/\.[^/.]+$/, '').slice(0, 8).toUpperCase();
      const courseName = dto.courseName || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const hexColor = preferredHexColor || MasterCoursePalette[courses.length % MasterCoursePalette.length];

      // Find or create course
      let targetCourse = targetCourseId ? courses.find(c => c.id === targetCourseId) : undefined;
      if (!targetCourse) {
        targetCourse = courses.find(
          c => (c.courseCode && c.courseCode.toUpperCase() === courseCode.toUpperCase()) ||
               c.courseName.toLowerCase() === courseName.toLowerCase()
        );
      }

      let finalCourse = targetCourse;
      let courseId = targetCourse?.id;
      let updatedCourses = courses;
      if (!finalCourse) {
        const newCourse: Course = {
          id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          creatorId: 'user-self',
          courseName,
          courseCode,
          courseDescription: `Imported from ${fileName}. Instructor: ${dto.instructorName || 'Academic Faculty'}`,
          instructorName: dto.instructorName || null,
          instructorEmail: dto.instructorEmail || null,
          hexColor,
          termWeeks: dto.termWeeks || (dto.weeks && dto.weeks.length > 0 ? dto.weeks.length : 12),
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
        updatedCourses = [newCourse, ...courses];
        setCourses(updatedCourses);
      }

      // Convert parsed weeks & readings into Reading objects
      const newReadings: Reading[] = [];
      if (dto.weeks && dto.weeks.length > 0) {
        dto.weeks.forEach((w, wIdx) => {
          const weekNum = w.weekNumber || (wIdx + 1);
          if (w.readings && w.readings.length > 0) {
            w.readings.forEach((r, rIdx) => {
              const readingDate = r.dueDate ? new Date(r.dueDate) : undefined;
              newReadings.push({
                id: `r-${Date.now()}-${wIdx}-${rIdx}`,
                title: r.title || `Reading ${rIdx + 1}`,
                authorName: r.authorName || null,
                resourceTitle: r.resourceTitle || r.title,
                mediaTypeRaw: r.mediaType || 'textbook',
                mediaType: (r.mediaType as MediaType) || 'textbook',
                isCompleted: false,
                isDeleted: false,
                summaryText: r.summaryText || '',
                keyTakeawaysText: r.keyTakeawaysText || `• Review ${r.title}`,
                estimatedTimeText: r.estimatedTimeText || '~45 min',
                dueDate: readingDate,
                dateRangeStr: w.dateRangeStr || (readingDate ? readingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined),
                chapterText: r.chapterText || null,
                pagesText: r.pagesText || null,
                courseCode: finalCourse!.courseCode || courseCode,
                relevantTopics: r.relevantTopics || w.theme || null,
                sourceDocumentName: fileName,
                docColorHex: finalCourse!.hexColor,
                isFavorite: false,
                weekId: `w-${weekNum}`
              });
            });
          }
        });
      }

      // Convert parsed assignments into Assignment objects
      const newAssignments: Assignment[] = (dto.assignments || []).map((a, aIdx) => {
        const dueDate = a.dueDate ? new Date(a.dueDate) : undefined;
        return {
          id: `a-${Date.now()}-${aIdx}`,
          title: a.title,
          weekNumber: aIdx + 1,
          dueDate: dueDate,
          fullInstructions: a.fullInstructions || 'Parsed from course syllabus.',
          pointsPossible: a.pointsPossible || '100 Points',
          pointsBreakdown: null,
          rubricJSON: null,
          noteText: a.noteText || null,
          isCompleted: false,
          isDeleted: false,
          courseCode: finalCourse!.courseCode || courseCode,
          moduleMention: null,
          weightPercentage: a.weightPercentage || null,
          subTypeRaw: 'assignment',
          mediaUrl: null,
          relevantTopics: null,
          sourceDocumentName: fileName,
          docColorHex: finalCourse!.hexColor,
          isFavorite: false,
          courseId: courseId,
          rubricCriteria: a.rubric || []
        };
      });

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

      const updatedReadings = [...newReadings, ...readings];
      const updatedAssignments = [...newAssignments, ...assignments];
      const updatedVaultDocs = [newVaultDoc, ...vaultDocs];

      if (newReadings.length > 0) {
        setReadings(updatedReadings);
      }
      if (newAssignments.length > 0) {
        setAssignments(updatedAssignments);
      }
      setVaultDocs(updatedVaultDocs);

      persistenceManager.scheduleAutoBackup({
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

      setSelectedTab('readings');

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
