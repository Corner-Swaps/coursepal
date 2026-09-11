import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { useCoursePal } from '../context/CoursePalContext';
import { CoursePalTheme } from '../constants/theme';
import { DeadlinesCalendarCard } from '../components/DeadlinesCalendarCard';
import {
  FilterIcon,
  CheckmarkCircleFillIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkCircleFillIcon,
  CalendarIcon
} from '../components/SvgIcons';
import { Assignment } from '../types/models';
import { AssignmentDetailModal, EditAssignmentModal } from '../components/modals';
import {
  formatWeekHeaderDate,
  formatAssignmentDueDate,
  parseSafeDate
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
    emptyTrash,
    selectedCourseFilter,
    setSelectedCourseFilter
  } = useCoursePal();

  const [searchQuery, setSearchQuery] = useState<string>('');
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
        if ((a.courseCode || '').toLowerCase() !== cCode) {
          return false;
        }
      }

      // Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchCourse = (a.courseCode || '').toLowerCase().includes(q);
        const matchNotes = (a.noteText || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCourse && !matchNotes) {
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
  }, [assignments, sortMode, selectedCourseFilter, searchQuery, isDateFilterActive, selectedDate]);

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
        c => (c.courseCode || c.courseName).toLowerCase() === (a.courseCode || '').toLowerCase()
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

  // Group assignments by week number
  const groupedAssignments = useMemo(() => {
    const map = new Map<number, Assignment[]>();
    for (const a of activeAssignments) {
      const w = a.weekNumber || 1;
      const list = map.get(w) || [];
      list.push(a);
      map.set(w, list);
    }
    return Array.from(map.entries()).sort(([w1], [w2]) => w1 - w2);
  }, [activeAssignments]);

  // Grade weight metrics
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

      {/* MARK: - Deadlines Calendar Card */}
      <DeadlinesCalendarCard
        selectedDate={selectedDate}
        onSelectDate={d => {
          setSelectedDate(d);
          setIsDateFilterActive(true);
        }}
        isDateFilterActive={isDateFilterActive}
        onToggleDateFilter={() => setIsDateFilterActive(!isDateFilterActive)}
        itemDatesWithColors={itemDatesWithColors}
      />

      {/* MARK: - Search Bar */}
      <View style={styles.searchBarContainer}>
        <MagnifyingGlassIcon size={15} color="#8E9BAE" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assignments…"
          placeholderTextColor="#8E9BAE"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
            <XMarkCircleFillIcon size={16} color="#B3BCC9" />
          </TouchableOpacity>
        )}
      </View>

      {/* MARK: - Per-Course Assignment Progress Bars */}
      {courses.length > 0 && (
        <View style={styles.progressCardContainer}>
          {courses.map(course => {
            const courseAssigns = assignments.filter(
              a =>
                !a.isDeleted &&
                (a.courseCode || '').toLowerCase() === (course.courseCode || course.courseName).toLowerCase()
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

      {/* MARK: - Deliverables List */}
      {activeAssignments.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>
            {isDateFilterActive
              ? 'No Assignments on This Date'
              : searchQuery
              ? 'No Results Found'
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
              {weekList.map(assignment => {
                const matchedCourse = courses.find(
                  c =>
                    (c.courseCode || c.courseName).toLowerCase() ===
                    (assignment.courseCode || '').toLowerCase()
                );
                const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;
                const pillTitle = matchedCourse?.courseName || assignment.courseCode || 'Assignment';

                return (
                  <View key={assignment.id} style={styles.assignmentCard}>
                    {/* Left Vertical Course Color Line Indicator */}
                    <View style={[styles.leftAccentStripe, { backgroundColor: courseColor }]} />

                    {/* Middle Content Area */}
                    <TouchableOpacity
                      style={styles.cardMainContent}
                      onPress={() => setSelectedAssignmentForDetail(assignment)}
                      activeOpacity={0.7}
                    >
                      {/* Top Line: Course Title Pill with white letters */}
                      <View style={styles.pillRow}>
                        <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                          <Text style={styles.coursePillText}>{pillTitle}</Text>
                        </View>
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
                          {formatAssignmentDueDate(assignment.dueDate) || `Week ${assignment.weekNumber || 1}`}
                        </Text>
                        {assignment.pointsPossible && (
                          <Text style={styles.weightText}>• {assignment.pointsPossible}</Text>
                        )}
                        {assignment.weightPercentage && (
                          <Text style={styles.weightText}>• {assignment.weightPercentage}</Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Right-side Action Buttons: Checkmark Ring & Trashcan */}
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
                      >
                        <TrashIcon size={15} color="rgba(217, 64, 51, 0.85)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 18,
    marginTop: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#141F38',
    marginLeft: 8,
    paddingVertical: 2
  },
  clearSearchButton: {
    padding: 2
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
  assignmentsListContainer: {
    marginHorizontal: 18,
    marginTop: 16,
    gap: 18
  },
  weekGroupSection: {
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
  assignmentTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#384761',
    lineHeight: 19
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
    fontWeight: '400',
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
    width: 30,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
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
