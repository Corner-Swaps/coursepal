import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { useCoursePal } from '../context/CoursePalContext';
import { CoursePalTheme } from '../constants/theme';
import { AssignmentsMonthCalendarCard } from '../components/AssignmentsMonthCalendarCard';
import { SwipeableRow } from '../components/SwipeableRow';
import {
  FilterIcon,
  CheckmarkCircleFillIcon,
  TrashIcon,
  CalendarIcon,
  ArrowPathIcon
} from '../components/SvgIcons';
import { Assignment } from '../types/models';
import { AssignmentDetailModal, EditAssignmentModal } from '../components/modals';
import {
  formatWeekHeaderDate,
  formatAssignmentDueDate,
  parseSafeDate,
  getSanitizedCoursePill
} from '../utils/readingDisplayHelper';

interface AssignmentsScreenProps {
  onOpenFilterModal: () => void;
}

export const AssignmentsScreen: React.FC<AssignmentsScreenProps> = ({ onOpenFilterModal }) => {
  const {
    courses,
    assignments,
    toggleAssignment,
    updateAssignment,
    deleteAssignment,
    restoreAssignment,
    emptyAssignmentsTrash,
    permanentlyDeleteAssignment,
    selectedCourseFilter,
    setSelectedCourseFilter
  } = useCoursePal();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDateFilterActive, setIsDateFilterActive] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<'assignments' | 'completed' | 'trash'>('assignments');
  const [selectedAssignmentForDetail, setSelectedAssignmentForDetail] = useState<Assignment | null>(null);
  const [assignmentForEdit, setAssignmentForEdit] = useState<Assignment | null>(null);

  // Filter active assignments
  const activeAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (sortMode === 'trash') {
        return a.isDeleted;
      }
      if (a.isDeleted) return false;

      // Filter by Course
      if (selectedCourseFilter) {
        const cCode = (selectedCourseFilter.courseCode || selectedCourseFilter.courseName).toLowerCase();
        const matchesCourse =
          a.courseId === selectedCourseFilter.id ||
          (a.courseCode || '').toLowerCase() === cCode;
        if (!matchesCourse) {
          return false;
        }
      }

      // Filter by Date
      if (isDateFilterActive && a.dueDate) {
        const d = parseSafeDate(a.dueDate);
        if (!d) return false;
        const isSame =
          d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
        if (!isSame) return false;
      }

      // Filter by Completed mode
      if (sortMode === 'completed') {
        return a.isCompleted;
      }

      return true;
    });
  }, [assignments, sortMode, selectedCourseFilter, isDateFilterActive, selectedDate]);

  const completedCount = useMemo(() => {
    return assignments.filter(a => !a.isDeleted && a.isCompleted).length;
  }, [assignments]);

  const deletedCount = useMemo(() => {
    return assignments.filter(a => a.isDeleted).length;
  }, [assignments]);

  // Map of date string -> array of course hex colors for deadlines calendar dots
  const itemDatesWithColors = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.isDeleted || !a.dueDate) continue;
      const d = parseSafeDate(a.dueDate);
      if (!d) continue;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;

      const matchedCourse = courses.find(
        c => c.id === a.courseId || (c.courseCode || c.courseName).toLowerCase() === (a.courseCode || '').toLowerCase()
      );
      const color = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;

      const existing = map.get(key) || [];
      if (!existing.includes(color)) {
        existing.push(color);
      }
      map.set(key, existing);
    }
    return map;
  }, [assignments, courses]);

  // Group assignments: partition into unassigned (week toggle off) and week-grouped (week toggle on)
  const { unassignedAssignments, groupedAssignments } = useMemo(() => {
    const unassigned: Assignment[] = [];
    const map = new Map<number, Assignment[]>();
    for (const a of activeAssignments) {
      const isWeekOn = typeof a.weekNumber === 'number' && a.weekNumber > 0;
      if (!isWeekOn) {
        unassigned.push(a);
      } else {
        const list = map.get(a.weekNumber) || [];
        list.push(a);
        map.set(a.weekNumber, list);
      }
    }
    return {
      unassignedAssignments: unassigned,
      groupedAssignments: Array.from(map.entries()).sort(([w1], [w2]) => w1 - w2)
    };
  }, [activeAssignments]);

  // Grade weight metrics
  const renderAssignmentCard = (assignment: Assignment) => {
    const matchedCourse = courses.find(
      c =>
        c.id === assignment.courseId ||
        (c.courseCode || c.courseName).toLowerCase() ===
        (assignment.courseCode || '').toLowerCase()
    );
    const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;
    const pillTitle = getSanitizedCoursePill(assignment.courseCode, matchedCourse);

    return (
      <SwipeableRow
        key={assignment.id}
        onDelete={() => deleteAssignment(assignment.id)}
        enabled={sortMode !== 'trash'}
      >
        <View style={styles.assignmentCard}>
          {/* Left Vertical Course Color Line Indicator */}
          <View style={[styles.leftAccentStripe, { backgroundColor: courseColor }]} />

          {/* Middle Content Area */}
          <TouchableOpacity
            style={styles.cardMainContent}
            onPress={() => setSelectedAssignmentForDetail(assignment)}
            activeOpacity={0.7}
          >
            {/* Top Line: Course Title Pill with white letters & Optional Presentation Badge */}
            <View style={styles.pillRow}>
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{pillTitle.toUpperCase()}</Text>
              </View>
              {assignment.noteText && assignment.noteText.startsWith('Presentations:') && (
                <View style={styles.presentationBadge}>
                  <Text style={styles.presentationBadgeText}>{assignment.noteText}</Text>
                </View>
              )}
            </View>

            {/* Card Title */}
            <Text
              style={[
                styles.assignmentTitle,
                assignment.isCompleted && styles.assignmentTitleCompleted
              ]}
              numberOfLines={3}
            >
              {assignment.title}
            </Text>

            {/* Date Display & Points / Weight Badges */}
            <View style={styles.assignmentDateRow}>
              <Text style={styles.assignmentDateText}>
                {formatAssignmentDueDate(assignment.dueDate) || (assignment.weekNumber > 0 ? `Week ${assignment.weekNumber}` : 'No due date')}
              </Text>
              {(() => {
                const weight = assignment.weightPercentage;
                const points = assignment.pointsPossible;
                if (weight && points) {
                  const numWeight = weight.replace(/[^\d]/g, '');
                  const numPts = points.replace(/[^\d]/g, '');
                  if (numWeight === numPts || numPts === '100') {
                    return <Text style={styles.weightText}>• {weight}</Text>;
                  }
                  return <Text style={styles.weightText}>• {points} ({weight})</Text>;
                } else if (weight) {
                  return <Text style={styles.weightText}>• {weight}</Text>;
                } else if (points) {
                  return <Text style={styles.weightText}>• {points}</Text>;
                }
                return null;
              })()}
            </View>
          </TouchableOpacity>

          {/* Right Action: Completion Checkmark OR Restore & Permanent Delete */}
          {sortMode === 'trash' ? (
            <View style={styles.trashActionsRow}>
              <TouchableOpacity
                style={styles.restorePillButton}
                onPress={() => restoreAssignment(assignment.id)}
                activeOpacity={0.7}
              >
                <ArrowPathIcon size={13} color={CoursePalTheme.accentBlue} />
                <Text style={styles.restorePillText}>Restore</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.permanentTrashBtn}
                onPress={() => {
                  Alert.alert(
                    'Delete Assignment Permanently?',
                    `Are you sure you want to permanently delete '${assignment.title}'? This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => permanentlyDeleteAssignment(assignment.id)
                      }
                    ]
                  );
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <TrashIcon size={14} color="#D94033" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardRightActions}>
              <TouchableOpacity
                style={styles.touchCircleContainer}
                onPress={() => toggleAssignment(assignment.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkboxCircle,
                    assignment.isCompleted && {
                      backgroundColor: CoursePalTheme.accentBlue,
                      borderColor: CoursePalTheme.accentBlue
                    }
                  ]}
                >
                  {assignment.isCompleted && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.trashTouchContainer}
                onPress={() => deleteAssignment(assignment.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityLabel={`Delete ${assignment.title}`}
              >
                <TrashIcon size={22} color="#D94033" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SwipeableRow>
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
        testID="assignments-screen-scroll"
      >
      {/* MARK: - Page Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftCol}>
          <Text style={styles.pageTitle}>Assignments</Text>
          <Text style={styles.pageSubtitle}>
            {activeAssignments.length} assignment{activeAssignments.length === 1 ? '' : 's'} this term
          </Text>
        </View>

        <View style={styles.topRightPills}>
          {/* Filter Pill */}
          <TouchableOpacity
            style={[
              styles.actionPillFilter,
              selectedCourseFilter !== null && styles.actionPillActive
            ]}
            onPress={onOpenFilterModal}
            activeOpacity={0.7}
            testID="assignments-filter-button"
          >
            <FilterIcon
              size={18}
              color={selectedCourseFilter ? CoursePalTheme.accentBlue : '#596B85'}
            />
          </TouchableOpacity>

          {/* Completed Pill */}
          <TouchableOpacity
            style={[
              styles.actionPill,
              sortMode === 'completed' && styles.actionPillCompletedActive
            ]}
            onPress={() => setSortMode(sortMode === 'completed' ? 'assignments' : 'completed')}
            activeOpacity={0.7}
            testID="assignments-completed-pill"
          >
            <CheckmarkCircleFillIcon size={18} color="#2EB866" />
            <Text style={styles.completedCountText}>{completedCount}</Text>
          </TouchableOpacity>

          {/* Trash Pill */}
          <TouchableOpacity
            style={[
              styles.actionPill,
              sortMode === 'trash' && styles.actionPillTrashActive
            ]}
            onPress={() => setSortMode(sortMode === 'trash' ? 'assignments' : 'trash')}
            activeOpacity={0.7}
            testID="assignments-trash-pill"
          >
            <TrashIcon size={17} color="#D94033" />
            <Text style={styles.trashCountText}>{deletedCount}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MARK: - Assignments Month Calendar Card */}
      <AssignmentsMonthCalendarCard
        selectedDate={selectedDate}
        onSelectDate={d => {
          setSelectedDate(d);
          setIsDateFilterActive(true);
        }}
        isDateFilterActive={isDateFilterActive}
        onToggleDateFilter={() => setIsDateFilterActive(!isDateFilterActive)}
        itemDatesWithColors={itemDatesWithColors}
      />

      {/* MARK: - Per-Course Assignment Progress Bars */}
      {courses.length > 0 && (
        <View style={styles.progressCardContainer}>
          {courses.map(course => {
            const courseAssigns = assignments.filter(
              a =>
                !a.isDeleted &&
                (a.courseId === course.id ||
                  (a.courseCode || '').toLowerCase() === (course.courseCode || course.courseName).toLowerCase())
            );
            const total = courseAssigns.length;
            const completed = courseAssigns.filter(a => a.isCompleted).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <View key={course.id} style={styles.courseProgressRow}>
                <View style={styles.courseProgressHeader}>
                  <View style={[styles.courseColorDot, { backgroundColor: course.hexColor }]} />
                  <Text style={styles.courseCodeText} numberOfLines={1}>
                    {course.courseCode || course.courseName}
                  </Text>
                </View>

                <View style={styles.progressCapsuleTrackRow}>
                  <View style={styles.capsuleTrack}>
                    <View
                      style={[
                        styles.capsuleFill,
                        {
                          backgroundColor: course.hexColor,
                          width: `${Math.max(4, pct)}%`
                        }
                      ]}
                    />
                  </View>

                  <View style={[styles.percentageBadge, { backgroundColor: course.hexColor }]}>
                    <Text style={styles.percentageBadgeText}>
                      {completed} of {total} ({pct}%)
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}


      {/* Active Course Filter Banner */}
      {selectedCourseFilter && (
        <View
          style={[
            styles.filterBanner,
            { backgroundColor: `${selectedCourseFilter.hexColor}18` }
          ]}
        >
          <View
            style={[styles.courseColorDot, { backgroundColor: selectedCourseFilter.hexColor }]}
          />
          <Text style={styles.filterBannerLabel}>Showing:</Text>
          <Text
            style={[styles.filterBannerCourseName, { color: selectedCourseFilter.hexColor }]}
            numberOfLines={1}
          >
            {selectedCourseFilter.courseName}
          </Text>

          <TouchableOpacity
            style={styles.clearFilterButton}
            onPress={() => setSelectedCourseFilter(null)}
          >
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trash Mode Banner */}
      {sortMode === 'trash' && (
        <View style={styles.trashModeBanner}>
          <View style={styles.trashModeLeft}>
            <TrashIcon size={16} color="#D94033" />
            <Text style={styles.trashModeTitle}>
              Trash Bin ({deletedCount} item{deletedCount === 1 ? '' : 's'})
            </Text>
          </View>
          {deletedCount > 0 && (
            <TouchableOpacity
              style={styles.emptyTrashBtn}
              onPress={() => {
                Alert.alert(
                  'Empty Trash?',
                  'This will permanently delete all assignments in the trash. This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Empty Trash',
                      style: 'destructive',
                      onPress: () => emptyAssignmentsTrash()
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyTrashBtnText}>Empty Trash</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* MARK: - Deliverables List */}
      {activeAssignments.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>
            {isDateFilterActive
              ? 'No Assignments on This Date'
              : 'No Assignments Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isDateFilterActive
              ? 'There are no deliverables due on this selected date.'
              : 'Add an assignment or upload a syllabus to automatically generate tasks.'}
          </Text>
          {isDateFilterActive && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => setIsDateFilterActive(false)}
            >
              <Text style={styles.showAllButtonText}>Show All Assignments</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.assignmentsListContainer}>
          {/* Non-week assignments (when week toggle is turned off) */}
          {unassignedAssignments.length > 0 && (
            <View style={styles.unassignedGroupSection}>
              {unassignedAssignments.map(renderAssignmentCard)}
            </View>
          )}

          {/* Week-grouped assignments (when week toggle is turned on) */}
          {groupedAssignments.map(([weekNum, weekList]) => (
            <View key={`week-${weekNum}`} style={styles.weekGroupSection}>
              {/* Week Header Pill */}
              <View style={styles.weekHeaderRow}>
                <View style={styles.weekPill}>
                  <Text style={styles.weekPillText}>Week {weekNum}</Text>
                </View>
                {weekList[0]?.dueDate && (
                  <View style={styles.calendarDateRow}>
                    <CalendarIcon size={11} color="#718096" />
                    <Text style={styles.dateRangeText}>
                      {formatWeekHeaderDate(new Date(weekList[0].dueDate))}
                    </Text>
                  </View>
                )}
              </View>

              {/* Assignment Cards */}
              {weekList.map(renderAssignmentCard)}
            </View>
          ))}
        </View>
      )}
    </ScrollView>

    {/* Assignment Detail Modal */}
    <AssignmentDetailModal
      visible={selectedAssignmentForDetail != null}
      assignment={selectedAssignmentForDetail}
      courses={courses}
      onClose={() => setSelectedAssignmentForDetail(null)}
      onEdit={assign => {
        setAssignmentForEdit(assign);
      }}
      onToggleComplete={id => toggleAssignment(id)}
      onUpdateAssignment={updated => {
        updateAssignment(updated);
        setSelectedAssignmentForDetail(updated);
      }}
      onDeleteAssignment={id => deleteAssignment(id)}
    />

    {/* Edit Assignment Modal */}
    <EditAssignmentModal
      visible={assignmentForEdit != null}
      assignment={assignmentForEdit}
      courses={courses}
      onClose={() => setAssignmentForEdit(null)}
      onSave={updated => {
        updateAssignment(updated);
        if (selectedAssignmentForDetail?.id === updated.id) {
          setSelectedAssignmentForDetail(updated);
        }
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
  topRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  actionPillFilter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 34,
    minWidth: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 5
  },
  actionPillActive: {
    backgroundColor: 'rgba(36, 112, 245, 0.15)'
  },
  actionPillCompletedActive: {
    backgroundColor: 'rgba(46, 184, 102, 0.15)'
  },
  actionPillTrashActive: {
    backgroundColor: 'rgba(217, 64, 51, 0.15)'
  },
  completedCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2EB866'
  },
  trashCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D94033'
  },
  progressCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 18,
    marginTop: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12
  },
  courseProgressRow: {
    gap: 6
  },
  courseProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  courseColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  courseCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141F38'
  },
  progressCapsuleTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  capsuleTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E3E8F0',
    overflow: 'hidden'
  },
  capsuleFill: {
    height: 6,
    borderRadius: 3
  },
  percentageBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  percentageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12
  },
  filterBannerLabel: {
    fontSize: 13,
    color: '#596B85',
    marginRight: 4
  },
  filterBannerCourseName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700'
  },
  clearFilterButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#596B85'
  },
  trashModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(217, 64, 51, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 64, 51, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 18,
    marginTop: 12
  },
  trashModeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  trashModeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#D94033'
  },
  emptyTrashBtn: {
    backgroundColor: '#D94033',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  emptyTrashBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  assignmentsListContainer: {
    marginHorizontal: 18,
    marginTop: 16,
    gap: 18
  },
  weekGroupSection: {
    gap: 10
  },
  unassignedGroupSection: {
    gap: 10
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  weekPill: {
    backgroundColor: '#738094',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  weekPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  calendarDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dateRangeText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#596B85'
  },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10
  },
  leftAccentStripe: {
    width: 4,
    height: 36,
    borderRadius: 3
  },
  cardMainContent: {
    flex: 1,
    gap: 3
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  coursePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5
  },
  coursePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  presentationBadge: {
    backgroundColor: '#ECEFF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  presentationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563'
  },
  assignmentTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19,
    letterSpacing: -0.2
  },
  assignmentTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E9BAE'
  },
  assignmentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1
  },
  assignmentDateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  weightText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  touchCircleContainer: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: '#BFCCD9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  trashTouchContainer: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trashActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  permanentTrashBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 64, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  restorePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  restorePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 32,
    marginHorizontal: 18,
    marginTop: 18,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    textAlign: 'center',
    maxWidth: 240
  },
  showAllButton: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14
  },
  showAllButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
