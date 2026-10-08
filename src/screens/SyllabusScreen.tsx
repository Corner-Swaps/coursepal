/**
 * SyllabusScreen
 * 1:1 Parity with native Swift SyllabusRepositoryView.swift
 * Comprehensive Course & Document Vault repository with expandable course rows,
 * faculty contact details, direct inline assignments/readings, and full CRUD.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
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
  FolderBadgePlusIcon,
  CalendarIcon,
  ClockIcon,
  CheckmarkIcon,
  ShieldCheckmarkIcon,
  AppleCalendarIcon,
  GoogleCalendarIcon
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
import { GoogleCalendarService } from '../services/GoogleCalendarService';

import {
  formatShortDocumentTitle,
  cleanDocumentTitle,
  isItemForDocument,
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  formatSuggestedReadingCardText,
  parseSafeDate,
  getReadingChapterSortKey,
  isInvalidAssignmentTitle,
  isGenericPlaceholderReadingTitle,
  isDeliverableNotReading,
  cleanUploadStatusMessage,
  isItemForCourse,
  isRealDateOrRangeString,
  cleanDateRangeDisplay,
  cleanAssignmentTitle,
  cleanAcademicWeekTheme
} from '../utils/readingDisplayHelper';
import { resolveFullAuthorName } from '../utils/authorResolver';
import { ensureBundledPdfFile } from '../utils/bundledPdfService';

interface SyllabusScreenProps {
  onOpenAddTaskModal: (courseId?: string, category?: 'assignment' | 'reading') => void;
  onOpenAddCourseModal?: () => void;
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
    startUploadSimulation,
    unacceptedAccuracyCourseIds,
    activeAccuracyNotice,
    acceptAccuracyNotice
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

  const renderSyllabusReadingRow = (
    reading: Reading,
    courseName?: string | null,
    weekTheme?: string | null,
    fallbackDateStr?: string | null
  ) => {
    const rawAuth = reading.authorName?.trim() || '';
    const resolvedAuth = resolveFullAuthorName(rawAuth) || rawAuth;
    const readingWithTopic = {
      ...reading,
      relevantTopics: reading.relevantTopics || weekTheme || undefined
    };
    const dispTitle = formatDisplayTitleWithChapter(
      readingWithTopic,
      reading.chapterText,
      reading.resourceTitle,
      courseName,
      resolvedAuth
    );

    let cleanAuthorPart: string | null = null;
    if (resolvedAuth && resolvedAuth.trim()) {
      let auth = resolvedAuth.trim().replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '');
      auth = auth.replace(/\s*\(\s*\d{4}\s*\)/g, '').replace(/;\s*/g, ', ').trim();
      if (auth.length > 0) {
        cleanAuthorPart = auth.toLowerCase().startsWith('author:') ? auth : `Author: ${auth}`;
      }
    }

    const cleanDate = (reading.dateRangeStr || reading.dueDate || fallbackDateStr)
      ? formatSuggestedReadingCardText(reading.dueDate, reading.dateRangeStr, fallbackDateStr)
      : null;

    let cleanDatePart: string | null = null;
    if (cleanDate) {
      const dStr = cleanDate.replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();
      if (dStr) cleanDatePart = dStr;
    }

    return (
      <TouchableOpacity
        key={reading.id}
        style={styles.itemPillRow}
        onPress={() => setEditingReading(reading)}
        activeOpacity={0.7}
      >
        <Text style={styles.itemTitleText}>{dispTitle}</Text>
        {cleanAuthorPart ? (
          <Text style={styles.itemAuthorText} numberOfLines={2}>{cleanAuthorPart}</Text>
        ) : null}
        {cleanDatePart ? (
          <Text style={styles.itemSuggestedDateText} numberOfLines={1}>{cleanDatePart}</Text>
        ) : null}
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
            {/* MARK: - In-Page Upload Status Pill placed above No Courses Found */}
            {isUploading && (
              <View style={styles.uploadStatusBanner}>
                <View style={styles.uploadStatusHeaderRow}>
                  {uploadStatusText.toLowerCase().includes('success') ? (
                    <CheckmarkIcon size={16} color="#FFFFFF" strokeWidth={2.6} />
                  ) : (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  )}
                  <Text style={styles.uploadStatusTitle} numberOfLines={1}>
                    {cleanUploadStatusMessage(uploadStatusText)}
                  </Text>
                </View>
                <Text style={styles.uploadStatusEducational}>
                  {uploadStatusText.toLowerCase().includes('success')
                    ? 'Your course schedule, readings, and assignments are ready.'
                    : 'Please stay patient while we carefully organize all your course readings and assignments accurately. You can freely browse other sections or exit the app. Processing will continue in the background.'}
                </Text>
              </View>
            )}

            {/* MARK: - Post-Upload Accuracy Verification Pill (Third Blue Pill) */}
            {!isUploading && (activeAccuracyNotice || unacceptedAccuracyCourseIds.length > 0) && (
              <View style={styles.uploadStatusBanner} testID="accuracy-notice-banner-top">
                <View style={styles.uploadStatusHeaderRow}>
                  <ShieldCheckmarkIcon size={17} color="#FFFFFF" />
                  <Text style={styles.uploadStatusTitle} numberOfLines={1}>
                    Review Your Coursework
                  </Text>
                </View>
                <Text style={styles.uploadStatusEducational}>
                  Our system can make mistakes as different professors and different schools write their syllabi in different ways. Please check everything you can edit in assignment details and in reading details. We appreciate your understanding and we will continue to improve our system.
                </Text>
                <View style={styles.accuracyAcceptActionRow}>
                  <TouchableOpacity
                    style={styles.acceptAccuracyButton}
                    onPress={() => acceptAccuracyNotice(activeAccuracyNotice?.courseId || unacceptedAccuracyCourseIds[0])}
                    activeOpacity={0.8}
                    testID="accept-accuracy-button-top"
                  >
                    <Text style={styles.acceptAccuracyButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeCourses.length === 0 && !isUploading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Courses Found</Text>
                <Text style={styles.emptyDesc}>
                  Add your courses to keep track of readings and assignments.
                </Text>
                <TouchableOpacity
                  style={styles.addCourseButton}
                  onPress={() => setShowUploadModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addCourseButtonText}>Upload Syllabus</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeCourses.map(course => {
                const isExpanded = expandedCourseIds.has(course.id);
                const cleanCourseCode = (course.courseCode || course.courseName || '').replace(/\s+/g, '').toLowerCase();
                const courseReadings = readings.filter(
                  r =>
                    !r.isDeleted &&
                    isItemForCourse(r, course) &&
                    !isGenericPlaceholderReadingTitle(r.title) &&
                    !isDeliverableNotReading(r.title, { moduleNumber: r.moduleNumber, chapterText: r.chapterText }) &&
                    !/^(?:total\s+)?(?:course\s+|grade\s+|assignment\s+)?points?\b/i.test(r.title || '')
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

                  if (isWeekOn) {
                    const m = r.weekNumber && r.weekNumber > 0 ? r.weekNumber : parseInt(r.weekId!.match(/\d+/)![0], 10);
                    const list = readingsByWeek.get(m) || [];
                    list.push(r);
                    readingsByWeek.set(m, list);
                  } else {
                    unassignedCourseReadings.push(r);
                  }
                }
                const allCourseWeekNumbers = new Set<number>();
                (course.weeks || []).forEach(w => {
                  if (typeof w.weekNumber === 'number' && w.weekNumber > 0) {
                    allCourseWeekNumbers.add(w.weekNumber);
                  }
                });
                for (const wKey of readingsByWeek.keys()) {
                  allCourseWeekNumbers.add(wKey);
                }
                const sortedWeeks = Array.from(allCourseWeekNumbers).sort((a, b) => a - b);

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
                        <Text style={styles.courseTitleText} numberOfLines={2}>
                          {course.courseCode && !course.courseName.toLowerCase().includes(course.courseCode.toLowerCase())
                            ? `${course.courseCode}: ${course.courseName}`
                            : course.courseName}
                        </Text>
                        {course.courseDescription && !/imported from|faculty:|hours of operation|operating hours|office hours/i.test(course.courseDescription) ? (
                          <Text style={styles.courseSubtitleText} numberOfLines={2}>
                            {course.courseDescription}
                          </Text>
                        ) : null}
                        <View style={styles.courseHeaderPillsRow}>
                          <View style={styles.courseStatsPill}>
                            <Text style={styles.courseStatsPillText}>{courseReadings.length} Readings</Text>
                          </View>
                          <View style={styles.courseStatsPill}>
                            <Text style={styles.courseStatsPillText}>{courseAssignments.length} Assignments</Text>
                          </View>
                          {course.lowConfidence ? (
                            <View style={styles.reviewNeededBadge}>
                              <Text style={styles.reviewNeededBadgeText}>Review needed</Text>
                            </View>
                          ) : null}
                        </View>
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

                        {/* Course Name Section */}
                        <View style={styles.sectionContainer}>
                          <Text style={styles.sectionTitle}>Course Name</Text>
                          <TouchableOpacity
                            style={styles.facultyDetailsCard}
                            onPress={() => setEditingCourse(course)}
                            activeOpacity={0.7}
                            testID={`course-name-card-${course.id}`}
                          >
                            <View style={styles.detailRow}>
                              <Text style={styles.detailKey}>Name:</Text>
                              <Text style={[styles.detailVal, { fontWeight: '600', color: '#1E293B', flex: 1 }]} numberOfLines={2}>
                                {course.courseName}
                              </Text>
                            </View>
                            {course.courseCode ? (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailKey}>Course Code:</Text>
                                <Text style={[styles.detailVal, { fontWeight: '600', color: course.hexColor || CoursePalTheme.accentBlue }]}>
                                  {course.courseCode}
                                </Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
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
                            {course.officeHours ? (
                              <View style={styles.detailRow}>
                                <Text style={styles.detailKey}>Hours of Operation:</Text>
                                <Text style={styles.detailVal}>{course.officeHours}</Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        </View>

                        {/* Required Textbooks & Key Authors */}
                        {course.textbooks && course.textbooks.length > 0 && (
                          <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Required Textbooks & Authors</Text>
                            <View style={styles.textbooksContainer}>
                              {course.textbooks.map((tb, tbIdx) => (
                                <View key={`tb-${course.id}-${tbIdx}`} style={styles.textbookItemCard}>
                                  <Text style={styles.textbookTitleText}>{tb.title}</Text>
                                  {tb.authorName ? (
                                    <Text style={styles.textbookAuthorText}>Author: {resolveFullAuthorName(tb.authorName) || tb.authorName}</Text>
                                  ) : null}
                                  {tb.edition ? (
                                    <Text style={styles.textbookEditionText}>Edition: {tb.edition}</Text>
                                  ) : null}
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Assignments Section */}
                        <View style={styles.sectionContainer}>
                          <Text style={styles.sectionTitle}>Assignments</Text>
                          <View style={styles.itemsListContainer}>
                            {courseAssignments.map((assign, index) => {
                              let resolvedWeight = assign.weightPercentage;
                              if (!resolvedWeight) {
                                const textToScan = `${assign.title || ''} ${assign.fullInstructions || ''} ${assign.noteText || ''} ${assign.relevantTopics || ''}`;
                                const wm = textToScan.match(/\b(?:worth\s+|weight:\s*)?(\d{1,2}(?:\.\d+)?)\s*%/i) || textToScan.match(/\b(\d{1,2})\s*percent\b/i);
                                if (wm) resolvedWeight = `${wm[1]}%`;
                              } else if (!resolvedWeight.endsWith('%')) {
                                resolvedWeight = `${resolvedWeight}%`;
                              }

                              let cleanPts = assign.pointsPossible
                                ? assign.pointsPossible.replace(/Points/i, 'pts').trim()
                                : null;

                              // Harmonize points: if missing, calculate from rubric criteria or notes
                              if (!cleanPts && assign.rubricCriteria && assign.rubricCriteria.length > 0) {
                                const sumPts = assign.rubricCriteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
                                if (sumPts > 0) {
                                  cleanPts = `${sumPts} pts`;
                                }
                              }
                              if (!cleanPts) {
                                const textToScan = `${assign.title || ''} ${assign.fullInstructions || ''} ${assign.noteText || ''}`;
                                const pm = textToScan.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
                                if (pm) {
                                  cleanPts = `${pm[1]} pts`;
                                }
                              }

                              const assignNum = assign.assignmentNumber || (index + 1);
                              const isContinuous = /continuous/i.test(assign.title || '') || /continuous/i.test(assign.noteText || '') || assign.subTypeRaw === 'continuous';
                              const isMultiWeek = Array.isArray(assign.scheduledWeeks) && assign.scheduledWeeks.length > 1;
                              const weekTagLabel = isContinuous
                                ? 'Continuous'
                                : isMultiWeek
                                ? `Weeks ${Math.min(...assign.scheduledWeeks!)}–${Math.max(...assign.scheduledWeeks!)}`
                                : assign.weekNumber && assign.weekNumber > 0
                                ? `Week ${assign.weekNumber}`
                                : (assign.assignmentNumber ? `Week ${assign.assignmentNumber}` : 'Task');

                              const rawAssignTitle = assign.title || 'Assignment';
                              const cleanTitle = cleanAssignmentTitle(rawAssignTitle) || rawAssignTitle;

                              return (
                                <View key={assign.id} style={styles.assignmentSectionBox}>
                                  {/* Section Header: Gray Pill "Assignment X" on left, Weight/Points on right */}
                                  <View style={styles.assignmentSectionHeader}>
                                    <View style={styles.weekTagPill}>
                                      <Text style={styles.weekTagText}>{weekTagLabel}</Text>
                                    </View>

                                    <View style={styles.assignmentPillsRow}>
                                      {resolvedWeight ? (
                                        <View style={styles.assignmentSyllabusWeightPill}>
                                          <Text style={styles.assignmentSyllabusWeightText}>
                                            {resolvedWeight}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {cleanPts ? (
                                        <View style={styles.assignmentSyllabusPointsPill}>
                                          <Text style={styles.assignmentSyllabusPointsText}>
                                            {cleanPts}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  </View>

                                  {/* Clickable Assignment Card */}
                                  <TouchableOpacity
                                    style={styles.itemPillRow}
                                    onPress={() => setSelectedAssignmentForDetail(assign)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.itemTitleText}>{cleanTitle}</Text>
                                    {(() => {
                                      let resolvedDate = assign.dueDate ? parseSafeDate(assign.dueDate) : null;
                                      if (!resolvedDate && assign.noteText) {
                                        const dm = assign.noteText.match(/deadline[:\s]+([A-Za-z]+ \d{1,2}(?:, \d{4})?)/i);
                                        if (dm) resolvedDate = parseSafeDate(dm[1]);
                                      }
                                      if (!resolvedDate) return null;
                                      return (
                                        <View style={styles.assignmentDateRow}>
                                          <CalendarIcon size={12} color="#596B85" />
                                          <Text style={styles.itemDueText}>
                                            Due{' '}
                                            {resolvedDate.toLocaleDateString('en-US', {
                                              weekday: 'long',
                                              month: 'short',
                                              day: 'numeric'
                                            })}
                                          </Text>
                                        </View>
                                      );
                                    })()}
                                  </TouchableOpacity>
                                </View>
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
                          {courseReadings.length === 0 && sortedWeeks.length === 0 ? (
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
                                const cleanTheme = weekObj?.theme ? cleanAcademicWeekTheme(weekObj.theme) : '';
                                const weekAssignments = (courseAssignments || []).filter(a => a.weekNumber === wNum);
                                return (
                                  <View key={`week-${wNum}`} style={styles.weekSectionBox}>
                                    {/* Week Section Header */}
                                    <View style={styles.weekSectionHeader}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                        <View style={styles.weekTagPill}>
                                          <Text style={styles.weekTagText}>Week {wNum}</Text>
                                        </View>
                                      </View>
                                      {weekObj?.dateRangeStr && isRealDateOrRangeString(weekObj.dateRangeStr) ? (
                                        <Text style={styles.itemDueText}>{cleanDateRangeDisplay(weekObj.dateRangeStr)}</Text>
                                      ) : null}
                                    </View>

                                    {/* Week Topic / Focus Theme */}
                                    {cleanTheme && !/^Week\s*\d+$/i.test(cleanTheme) ? (
                                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1C1E', marginTop: 4, marginBottom: 6, lineHeight: 18 }}>
                                        {cleanTheme}
                                      </Text>
                                    ) : null}

                                    {/* Scheduled Assignments in this week */}
                                    {weekAssignments.map(a => (
                                      <View key={a.id} style={{ marginBottom: 6, padding: 8, backgroundColor: '#F2F2F7', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF9500', textTransform: 'uppercase', letterSpacing: 0.5 }}>ASSIGNMENT</Text>
                                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#1C1C1E' }} numberOfLines={2}>{a.title}</Text>
                                        </View>
                                        {a.dueDate ? (
                                          <Text style={{ fontSize: 11, color: '#8E8E93' }}>
                                            Due {new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </Text>
                                        ) : null}
                                      </View>
                                    ))}

                                    {/* Readings */}
                                    {weekReadings.map(r => renderSyllabusReadingRow(r, course.courseName, weekObj?.theme, weekObj?.dateRangeStr))}

                                    {/* Empty state for weeks with no readings and no assignments */}
                                    {weekReadings.length === 0 && weekAssignments.length === 0 ? (
                                      <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F2F2F7', borderRadius: 8, marginTop: 4 }}>
                                        <Text style={{ fontSize: 12, color: '#8E8E93', fontStyle: 'italic' }}>
                                          {cleanTheme ? `${cleanTheme} · No readings assigned` : 'No readings or assignments scheduled'}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}

                              {/* Non-week readings (when week toggle is turned off or unassigned) */}
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
                            </>
                          )}

                          {/* Add Reading Button */}
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
            {/* MARK: - In-Page Upload Status Pill in Document Section */}
            {isUploading && (
              <View style={styles.uploadStatusBanner}>
                <View style={styles.uploadStatusHeaderRow}>
                  {uploadStatusText.toLowerCase().includes('success') ? (
                    <CheckmarkIcon size={16} color="#FFFFFF" strokeWidth={2.6} />
                  ) : (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  )}
                  <Text style={styles.uploadStatusTitle} numberOfLines={1}>
                    {cleanUploadStatusMessage(uploadStatusText)}
                  </Text>
                </View>
                <Text style={styles.uploadStatusEducational}>
                  {uploadStatusText.toLowerCase().includes('success')
                    ? 'Your course document and schedule are ready.'
                    : 'Please stay patient while we carefully organize all your course readings and assignments accurately. You can freely browse other sections or exit the app. Processing will continue in the background.'}
                </Text>
              </View>
            )}

            {vaultDocs.length === 0 && !isUploading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Documents Found</Text>
                <Text style={styles.emptyDesc}>
                  Documents from uploaded course syllabi will appear here.
                </Text>
                <TouchableOpacity
                  style={styles.addCourseButton}
                  onPress={() => setShowUploadModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addCourseButtonText}>Upload Document</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {vaultDocs.map(doc => {
                  const courseDocs = vaultDocs.filter(d => d.courseId === doc.courseId);
                  const docReadings = readings.filter(r => !r.isDeleted && isItemForDocument(r, doc, courseDocs));
                  const docAssignments = assignments.filter(a => !a.isDeleted && isItemForDocument(a, doc, courseDocs));

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
                            {cleanDocumentTitle(doc.title)}
                          </Text>
                          <Text style={styles.docSubtitle} numberOfLines={1}>
                            {doc.courseCode || 'Course Syllabus'}
                          </Text>
                          <Text style={styles.docStatsSubtitle} numberOfLines={1}>
                            {`${docReadings.length} Readings • ${docAssignments.length} Assignments`}
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
                })}
              </>
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
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 6,
    gap: 6,
    shadowColor: CoursePalTheme.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  uploadStatusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  uploadStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1
  },
  uploadStatusEducational: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 17
  },
  courseAccuracyNoticeBanner: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: '100%',
    marginBottom: 10,
    gap: 6,
    shadowColor: CoursePalTheme.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3
  },
  accuracyNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  accuracyNoticeBody: {
    fontSize: 12.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.94)',
    lineHeight: 17.5
  },
  accuracyAcceptActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 4
  },
  acceptAccuracyButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    paddingVertical: 6.5,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  acceptAccuracyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
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
  courseHeaderPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  courseStatsPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  courseStatsPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  officeHoursHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexShrink: 1
  },
  officeHoursHeaderPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    flexShrink: 1
  },
  officeHoursDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  officeHoursPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexShrink: 1,
    alignSelf: 'flex-start'
  },
  officeHoursPillLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  officeHoursPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#007AFF',
    flexShrink: 1,
    lineHeight: 18
  },
  textbooksContainer: {
    gap: 8
  },
  textbookItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 12,
    gap: 4
  },
  textbookTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 19
  },
  textbookAuthorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  textbookEditionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B'
  },
  itemsListContainer: {
    gap: 8
  },
  assignmentSectionBox: {
    gap: 6,
    marginTop: 4,
    marginBottom: 4
  },
  assignmentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2
  },
  assignmentThemeHeaderRow: {
    paddingHorizontal: 2,
    marginTop: 1,
    marginBottom: 2
  },
  assignmentThemeHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18
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
    backgroundColor: '#738094',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  assignmentSyllabusWeightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  assignmentNumPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  assignmentNumPillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  assignmentPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  assignmentSyllabusPointsPill: {
    backgroundColor: '#738094',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  assignmentSyllabusPointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  gradingScaleSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8
  },
  gradingScaleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  gradingScaleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8
  },
  gradingScaleColHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  gradingScaleDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 8
  },
  gradingScaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8
  },
  gradingScaleRowAlt: {
    backgroundColor: '#F8FAFC'
  },
  gradingScaleCell: {
    fontSize: 13,
    color: '#1E293B'
  },
  standardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  standardBadgeText: {
    fontSize: 11.5,
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

  itemTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19
  },
  itemAuthorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 18
  },
  itemSuggestedDateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 18,
    marginTop: 2
  },
  itemDueText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 18
  },
  assignmentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
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
  },
  uncertainItemHighlight: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFFBF5'
  },
  reviewNeededBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  reviewNeededBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C2410C'
  }
});
