/**
 * Core Data Models & DTOs for CoursePal
 * 1:1 parity with SwiftData @Model and Codable DTOs
 */

export type MediaType = 'textbook' | 'article' | 'video' | 'podcast';

export type SemanticItemType = 'media' | 'reading' | 'assignment' | 'in_class';

export interface RubricCriterionDTO {
  criterionName: string;
  points?: number | null;
  percentage?: number | null;
  description?: string | null;
}

export interface ExtractionStatsDTO {
  status: string;
  confidenceScore: number;
  missingFields: string[];
}

export interface ReadingDTO {
  id: string;
  title: string;
  authorName?: string | null;
  resourceTitle?: string | null;
  mediaType?: string | null;
  isCompleted?: boolean;
  summaryText?: string | null;
  keyTakeawaysText?: string | null;
  estimatedTimeText?: string | null;
  videoUrl?: string | null;
  dueDate?: string | null;
  dateRangeStr?: string | null;
  relevantTopics?: string | null;
  chapterText?: string | null;
  pagesText?: string | null;
  isFavorite?: boolean;
}

export interface WeekDTO {
  id: string;
  weekNumber: number;
  startDate?: string | null;
  theme?: string | null;
  dateRangeStr?: string | null;
  readings: ReadingDTO[];
}

export interface AssignmentDTO {
  id: string;
  title: string;
  dueDate?: string | null;
  fullInstructions?: string | null;
  pointsPossible?: string | null;
  weightPercentage?: string | null;
  noteText?: string | null;
  pointsBreakdown?: string | null;
  relevantTopics?: string | null;
  mediaUrl?: string | null;
  rubric?: RubricCriterionDTO[] | null;
  isFavorite?: boolean;
  isCompleted?: boolean;
}

export interface ItemDTO {
  title: string;
  authorName?: string | null;
  resourceTitle?: string | null;
  category: string;
  subType?: string | null;
  description?: string | null;
  points?: string | null;
  pointsBreakdown?: string | null;
  percentage?: string | null;
  weekNumber?: number | null;
  dueDateIso?: string | null;
  mediaUrl?: string | null;
  relevantTopics?: string | null;
  chapterText?: string | null;
  pagesText?: string | null;
  summaryText?: string | null;
  keyTakeaways?: string | null;
  estimatedTime?: string | null;
  rubric?: RubricCriterionDTO[] | null;
}

export interface CourseDTO {
  id: string;
  creatorId?: string | null;
  courseName: string;
  courseCode?: string | null;
  courseDescription?: string | null;
  instructorName?: string | null;
  instructorEmail?: string | null;
  officeHours?: string | null;
  termWeeks?: number | null;
  sharingCode: string;
  weeks?: WeekDTO[] | null;
  assignments?: AssignmentDTO[] | null;
  items?: ItemDTO[] | null;
  dataExtractionStats?: ExtractionStatsDTO | null;
  isFavorite?: boolean | null;
  chatHistoryJSON?: string | null;
}

export interface Course {
  id: string;
  creatorId: string;
  courseName: string;
  courseCode?: string | null;
  courseDescription?: string | null;
  instructorName?: string | null;
  instructorEmail?: string | null;
  hexColor: string;
  termWeeks: number;
  sharingCode: string;
  isDeleted: boolean;
  isFavorite: boolean;
  chatHistoryJSON?: string | null;
  createdAt: Date;
  weeks: Week[];
  assignments: Assignment[];
  syllabusDocs: SyllabusDocument[];
}

export interface Week {
  id: string;
  weekNumber: number;
  startDate?: Date | null;
  theme?: string | null;
  dateRangeStr?: string | null;
  courseId?: string;
  readings: Reading[];
}

export interface Reading {
  id: string;
  title: string;
  authorName?: string | null;
  resourceTitle?: string | null;
  mediaTypeRaw: string;
  mediaType: MediaType;
  isCompleted: boolean;
  isDeleted: boolean;
  summaryText: string;
  keyTakeawaysText: string;
  estimatedTimeText: string;
  videoUrl?: string | null;
  sourcePageNumber?: number | null;
  dueDate?: Date | null;
  dateRangeStr?: string | null;
  chapterText?: string | null;
  pagesText?: string | null;
  courseCode?: string | null;
  semanticCategoryRaw?: string | null;
  relevantTopics?: string | null;
  sourceDocumentName?: string | null;
  docColorHex?: string | null;
  isFavorite: boolean;
  weekId?: string;
}

export interface Assignment {
  id: string;
  title: string;
  weekNumber: number;
  dueDate?: Date | null;
  fullInstructions?: string | null;
  pointsPossible?: string | null;
  pointsBreakdown?: string | null;
  rubricJSON?: string | null;
  noteText?: string | null;
  isCompleted: boolean;
  isDeleted: boolean;
  courseCode?: string | null;
  moduleMention?: string | null;
  weightPercentage?: string | null;
  subTypeRaw?: string | null;
  mediaUrl?: string | null;
  relevantTopics?: string | null;
  sourceDocumentName?: string | null;
  docColorHex?: string | null;
  isFavorite: boolean;
  courseId?: string;
  rubricCriteria: RubricCriterionDTO[];
}

export interface SyllabusDocument {
  id: string;
  docTitle: string;
  officeHoursText?: string | null;
  instructorContact?: string | null;
  gradingPolicyText?: string | null;
  fileName?: string | null;
  rawFileDataUri?: string | null;
  uploadedAt: Date;
  courseCode?: string | null;
  docColorHex?: string | null;
  courseId?: string;
}

export interface VaultDocument {
  id: string;
  title: string;
  category: string;
  fileSize: string;
  fileType: string;
  courseCode?: string | null;
  fileContent?: string | null;
  docColorHex?: string | null;
  rawFileDataUri?: string | null;
  uploadedAt: Date;
}
