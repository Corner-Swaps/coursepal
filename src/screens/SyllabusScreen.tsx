/**
 * SyllabusScreen
 * 1:1 Parity with native Swift SyllabusRepositoryView.swift
 * Comprehensive Course & Document Vault repository with expandable course rows,
 * faculty contact details, direct inline assignments/readings, and full CRUD.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useCoursePal } from '../context/CoursePalContext';
import { CoursePalTheme } from '../constants/theme';
import {
  GraduationCapFillIcon,
  DocFillIcon,
  ChevronRightIcon,
  TrashIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeFillIcon,
  DocBadgePlusIcon,
  FolderBadgePlusIcon
} from '../components/SvgIcons';
import { Course, VaultDocument, Assignment, Reading } from '../types/models';
import {
  DocumentPreviewModal,
  CourseDetailModal,
  EditAssignmentModal,
  AssignmentDetailModal,
  ReadingDetailModal,
  UploadDocumentModal
} from '../components/modals';
import {
  formatShortDocumentTitle,
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  parseSafeDate,
  getReadingChapterSortKey,
  isInvalidAssignmentTitle,
  cleanUploadStatusMessage,
  isItemForCourse
} from '../utils/readingDisplayHelper';
import { CalendarExportService } from '../services/CalendarExportService';
import { ensureBundledPdfFile } from '../utils/bundledPdfService';

interface SyllabusScreenProps {
  onOpenAddTaskModal: (courseId?: string, category?: 'assignment' | 'reading') => void;
  onOpenAddCourseModal: () => void;
}

export const SyllabusScreen: React.FC<SyllabusScreenProps> = ({
  onOpenAddTaskModal,
  onOpenAddCourseModal
}) => {
  const {
    courses,
    assignments,
    vaultDocs,
    readings,
    deleteCourse,
    deleteVaultDoc,
    deleteReading,
    deleteAssignment,
    updateCourse,
    updateAssignment,
    updateReading,
    isUploading,
    uploadStatusText,
    uploadProgress,
    startUploadSimulation
  } = useCoursePal();

  const [selectedCategory, setSelectedCategory] = useState<'syllabi' | 'documents'>('syllabi');
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTargetCourseId, setUploadTargetCourseId] = useState<string | undefined>(undefined);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [selectedAssignmentForDetail, setSelectedAssignmentForDetail] = useState<Assignment | null>(null);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);

  const handleOpenUpload = (targetCourseId?: string) => {
    setUploadTargetCourseId(targetCourseId);
    setShowUploadModal(true);
  };

  const activeCourses = courses.filter(c => !c.isDeleted);

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const confirmDeleteCourse = (course: Course) => {
    const readingCount = readings.filter(
      r => !r.isDeleted && isItemForCourse(r, course)
    ).length;
    const assignmentCount = assignments.filter(
      a => !a.isDeleted && isItemForCourse(a, course)
    ).length;

    Alert.alert(
      'Delete Course?',
      `Are you sure you want to delete '${course.courseName}'? This will remove its ${readingCount} readings, ${assignmentCount} assignments, and attached documents.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Course',
          style: 'destructive',
          onPress: () => deleteCourse(course.id)
        }
      ]
    );
  };

  const confirmDeleteDoc = (doc: VaultDocument) => {
    Alert.alert(
      'Delete Document?',
      `Are you sure you want to permanently delete '${doc.title}' from your stored documents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Document',
          style: 'destructive',
          onPress: () => deleteVaultDoc(doc.id)
        }
      ]
    );
  };

  const renderSyllabusReadingRow = (reading: Reading, courseName?: string | null, weekTheme?: string | null) => {
    const readingWithTopic = {
      ...reading,
      relevantTopics: reading.relevantTopics || weekTheme || undefined
    };
    const dispTitle = formatDisplayTitleWithChapter(
      readingWithTopic,
      reading.chapterText,
      reading.resourceTitle,
      courseName
    );
    const dispSub = formatAuthorAndPagesSubtitle(
      readingWithTopic,
      reading.pagesText,
      reading.resourceTitle,
      dispTitle,
      courseName
    );
    return (
      <TouchableOpacity
        key={reading.id}
        style={styles.itemPillRow}
        onPress={() => setEditingReading(reading)}
        activeOpacity={0.7}
      >
        <Text style={styles.itemTitleText}>{dispTitle}</Text>
        {dispSub.length > 0 && <Text style={styles.itemAuthorText}>{dispSub}</Text>}
        {reading.dueDate && (() => {
          const d = parseSafeDate(reading.dueDate);
          if (!d) return null;
          return (
            <Text style={styles.itemDueText}>
              Due{' '}
              {d.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          );
        })()}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.rootContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        alwaysBounceHorizontal={false}
        alwaysBounceVertical={true}
        bounces={true}
        overScrollMode="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        testID="syllabus-screen-scroll"
      >
        {/* MARK: - Vault Category Filter Bar (Courses First, Documents Second) */}
        <View style={styles.filterBarContainer}>
          <TouchableOpacity
            style={[
              styles.filterTile,
              selectedCategory === 'syllabi' && styles.filterTileActive
            ]}
            onPress={() => setSelectedCategory('syllabi')}
            activeOpacity={0.8}
            testID="syllabus-courses-tab"
          >
            <GraduationCapFillIcon
              size={22}
              color={selectedCategory === 'syllabi' ? CoursePalTheme.accentBlue : '#596B85'}
            />
            <Text
              style={[
                styles.filterTileText,
                selectedCategory === 'syllabi' && styles.filterTileTextActive
              ]}
            >
              Courses ({activeCourses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTile,
              selectedCategory === 'documents' && styles.filterTileActive
            ]}
            onPress={() => setSelectedCategory('documents')}
            activeOpacity={0.8}
            testID="syllabus-documents-tab"
          >
            <DocFillIcon
              size={22}
              color={selectedCategory === 'documents' ? '#7C3AED' : '#596B85'}
            />
            <Text
              style={[
                styles.filterTileText,
                selectedCategory === 'documents' && styles.filterTileTextActive
              ]}
            >
              Documents ({vaultDocs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* MARK: - Main Content Area */}
        {selectedCategory === 'syllabi' ? (
          /* Courses List */
          <View style={styles.listContainer}>
            {/* Blue Loading Bar Pill Above Top Course */}
            {isUploading && (
              <View style={styles.uploadStatusBanner}>
                <View style={styles.uploadStatusTop}>
                  <ActivityIndicator size="small" color={CoursePalTheme.accentBlue} />
                  <Text style={styles.uploadStatusTitle} numberOfLines={1}>
                    {cleanUploadStatusMessage(uploadStatusText)}
                  </Text>
                  <Text style={styles.uploadStatusPercent}>
                    {Math.round(Math.min(100, Math.max(1, (uploadProgress ?? 0.01) * 100)))}%
                  </Text>
                </View>

                {/* Horizontal Blue Loading Bar Track & Fill */}
                <View style={styles.uploadProgressBarTrack}>
                  <View
                    style={[
                      styles.uploadProgressBarFill,
                      {
                        width: `${Math.round(Math.min(100, Math.max(1, (uploadProgress ?? 0.01) * 100)))}%`
                      }
                    ]}
                  />
                </View>

                {/* Whole Message */}
                <Text style={styles.uploadStatusEducational}>
                  Deep analysis takes 1–2 minutes to extract all readings and assignments accurately. You can freely browse other sections or exit the app — processing will continue in the background.
                </Text>
              </View>
            )}

            {activeCourses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Courses Found</Text>
                <Text style={styles.emptyDesc}>
                  Upload a syllabus document or create a course to get started.
                </Text>
              </View>
            ) : (
              activeCourses.map(course => {
                const isExpanded = expandedCourseIds.has(course.id);
                const cleanCourseCode = (course.courseCode || course.courseName || '').replace(/\s+/g, '').toLowerCase();
                const courseReadings = readings.filter(
                  r => !r.isDeleted && isItemForCourse(r, course)
                );

                const courseAssignments = assignments
                  .filter(
                    a =>
                      !a.isDeleted &&
                      isItemForCourse(a, course) &&
                      !isInvalidAssignmentTitle(a.title)
                  )
                  .sort((a, b) => {
                    const d1 = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                    const d2 = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                    return d1 - d2;
                  });

                // Group readings: partition into unassigned and week-grouped
                const unassignedCourseReadings: Reading[] = [];
                const readingsByWeek = new Map<number, Reading[]>();
                for (const r of courseReadings) {
                  const isWeekOn = r.weekNumber !== undefined && r.weekNumber !== null
                    ? r.weekNumber > 0
                    : Boolean(r.weekId && r.weekId !== 'none' && /\d+/.test(r.weekId));
                  if (!isWeekOn) {
                    unassignedCourseReadings.push(r);
                  } else {
                    const m = r.weekNumber && r.weekNumber > 0
                      ? r.weekNumber
                      : parseInt(r.weekId!.match(/\d+/)![0], 10);
                    const list = readingsByWeek.get(m) || [];
                    list.push(r);
                    readingsByWeek.set(m, list);
                  }
                }
                const sortedWeeks = Array.from(readingsByWeek.keys()).sort((a, b) => a - b);

                return (
                  <View key={course.id} style={styles.courseCard}>
                    {/* Header Bar */}
                    <View style={styles.courseHeaderRow}>
                      {/* Left Accent Stripe */}
                      <View
                        style={[styles.leftAccentBar, { backgroundColor: course.hexColor }]}
                      />

                      {/* Course Title & Counts - Tap to Expand/Collapse */}
                      <TouchableOpacity
                        style={styles.courseInfoCol}
                        onPress={() => toggleCourseExpand(course.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.courseTitleText} numberOfLines={1}>
                          {course.courseName}
                        </Text>
                        {course.courseDescription ? (
                          <Text style={styles.courseSubtitleText} numberOfLines={1}>
                            {course.courseDescription}
                          </Text>
                        ) : null}
                        <Text style={styles.courseStatsSubtitle} numberOfLines={1}>
                          {courseReadings.length} Readings • {courseAssignments.length} Assignments
                        </Text>
                      </TouchableOpacity>

                      {/* Action Buttons: Trash, Chevron */}
                      <View style={styles.cardActionsRow}>
                        {/* Trash Button */}
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => confirmDeleteCourse(course)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                          <TrashIcon size={15} color="#D94033" />
                        </TouchableOpacity>

                        {/* Expand / Collapse Chevron */}
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => toggleCourseExpand(course.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                        >
                          {isExpanded ? (
                            <ChevronUpIcon size={14} color="#596B85" />
                          ) : (
                            <ChevronDownIcon size={14} color="#596B85" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Expanded Content Dropdown */}
                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        <View style={styles.divider} />

                        {/* Explanatory Pill */}
                        <View style={styles.instructionPill}>
                          <Text style={styles.instructionText}>
                            Tap anywhere below to edit course and faculty details
                          </Text>
                        </View>

                        {/* Course & Faculty Details */}
                        <View style={styles.sectionContainer}>
                          <Text style={styles.sectionTitle}>Course & Faculty Details</Text>
                          <TouchableOpacity
                            style={styles.facultyDetailsCard}
                            onPress={() => setEditingCourse(course)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.detailRow}>
                              <Text style={styles.detailKey}>Faculty:</Text>
                              <Text style={styles.detailVal}>
                                {course.instructorName || 'Not specified'}
                              </Text>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailKey}>Email:</Text>
                              <Text style={styles.detailVal}>
                                {course.instructorEmail || 'Not specified'}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {/* View Original Syllabus PDF Action */}
                          <TouchableOpacity
                            style={[
                              styles.viewPdfActionRow,
                              { borderColor: (course.hexColor || CoursePalTheme.accentBlue) + '40' }
                            ]}
                            activeOpacity={0.7}
                            onPress={async () => {
                              const matchedDoc = vaultDocs.find(d =>
                                (d.courseCode && course.courseCode && d.courseCode.toUpperCase() === course.courseCode.toUpperCase()) ||
                                (d as any).courseId === course.id ||
                                d.id === `vd-${course.id}-syllabus`
                              );
                              if (matchedDoc) {
                                setPreviewDoc(matchedDoc);
                              } else {
                                const pdfUri = await ensureBundledPdfFile(course.courseCode || course.courseName);
                                setPreviewDoc({
                                  id: `vd-${course.id}-syllabus`,
                                  title: `${course.courseCode || course.courseName} Syllabus`,
                                  category: 'Syllabi',
                                  fileSize: '410 KB',
                                  fileType: 'PDF',
                                  courseCode: course.courseCode,
                                  fileContent: course.courseDescription,
                                  docColorHex: course.hexColor,
                                  rawFileDataUri: pdfUri,
                                  pageImages: null,
                                  uploadedAt: new Date()
                                });
                              }
                            }}
                          >
                            <View
                              style={[
                                styles.viewPdfIconBox,
                                { backgroundColor: (course.hexColor || CoursePalTheme.accentBlue) + '18' }
                              ]}
                            >
                              <DocFillIcon size={17} color={course.hexColor || CoursePalTheme.accentBlue} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.viewPdfText, { color: course.hexColor || CoursePalTheme.accentBlue }]}>
                                View Original Syllabus PDF
                              </Text>
                              <Text style={styles.viewPdfSubtext}>
                                High-res document viewer & Apple Quick Look
                              </Text>
                            </View>
                            <ChevronRightIcon size={14} color={course.hexColor || CoursePalTheme.accentBlue} />
                          </TouchableOpacity>
                        </View>


                        {/* Assignments Section */}
                        <View style={styles.sectionContainer}>
                          <Text style={styles.sectionTitle}>Assignments</Text>
                          <View style={styles.itemsListContainer}>
                            {courseAssignments.map(assign => {
                              let resolvedWeight = assign.weightPercentage;
                              if (!resolvedWeight) {
                                const wm = (assign.title + ' ' + (assign.fullInstructions || '')).match(/(?:worth\s+|weight:\s*)?(\d{1,2}(?:\.\d+)?)\s*%/i);
                                if (wm) resolvedWeight = `${wm[1]}%`;
                                else if (assign.pointsPossible) resolvedWeight = assign.pointsPossible;
                              } else if (!resolvedWeight.endsWith('%')) {
                                resolvedWeight = `${resolvedWeight}%`;
                              }

                              const cleanTitle = (assign.title || '')
                                .replace(/\b(?:modules?|mod|weeks?|wk)\s*\d{1,2}(?:\s*[-–—]\s*\d{1,2})?\b/gi, '')
                                .replace(/^(?:module|week|mod|wk)\s*\d+[\s:\-–—]+/i, '')
                                .replace(/^\d+[\.)]\s*/, '')
                                .replace(/\s*\(\s*\d{1,3}%\s*\)$/, '')
                                .replace(/\s*[-–—]\s*(?:due|worth|weight).*$/i, '')
                                .replace(/^[•\-*▪●:–— \t\n]+|[•\-*▪●:–— \t\n]+$/g, '')
                                .trim() || 'Assignment';

                              return (
                                <TouchableOpacity
                                  key={assign.id}
                                  style={styles.assignmentSyllabusRow}
                                  onPress={() => setSelectedAssignmentForDetail(assign)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.assignmentSyllabusTitle} numberOfLines={2}>
                                    {cleanTitle}
                                  </Text>
                                  {resolvedWeight ? (
                                    <View
                                      style={[
                                        styles.assignmentSyllabusWeightPill,
                                        { backgroundColor: (course.hexColor || CoursePalTheme.accentBlue) + '18' }
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.assignmentSyllabusWeightText,
                                          { color: course.hexColor || CoursePalTheme.accentBlue }
                                        ]}
                                      >
                                        {resolvedWeight}
                                      </Text>
                                    </View>
                                  ) : null}
                                </TouchableOpacity>
                              );
                            })}

                            {/* Add Assignment Action Pill */}
                            <TouchableOpacity
                              style={styles.addItemActionPill}
                              onPress={() => onOpenAddTaskModal(course.id, 'assignment')}
                              activeOpacity={0.7}
                            >
                              <PlusIcon size={13} color="#596B85" />
                              <Text style={styles.addItemActionText}>Add Assignment</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Readings Section */}
                        <View style={styles.sectionContainer}>
                          <Text style={styles.sectionTitle}>Readings</Text>
                          {courseReadings.length === 0 ? (
                            <View style={styles.emptyItemsBox}>
                              {course.externalScheduleNotice ? (
                                <Text style={[styles.emptyItemsText, { fontStyle: 'italic', color: '#4B5563' }]}>
                                  {course.externalScheduleNotice}
                                </Text>
                              ) : (
                                <Text style={styles.emptyItemsText}>No readings in this course yet.</Text>
                              )}
                            </View>
                          ) : (
                            <>
                              {/* Non-week readings (when week toggle is turned off) */}
                              {unassignedCourseReadings.length > 0 && (
                                <View style={styles.unassignedReadingsBox}>
                                  {[...unassignedCourseReadings].sort((a, b) => {
                                    const chA = getReadingChapterSortKey(a);
                                    const chB = getReadingChapterSortKey(b);
                                    if (chA !== chB) return chA - chB;
                                    const dA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                                    const dB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                                    if (dA !== dB) return dA - dB;
                                    return (a.title || '').localeCompare(b.title || '');
                                  }).map(r => {
                                    const wObj = (course.weeks || []).find(w => w.weekNumber === r.weekNumber);
                                    return renderSyllabusReadingRow(r, course.courseName, wObj?.theme);
                                  })}
                                </View>
                              )}

                              {/* Week-grouped readings (when week toggle is turned on) */}
                              {sortedWeeks.map(wNum => {
                                const weekObj = (course.weeks || []).find(w => w.weekNumber === wNum);
                                const weekReadings = [...(readingsByWeek.get(wNum) || [])].sort((a, b) => {
                                  const chA = getReadingChapterSortKey(a);
                                  const chB = getReadingChapterSortKey(b);
                                  if (chA !== chB) return chA - chB;
                                  const dA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                                  const dB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                                  if (dA !== dB) return dA - dB;
                                  return (a.title || '').localeCompare(b.title || '');
                                });
                                return (
                                  <View key={`week-${wNum}`} style={styles.weekSectionBox}>
                                    {/* Week Section Header */}
                                    <View style={styles.weekSectionHeader}>
                                      <View style={styles.weekTagPill}>
                                        <Text style={styles.weekTagText}>Week {wNum}</Text>
                                      </View>
                                    </View>

                                    {weekReadings.map(r => renderSyllabusReadingRow(r, course.courseName, weekObj?.theme))}
                                  </View>
                                );
                              })}
                            </>
                          )}

                          {/* Add Reading Action Pill */}
                          <TouchableOpacity
                            style={styles.addItemActionPill}
                            onPress={() => onOpenAddTaskModal(course.id, 'reading')}
                            activeOpacity={0.7}
                          >
                            <PlusIcon size={13} color="#596B85" />
                            <Text style={styles.addItemActionText}>Add Reading</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* Documents List */
          <View style={styles.listContainer}>
            {vaultDocs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Documents Found</Text>
                <Text style={styles.emptyDesc}>
                  There are no syllabus documents uploaded yet.
                </Text>
              </View>
            ) : (
              vaultDocs.map(doc => {
                const docReadings = readings.filter(r =>
                  !r.isDeleted && (
                    (r as any).sourceDocumentId === doc.id ||
                    (r.sourceDocumentName && (
                      r.sourceDocumentName.toLowerCase() === doc.title.toLowerCase() ||
                      doc.title.toLowerCase().includes(r.sourceDocumentName.toLowerCase()) ||
                      r.sourceDocumentName.toLowerCase().includes(doc.title.toLowerCase())
                    )) ||
                    (doc.courseId && r.courseId === doc.courseId)
                  )
                );
                const docAssignments = assignments.filter(a =>
                  !a.isDeleted && (
                    (a as any).sourceDocumentId === doc.id ||
                    (a.sourceDocumentName && (
                      a.sourceDocumentName.toLowerCase() === doc.title.toLowerCase() ||
                      doc.title.toLowerCase().includes(a.sourceDocumentName.toLowerCase()) ||
                      a.sourceDocumentName.toLowerCase().includes(doc.title.toLowerCase())
                    )) ||
                    (doc.courseId && a.courseId === doc.courseId)
                  )
                );

                return (
                  <View key={doc.id} style={styles.docCard}>
                    <TouchableOpacity
                      style={styles.docMainClickable}
                      onPress={() => setPreviewDoc(doc)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.docIconSquare}>
                        <DocFillIcon size={18} color="#7C3AED" />
                      </View>

                      <View style={styles.docInfoCol}>
                        <Text style={styles.docTitle} numberOfLines={1}>
                          {formatShortDocumentTitle(doc.title)}
                        </Text>
                        <Text style={styles.docSubtitle} numberOfLines={1}>
                          {doc.courseCode || 'Course Syllabus'}
                        </Text>
                        <Text style={styles.docStatsSubtitle} numberOfLines={1}>
                          {docReadings.length} Readings • {docAssignments.length} Assignments
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Eye Preview Button */}
                    <TouchableOpacity
                      style={styles.eyePreviewButton}
                      onPress={() => setPreviewDoc(doc)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <EyeFillIcon size={17} color={CoursePalTheme.accentBlue} />
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.deleteDocButton}
                      onPress={() => confirmDeleteDoc(doc)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <TrashIcon size={15} color="#D94033" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>



      {/* MARK: - Modals */}
      <CourseDetailModal
        visible={editingCourse !== null}
        course={editingCourse}
        assignments={assignments}
        readings={readings}
        onClose={() => setEditingCourse(null)}
        onSave={updated => updateCourse(updated)}
        onAddAssignment={cid => {
          setEditingCourse(null);
          onOpenAddTaskModal(cid, 'assignment');
        }}
        onAddReading={cid => {
          setEditingCourse(null);
          onOpenAddTaskModal(cid, 'reading');
        }}
        onEditAssignment={assign => {
          setEditingCourse(null);
          setSelectedAssignmentForDetail(assign);
        }}
        onEditReading={reading => {
          setEditingCourse(null);
          setEditingReading(reading);
        }}
      />

      <AssignmentDetailModal
        visible={selectedAssignmentForDetail !== null}
        assignment={selectedAssignmentForDetail}
        courses={courses}
        onClose={() => setSelectedAssignmentForDetail(null)}
        onEdit={assign => {
          setEditingAssignment(assign);
        }}
        onToggleComplete={id => {
          const a = assignments.find(x => x.id === id);
          if (a) {
            updateAssignment({ ...a, isCompleted: !a.isCompleted });
            if (selectedAssignmentForDetail?.id === id) {
              setSelectedAssignmentForDetail({ ...selectedAssignmentForDetail, isCompleted: !selectedAssignmentForDetail.isCompleted });
            }
          }
        }}
        onUpdateAssignment={updated => {
          updateAssignment(updated);
          setSelectedAssignmentForDetail(updated);
        }}
        onDeleteAssignment={id => {
          deleteAssignment(id);
          setSelectedAssignmentForDetail(null);
        }}
      />

      <EditAssignmentModal
        visible={editingAssignment !== null}
        assignment={editingAssignment}
        courses={courses}
        onClose={() => setEditingAssignment(null)}
        onSave={updated => {
          updateAssignment(updated);
          if (selectedAssignmentForDetail?.id === updated.id) {
            setSelectedAssignmentForDetail(updated);
          }
        }}
        onDeleteAssignment={id => {
          deleteAssignment(id);
          if (selectedAssignmentForDetail?.id === id) {
            setSelectedAssignmentForDetail(null);
          }
        }}
      />

      <ReadingDetailModal
        visible={editingReading !== null}
        reading={editingReading}
        courses={courses}
        onClose={() => setEditingReading(null)}
        onSave={updated => updateReading(updated)}
        onDeleteReading={id => deleteReading(id)}
      />

      <DocumentPreviewModal
        visible={previewDoc !== null}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <UploadDocumentModal
        visible={showUploadModal}
        targetCourseId={uploadTargetCourseId}
        onClose={() => {
          setShowUploadModal(false);
          setUploadTargetCourseId(undefined);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#F2F5FA',
    width: '100%'
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA',
    width: '100%'
  },
  scrollContent: {
    paddingBottom: 140
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12
  },
  headerLeftCol: {
    flex: 1
  },
  uploadDocBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    padding: 12,
    marginBottom: 12,
    gap: 10
  },
  uploadDocBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploadDocBannerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1D4ED8'
  },
  pageTitle: {
    fontSize: 21.5,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.4
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  filterBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    marginHorizontal: 18,
    marginTop: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10
  },
  filterTile: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10.5,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    gap: 5
  },
  filterTileActive: {
    backgroundColor: '#EDF0F5',
    borderColor: '#D1D9E6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2
  },
  filterTileText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  filterTileTextActive: {
    fontWeight: '700',
    color: '#141F38'
  },
  uploadStatusBanner: {
    backgroundColor: 'rgba(36, 112, 245, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(36, 112, 245, 0.20)',
    padding: 14,
    gap: 8
  },
  uploadStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  uploadStatusTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  uploadStatusPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  uploadProgressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(36, 112, 245, 0.16)',
    overflow: 'hidden'
  },
  uploadProgressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CoursePalTheme.accentBlue
  },
  uploadStatusEducational: {
    fontSize: 12,
    fontWeight: '400',
    color: '#596B85',
    lineHeight: 17
  },
  listContainer: {
    marginHorizontal: 18,
    marginTop: 16,
    gap: 12
  },
  emptyCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 90,
    paddingHorizontal: 24
  },
  emptyCenterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#596B85',
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyCenterDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E9BAE',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 6
  },
  emptyDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    textAlign: 'center',
    maxWidth: 240
  },
  addCourseButton: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14
  },
  addCourseButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden'
  },
  courseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10
  },
  leftAccentBar: {
    width: 4,
    height: 36,
    borderRadius: 3
  },
  courseInfoCol: {
    flex: 1
  },
  courseTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19,
    letterSpacing: -0.2
  },
  courseSubtitleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  courseStatsSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionIconButton: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: '#F2F5FA',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F6',
    marginHorizontal: 14
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16
  },
  instructionPill: {
    backgroundColor: '#F0F3F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#080C16'
  },
  sectionContainer: {
    gap: 8
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  facultyDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 12,
    gap: 6
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  detailKey: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#374151'
  },
  detailVal: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#596B85'
  },
  itemsListContainer: {
    gap: 8
  },
  assignmentSyllabusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  assignmentSyllabusTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 20
  },
  assignmentSyllabusWeightPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  assignmentSyllabusWeightText: {
    fontSize: 13,
    fontWeight: '700'
  },
  itemPillRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 4
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2
  },
  weekTagPill: {
    backgroundColor: '#738094',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12
  },
  weekTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  moduleTagPill: {
    backgroundColor: '#738094',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12
  },
  moduleTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  itemTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#384761',
    lineHeight: 19
  },
  itemAuthorText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85'
  },
  itemDueText: {
    fontSize: 13,
    color: '#596B85'
  },
  itemPointsWeightText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB'
  },
  addItemActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8
  },
  addItemActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#596B85'
  },
  emptyItemsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10
  },
  emptyItemsText: {
    fontSize: 12,
    color: '#596B85'
  },
  unassignedReadingsBox: {
    gap: 6,
    marginTop: 4
  },
  weekSectionBox: {
    gap: 6,
    marginTop: 4
  },
  weekSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
    gap: 10
  },
  docMainClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  docIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  docInfoCol: {
    flex: 1
  },
  docTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19,
    letterSpacing: -0.2
  },
  docSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  docStatsSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2
  },
  eyePreviewButton: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: '#F2F5FA',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteDocButton: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: '#F2F5FA',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionMenuHeader: {
    marginBottom: 16
  },
  actionMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.3,
    marginBottom: 3
  },
  actionMenuSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  actionMenuItemsList: {
    gap: 12
  },
  actionOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  actionIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  actionOptionTextCol: {
    flex: 1
  },
  actionOptionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 2
  },
  actionOptionDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: '#596B85'
  },
  viewPdfActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.2,
    padding: 10,
    gap: 10,
    marginTop: 8
  },
  viewPdfIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewPdfText: {
    fontSize: 13.5,
    fontWeight: '700'
  },
  viewPdfSubtext: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 1
  }
});
