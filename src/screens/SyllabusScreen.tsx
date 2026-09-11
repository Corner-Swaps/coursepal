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
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  parseSafeDate
} from '../utils/readingDisplayHelper';
import { GradeWeightTrackerCard } from '../components/GradeWeightTrackerCard';
import { CalendarExportService } from '../services/CalendarExportService';

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
    vaultDocs,
    assignments,
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
      r => !r.isDeleted && (r.courseCode || '').toLowerCase() === (course.courseCode || course.courseName).toLowerCase()
    ).length;
    const assignmentCount = assignments.filter(
      a => !a.isDeleted && (a.courseId === course.id || (a.courseCode || '').toLowerCase() === (course.courseCode || course.courseName).toLowerCase())
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
        {/* MARK: - Page Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeftCol}>
            <Text style={styles.pageTitle}>Syllabus</Text>
            <Text style={styles.pageSubtitle}>
              {vaultDocs.length} document{vaultDocs.length === 1 ? '' : 's'} stored in syllabus
            </Text>
          </View>
        </View>

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

        {/* MARK: - Uploading Status Pill */}
        {isUploading && (
          <View style={styles.uploadStatusBanner}>
            <View style={styles.uploadStatusTop}>
              <ActivityIndicator size="small" color={CoursePalTheme.accentBlue} />
              <Text style={styles.uploadStatusTitle} numberOfLines={1}>
                {uploadStatusText || 'Analyzing syllabus document...'}
              </Text>
            </View>
            <Text style={styles.uploadStatusEducational}>
              Deep analysis takes 1–2 minutes to extract all readings and assignments accurately. You can freely browse other sections or exit the app — processing will continue in the background.
            </Text>
          </View>
        )}

        {/* MARK: - Main Content Area */}
        {selectedCategory === 'syllabi' ? (
          /* Courses List */
          <View style={styles.listContainer}>
            {activeCourses.length === 0 ? (
              <View style={styles.emptyCenterContainer}>
                <Text style={styles.emptyCenterTitle}>No Courses</Text>
                <Text style={styles.emptyCenterDesc}>
                  There are no courses uploaded yet.
                </Text>
              </View>
            ) : (
              activeCourses.map(course => {
                const isExpanded = expandedCourseIds.has(course.id);
                const courseCodeKey = (course.courseCode || course.courseName).toLowerCase();

                const courseReadings = readings.filter(
                  r => !r.isDeleted && (r.courseCode || '').toLowerCase() === courseCodeKey
                );

                const courseAssignments = assignments
                  .filter(
                    a =>
                      !a.isDeleted &&
                      (a.courseId === course.id || (a.courseCode || '').toLowerCase() === courseCodeKey)
                  )
                  .sort((a, b) => {
                    const d1 = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                    const d2 = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                    return d1 - d2;
                  });

                // Group readings by week
                const readingsByWeek = new Map<number, Reading[]>();
                for (const r of courseReadings) {
                  const wNum = r.weekId ? parseInt(r.weekId.replace(/\D/g, '') || '1', 10) : 1;
                  const list = readingsByWeek.get(wNum) || [];
                  list.push(r);
                  readingsByWeek.set(wNum, list);
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
                          <TrashIcon size={14} color="#D94033" />
                        </TouchableOpacity>

                        {/* Expand / Collapse Chevron */}
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => toggleCourseExpand(course.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                        >
                          {isExpanded ? (
                            <ChevronUpIcon size={12} color="#596B85" />
                          ) : (
                            <ChevronDownIcon size={12} color="#596B85" />
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
                        </View>

                        {/* Grade Weight Tracker & Target Calculator */}
                        <GradeWeightTrackerCard course={course} assignments={assignments} />

                        {/* Assignments Section */}
                        <View style={styles.sectionContainer}>
                          <Text style={styles.sectionTitle}>Assignments</Text>
                          <View style={styles.itemsListContainer}>
                            {courseAssignments.map(assign => (
                              <TouchableOpacity
                                key={assign.id}
                                style={styles.itemPillRow}
                                onPress={() => setSelectedAssignmentForDetail(assign)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.tagsRow}>
                                  {assign.weekNumber > 0 && (
                                    <View style={styles.weekTagPill}>
                                      <Text style={styles.weekTagText}>
                                        Week {assign.weekNumber}
                                      </Text>
                                    </View>
                                  )}
                                  {assign.moduleMention && (
                                    <View style={styles.moduleTagPill}>
                                      <Text style={styles.moduleTagText}>
                                        {assign.moduleMention}
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                <Text style={styles.itemTitleText}>{assign.title}</Text>

                                {assign.dueDate && (() => {
                                  const d = parseSafeDate(assign.dueDate);
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
                            ))}

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
                          {sortedWeeks.length === 0 ? (
                            <View style={styles.emptyItemsBox}>
                              <Text style={styles.emptyItemsText}>No readings in this course yet.</Text>
                            </View>
                          ) : (
                            sortedWeeks.map(wNum => {
                              const weekReadings = readingsByWeek.get(wNum) || [];
                              return (
                                <View key={`week-${wNum}`} style={styles.weekSectionBox}>
                                  {/* Week Section Header */}
                                  <View style={styles.weekSectionHeader}>
                                    <View style={styles.weekTagPill}>
                                      <Text style={styles.weekTagText}>Week {wNum}</Text>
                                    </View>
                                  </View>

                                  {/* Readings in Week */}
                                  {weekReadings.map(reading => (
                                    <TouchableOpacity
                                      key={reading.id}
                                      style={styles.itemPillRow}
                                      onPress={() => setEditingReading(reading)}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.itemTitleText}>
                                        {formatDisplayTitleWithChapter(reading)}
                                      </Text>
                                      {formatAuthorAndPagesSubtitle(reading).length > 0 && (
                                        <Text style={styles.itemAuthorText}>
                                          {formatAuthorAndPagesSubtitle(reading)}
                                        </Text>
                                      )}
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
                                  ))}
                                </View>
                              );
                            })
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
              <View style={styles.emptyCenterContainer}>
                <Text style={styles.emptyCenterTitle}>No Documents</Text>
                <Text style={styles.emptyCenterDesc}>
                  There are no syllabus documents uploaded yet.
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.uploadDocBannerRow}
                  onPress={() => handleOpenUpload()}
                  activeOpacity={0.8}
                >
                  <View style={styles.uploadDocBannerIcon}>
                    <DocBadgePlusIcon size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.uploadDocBannerText}>Upload Another Syllabus Document</Text>
                </TouchableOpacity>

                {vaultDocs.map(doc => {
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
                          {doc.title}
                        </Text>
                        <Text style={styles.docSubtitle} numberOfLines={1}>
                          {doc.courseCode || 'General'} • {doc.fileSize} • {doc.fileType}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Eye Preview Button */}
                    <TouchableOpacity
                      style={styles.eyePreviewButton}
                      onPress={() => setPreviewDoc(doc)}
                      activeOpacity={0.7}
                    >
                      <EyeFillIcon size={15} color={CoursePalTheme.accentBlue} />
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.deleteDocButton}
                      onPress={() => confirmDeleteDoc(doc)}
                      activeOpacity={0.7}
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
    marginHorizontal: 18,
    marginTop: 14,
    gap: 8
  },
  uploadStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  uploadStatusTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  uploadStatusEducational: {
    fontSize: 11.5,
    fontWeight: '400',
    color: '#596B85',
    lineHeight: 16
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
    letterSpacing: -0.2
  },
  courseSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 1
  },
  courseStatsSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A99AD',
    marginTop: 2
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionIconButton: {
    width: 30,
    height: 30,
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
    fontSize: 13.5,
    fontWeight: '700',
    color: '#596B85'
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
    fontSize: 14,
    fontWeight: '700',
    color: '#141F38'
  },
  itemAuthorText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#596B85'
  },
  itemDueText: {
    fontSize: 12,
    color: '#596B85'
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
    fontSize: 13.5,
    fontWeight: '700',
    color: '#141F38'
  },
  docSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#596B85',
    marginTop: 2
  },
  eyePreviewButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(36, 112, 245, 0.10)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteDocButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
  }
});
