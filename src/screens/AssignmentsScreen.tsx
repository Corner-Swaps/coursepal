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
import { PulsingColorDot } from '../components/PulsingColorDot';
import {
  formatAssignmentDueDate,
  parseSafeDate,
  getSanitizedCoursePill,
  isInvalidAssignmentTitle,
  isItemForCourse,
  matchCourseForItem,
  getAssignmentInstructionSummary
} from '../utils/readingDisplayHelper';
import { calculateAcademicWeek } from '../utils/timeFormatters';

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
  const [calendarMonthYear, setCalendarMonthYear] = useState<string>('');
  const [sortMode, setSortMode] = useState<'assignments' | 'completed' | 'trash'>('assignments');
  const [selectedAssignmentForDetail, setSelectedAssignmentForDetail] = useState<Assignment | null>(null);
  const [assignmentForEdit, setAssignmentForEdit] = useState<Assignment | null>(null);

  // Active course resolution: matches selectedCourseFilter if explicitly selected,
  // or null when viewing All Courses (allowing all coursework across active courses to load).
  const activeCourse = selectedCourseFilter;

  const fallbackMonthYear = useMemo(() => {
    if (activeCourse?.weeks && activeCourse.weeks.length > 0) {
      for (const w of activeCourse.weeks) {
        if (w.startDate) {
          const d = parseSafeDate(w.startDate);
          if (d) return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }
    }
    const d = selectedDate;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [activeCourse, selectedDate]);

  // Filter active assignments (strictly filtered by activeCourse when specified)
  const activeAssignments = useMemo(() => {
    if (courses.length === 0) return [];
    return assignments.filter(a => {
      if (sortMode === 'trash') {
        if (!a.isDeleted) return false;
        if (activeCourse && !isItemForCourse(a, activeCourse)) {
          return false;
        }
        return true;
      }
      if (a.isDeleted) return false;
      if (isInvalidAssignmentTitle(a.title)) return false;

      // Filter strictly by Course when a specific course filter is active
      if (activeCourse && !isItemForCourse(a, activeCourse)) {
        return false;
      }

      // Filter by Completed mode
      if (sortMode === 'completed') {
        return a.isCompleted;
      }

      return true;
    });
  }, [assignments, sortMode, activeCourse]);

  // Assignments matching selected calendar date (for highlight section)
  const dateFilteredAssignments = useMemo(() => {
    if (!isDateFilterActive) return [];
    return activeAssignments.filter(a => {
      if (!a.dueDate) return false;
      const d = parseSafeDate(a.dueDate);
      if (!d) return false;
      return (
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate()
      );
    });
  }, [activeAssignments, isDateFilterActive, selectedDate]);

  const scopedAssignments = useMemo(() => {
    if (courses.length === 0) return [];
    return assignments.filter(a => {
      if (a.isDeleted) return false;
      if (isInvalidAssignmentTitle(a.title)) return false;
      if (activeCourse && !isItemForCourse(a, activeCourse)) {
        return false;
      }
      return true;
    });
  }, [assignments, activeCourse, courses.length]);

  const completedCount = useMemo(() => {
    return scopedAssignments.filter(a => a.isCompleted).length;
  }, [scopedAssignments]);

  const deletedCount = useMemo(() => {
    return assignments.filter(a => {
      if (!a.isDeleted) return false;
      if (activeCourse && !isItemForCourse(a, activeCourse)) {
        return false;
      }
      return true;
    }).length;
  }, [assignments, activeCourse]);


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

      const matchedCourse = matchCourseForItem(a, courses);
      const color = matchedCourse?.hexColor || a.docColorHex || CoursePalTheme.accentBlue;

      const existing = map.get(key) || [];
      if (!existing.includes(color)) {
        existing.push(color);
      }
      map.set(key, existing);
    }
    return map;
  }, [assignments, courses]);

  // Earliest academic start date of the courses/assignments in view
  const termStartDate = useMemo(() => {
    if (selectedCourseFilter) {
      if (selectedCourseFilter.weeks && selectedCourseFilter.weeks.length > 0) {
        for (const w of selectedCourseFilter.weeks) {
          if (w.startDate) {
            const d = parseSafeDate(w.startDate);
            if (d) return d;
          }
        }
      }
      const courseAssignments = assignments.filter(
        a => !a.isDeleted && isItemForCourse(a, selectedCourseFilter)
      );
      for (const a of courseAssignments) {
        if (a.dueDate) {
          const d = parseSafeDate(a.dueDate);
          if (d) return d;
        }
      }
    }

    let earliest: Date | null = null;
    for (const c of courses) {
      if (c.weeks) {
        for (const w of c.weeks) {
          if (w.startDate) {
            const d = parseSafeDate(w.startDate);
            if (d && (!earliest || d.getTime() < earliest.getTime())) earliest = d;
          }
        }
      }
    }
    for (const a of assignments) {
      if (a.isDeleted) continue;
      if (a.dueDate) {
        const d = parseSafeDate(a.dueDate);
        if (d && (!earliest || d.getTime() < earliest.getTime())) earliest = d;
      }
    }

    return earliest || null;
  }, [activeCourse, courses, assignments]);

  const availableWeekNumbers = useMemo(() => {
    const set = new Set<number>();
    if (activeCourse && activeCourse.weeks) {
      for (const w of activeCourse.weeks) {
        set.add(w.weekNumber);
      }
    }
    for (const a of assignments) {
      if (a.weekNumber && a.weekNumber > 0) set.add(a.weekNumber);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [activeCourse, courses, assignments]);

  // Determine the current academic week that the student is in today
  const currentAcademicWeek = useMemo(() => {
    return calculateAcademicWeek(new Date(), activeCourse, termStartDate, availableWeekNumbers);
  }, [activeCourse, termStartDate, availableWeekNumbers]);

  // Group assignments: partition into unassigned (week toggle off) and week-grouped (week toggle on)
  const { unassignedAssignments, groupedAssignments } = useMemo(() => {
    const unassigned: Assignment[] = [];
    const map = new Map<number, Assignment[]>();
    for (const a of activeAssignments) {
      const isWeekOn = typeof a.weekNumber === 'number' && a.weekNumber > 0;
      const primaryWeek = isWeekOn
        ? a.weekNumber!
        : (Array.isArray(a.scheduledWeeks) && a.scheduledWeeks.length > 0 && typeof a.scheduledWeeks[0] === 'number' && a.scheduledWeeks[0] > 0
            ? a.scheduledWeeks[0]
            : null);

      if (primaryWeek === null) {
        unassigned.push(a);
      } else {
        const list = map.get(primaryWeek) || [];
        if (!list.some(existing => existing.id === a.id)) {
          list.push(a);
        }
        map.set(primaryWeek, list);
      }
    }
    return {
      unassignedAssignments: unassigned,
      groupedAssignments: Array.from(map.entries()).sort(([w1], [w2]) => w1 - w2)
    };
  }, [activeAssignments]);

  // Grade weight metrics
  const renderAssignmentCard = (assignment: Assignment, weekContext?: number) => {
    const matchedCourse = matchCourseForItem(assignment, courses);
    const courseColor = matchedCourse?.hexColor || assignment.docColorHex || CoursePalTheme.accentBlue;
    const pillTitle = getSanitizedCoursePill(assignment.courseCode, matchedCourse);

    const isPresentation =
      (assignment.noteText && assignment.noteText.toLowerCase().includes('presentation')) ||
      (assignment.title || '').toLowerCase().includes('presentation') ||
      assignment.subTypeRaw === 'presentation' ||
      (assignment as any).subType === 'presentation';

    const isGroupPresentation =
      isPresentation &&
      (/group/i.test(assignment.title || '') ||
        /group/i.test(assignment.noteText || '') ||
        /small group/i.test(assignment.fullInstructions || ''));

    const isContinuous =
      !isPresentation &&
      (/continuous/i.test(assignment.title || '') ||
        /continuous/i.test(assignment.noteText || '') ||
        /participation/i.test(assignment.title || '') ||
        /attendance/i.test(assignment.title || '') ||
        /engagement/i.test(assignment.title || ''));

    return (
      <SwipeableRow
        key={`${assignment.id}${weekContext !== undefined ? `-wk${weekContext}` : ''}`}
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
            {/* Top Line: Course Title Pill */}
            <View style={styles.pillRow}>
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{pillTitle.toUpperCase()}</Text>
              </View>
            </View>

            {/* Card Title */}
            <Text
              style={[
                styles.assignmentTitle,
                assignment.isCompleted && styles.assignmentTitleCompleted
              ]}
              numberOfLines={2}
            >
              {(() => {
                return (assignment.title || '')
                  .replace(/\s*\((?:assignment\s*)?\d+\)\s*$/i, '')
                  .replace(/-\s*(?:Group Presentation|Individual Paper|Instructor Determined Assignment)\b/i, '')
                  .replace(/^(?:assignment\s*)?\d+[\s:\-–—]+/i, '')
                  .trim();
              })()}
            </Text>

            {/* Subtitle / Metadata in Gray Text (mirroring Readings screen) */}
            {(() => {
              const parts: string[] = [];

              // 1. Modality / Deliverable format in gray text
              const titleLower = (assignment.title || '').toLowerCase();
              const noteLower = (assignment.noteText || '').toLowerCase();

              const c = matchCourseForItem(assignment, courses);
              const courseHasWeeks = Boolean(
                c?.weeks && c.weeks.length > 0 && c.weeks.some(w => w.weekNumber && w.weekNumber > 0)
              );

              if (isGroupPresentation || titleLower.includes('group presentation')) {
                parts.push('Group Presentation');
              } else if (isPresentation || titleLower.includes('presentation')) {
                parts.push('Presentation');
              } else if (titleLower.includes('discussion') || noteLower.includes('discussion') || noteLower.includes('peer feedback')) {
                parts.push('Discussion Board Activity');
              } else if (titleLower.includes('video') || noteLower.includes('video') || (assignment.mediaUrl && /youtube|youtu\.be|vimeo/i.test(assignment.mediaUrl))) {
                parts.push('Video & Summary');
              } else if (titleLower.includes('paper') || noteLower.includes('paper') || titleLower.includes('study design')) {
                parts.push('Individual Paper');
              } else if (isContinuous || titleLower.includes('attendance') || titleLower.includes('participation')) {
                parts.push('Continuous Evaluation');
              }

              // 2. Schedule / Due Date
              if ((titleLower.includes('discussion') || noteLower.includes('discussion')) && noteLower.includes('weekly')) {
                parts.push('Weekly Submission');
              } else {
                const targetWk = weekContext !== undefined && weekContext > 0 ? weekContext : assignment.weekNumber;
                let resolvedDate: Date | string | null | undefined = assignment.dueDate;
                if ((!resolvedDate || (weekContext !== undefined && weekContext !== assignment.weekNumber)) && targetWk && targetWk > 0) {
                  const w = c?.weeks?.find(wk => wk.weekNumber === targetWk);
                  if (w?.startDate) resolvedDate = w.startDate;
                  else if (w?.dateRangeStr) resolvedDate = w.dateRangeStr;
                }
                if (!resolvedDate && assignment.noteText) {
                  const dm = assignment.noteText.match(/deadline[:\s]+([A-Za-z]+ \d{1,2}(?:, \d{4})?)/i);
                  if (dm) resolvedDate = parseSafeDate(dm[1]);
                }
                const formattedDate = resolvedDate ? formatAssignmentDueDate(resolvedDate) : null;
                const isMultiWeek = courseHasWeeks && Array.isArray(assignment.scheduledWeeks) && assignment.scheduledWeeks.length > 1;
                const weekRangeStr = isMultiWeek
                  ? `Weeks ${Math.min(...assignment.scheduledWeeks!)} to ${Math.max(...assignment.scheduledWeeks!)}`
                  : null;

                if (weekRangeStr && formattedDate) {
                  parts.push(`${weekRangeStr} • ${formattedDate}`);
                } else if (formattedDate) {
                  parts.push(formattedDate);
                } else if (weekRangeStr) {
                  parts.push(`${weekRangeStr} • Presentation Window`);
                } else if (titleLower.includes('attendance') || titleLower.includes('participation') || isContinuous) {
                  parts.push('Throughout Term');
                }
              }

              // 3. Weight Percentage (clean, e.g. 20%, 10%, 40%)
              let weight = assignment.weightPercentage;
              if (!weight) {
                const textToScan = `${assignment.title || ''} ${assignment.fullInstructions || ''} ${assignment.noteText || ''} ${assignment.relevantTopics || ''}`;
                const wm = textToScan.match(/\b(?:worth\s+|weight:\s*)?(\d{1,2}(?:\.\d+)?)\s*%/i) || textToScan.match(/\b(\d{1,2})\s*percent\b/i);
                if (wm) weight = `${wm[1]}%`;
              } else if (!weight.endsWith('%')) {
                weight = `${weight}%`;
              }
              if (weight) {
                parts.push(weight);
              }

              // 4. Points Possible
              let points = assignment.pointsPossible;
              if (!points && assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
                const sumPts = assignment.rubricCriteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
                if (sumPts > 0) points = `${sumPts} pts`;
              }
              if (!points) {
                const textToScan = `${assignment.title || ''} ${assignment.fullInstructions || ''} ${assignment.noteText || ''}`;
                const pm = textToScan.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
                if (pm) points = `${pm[1]} pts`;
              }
              if (points && !points.includes('%')) {
                const cleanP = points.replace(/Points/i, 'pts').trim();
                if (cleanP !== weight) {
                  parts.push(cleanP);
                }
              }

              const bottomText = parts.join(' · ');
              if (!bottomText) return null;

              return (
                <Text style={styles.assignmentSubtitle} numberOfLines={2}>
                  {bottomText}
                </Text>
              );
            })()}
          </TouchableOpacity>

          {/* Right Action: Completion Checkmark OR Restore Pill */}
          {sortMode === 'trash' ? (
            <View style={styles.trashActionsRow}>
              <TouchableOpacity
                style={styles.restorePillButton}
                onPress={() => restoreAssignment(assignment.id)}
                activeOpacity={0.7}
              >
                <ArrowPathIcon size={13} color="#FFFFFF" />
                <Text style={styles.restorePillText}>Restore</Text>
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
        <View style={styles.headerLeftMonthWrap}>
          <Text
            style={styles.headerMonthText}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.85}
            testID="assignments-header-month"
          >
            {calendarMonthYear || fallbackMonthYear}
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
            <TrashIcon size={17} color={sortMode === 'trash' ? '#FFFFFF' : '#D94033'} />
            <Text style={[styles.trashCountText, sortMode === 'trash' && { color: '#FFFFFF' }]}>{deletedCount}</Text>
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
        currentAcademicWeek={currentAcademicWeek}
        showCardMonth={false}
        onMonthYearChange={setCalendarMonthYear}
      />

      {/* MARK: - Single Course Assignment Loading / Progress Section */}
      {activeCourse && (() => {
        const courseAssigns = assignments.filter(
          a => !a.isDeleted && isItemForCourse(a, activeCourse)
        );
        const total = courseAssigns.length;
        const completed = courseAssigns.filter(a => a.isCompleted).length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <View style={styles.progressCardContainer}>
            <View style={styles.courseProgressRow}>
              <View style={styles.courseProgressHeader}>
                <View style={styles.courseColorDotContainer}>
                  <PulsingColorDot color={activeCourse.hexColor} isPulsing={false} size={8} />
                </View>
                <Text style={styles.courseCodeText} numberOfLines={1}>
                  {activeCourse.courseCode || activeCourse.courseName}
                </Text>
              </View>

              <View style={styles.progressCapsuleTrackRow}>
                <View style={styles.capsuleTrack}>
                  <View
                    style={[
                      styles.capsuleFill,
                      {
                        backgroundColor: activeCourse.hexColor,
                        width: `${pct === 0 ? 0 : Math.max(4, pct)}%`
                      }
                    ]}
                  />
                </View>

                {total > 0 && (
                  <View style={[styles.percentageBadge, { backgroundColor: activeCourse.hexColor }]}>
                    <Text style={styles.percentageBadgeText}>
                      {`${completed} of ${total} (${pct}%)`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })()}

      {/* Trash Mode Banner */}
      {sortMode === 'trash' && (
        <View style={styles.trashModeBanner}>
          <View style={styles.trashModeLeft}>
            <TrashIcon size={16} color="#D94033" />
            <Text style={styles.trashModeTitle}>
              Viewing Trash ({deletedCount} deleted items)
            </Text>
          </View>
          {deletedCount > 0 && (
            <TouchableOpacity
              style={styles.emptyTrashBtn}
              onPress={() => {
                Alert.alert(
                  'Empty Trash',
                  'Are you sure you want to permanently delete all items in the trash? This cannot be undone.',
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

      {/* Active Calendar Date Highlight Banner / Section */}
      {isDateFilterActive && dateFilteredAssignments.length > 0 && (
        <View style={styles.dateFilterSection}>
          <View style={styles.dateFilterHeader}>
            <View style={styles.dateFilterTitleRow}>
              <CalendarIcon size={14} color={CoursePalTheme.accentBlue} />
              <Text style={styles.dateFilterTitle}>
                Due on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearDateFilterBtn}
              onPress={() => setIsDateFilterActive(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.clearDateFilterBtnText}>Show All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateFilterCardsList}>
            {dateFilteredAssignments.map(renderAssignmentCard)}
          </View>
        </View>
      )}

      {/* MARK: - Deliverables List */}
      {activeAssignments.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>No Assignments Found</Text>
          <Text style={styles.emptySubtitle}>
            Add an assignment or upload a syllabus to automatically generate tasks.
          </Text>
        </View>
      ) : (
        <View style={styles.assignmentsListContainer}>
          {isDateFilterActive && (
            <View style={styles.allSectionHeader}>
              <Text style={styles.allSectionTitle}>All Assignments</Text>
            </View>
          )}
          {/* Non-week assignments (when week toggle is turned off or course-wide deliverables) */}
          {unassignedAssignments.length > 0 && (
            <View style={styles.unassignedGroupSection}>
              {unassignedAssignments.some(a => a.assignmentNumber != null) ? (
                unassignedAssignments.map((a, idx) => {
                  const assignNum = a.assignmentNumber || (idx + 1);
                  const assignLabel = a.assignmentNumberLabel || `Assignment ${assignNum}`;
                  const c = matchCourseForItem(a, courses);
                  const desc = getAssignmentInstructionSummary(a, c);
                  return (
                    <View key={a.id} style={{ gap: 6, marginBottom: 4 }}>
                      <View style={styles.weekHeaderRow}>
                        <View style={styles.weekPill}>
                          <Text style={styles.weekPillText}>{assignLabel}</Text>
                        </View>
                      </View>
                      {desc ? (
                        <View style={styles.weekThemeHeaderRow}>
                          <Text style={styles.weekThemeHeaderText} numberOfLines={2}>
                            {desc}
                          </Text>
                        </View>
                      ) : null}
                      {renderAssignmentCard(a)}
                    </View>
                  );
                })
              ) : (
                <>
                  <View style={styles.weekHeaderRow}>
                    <View style={styles.weekPill}>
                      <Text style={styles.weekPillText}>Assignments</Text>
                    </View>
                  </View>
                  {unassignedAssignments.map(a => renderAssignmentCard(a))}
                </>
              )}
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
                {weekNum === currentAcademicWeek && (
                  <View style={styles.currentWeekHeaderBadge}>
                    <Text style={styles.currentWeekHeaderBadgeText}>Current Week</Text>
                  </View>
                )}
              </View>

              {/* Assignment Cards */}
              {weekList.map(a => renderAssignmentCard(a, weekNum))}
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
    paddingBottom: 190
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12
  },
  headerLeftMonthWrap: {
    flex: 1,
    paddingLeft: 16,
    marginRight: 12,
    justifyContent: 'center'
  },
  headerMonthText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#141F38',
    letterSpacing: -0.4
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
    backgroundColor: '#EF4444'
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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 18,
    marginTop: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10
  },
  courseProgressRow: {
    gap: 8
  },
  courseProgressRowActive: {
    backgroundColor: '#F1F5F9'
  },
  courseProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  courseColorDotContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  courseColorDotGlowRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5
  },
  courseColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4
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
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8
  },
  percentageBadgeText: {
    fontSize: 11.5,
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
  weekThemeHeaderRow: {
    paddingHorizontal: 2,
    marginTop: 2,
    marginBottom: 4
  },
  weekThemeHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18
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
    flexWrap: 'wrap',
    gap: 6
  },
  coursePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  coursePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  presentationBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  presentationBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  assignmentNumberBadge: {
    backgroundColor: '#738094',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  assignmentNumberBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  gradeBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gradeBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  continuousBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  continuousBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  },
  videoBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  videoBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  currentWeekHeaderBadge: {
    backgroundColor: '#475569',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  currentWeekHeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2
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
  assignmentSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 4,
    lineHeight: 18
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#BFCCD9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
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
    backgroundColor: CoursePalTheme.accentBlue,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  restorePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
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
  },
  dateFilterSection: {
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#F0F6FF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D4E4FC',
    padding: 12
  },
  dateFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  dateFilterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  dateFilterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  clearDateFilterBtn: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  clearDateFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  dateFilterCardsList: {
    gap: 8
  },
  dateFilterEmptyCard: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  dateFilterEmptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#718096',
    textAlign: 'center'
  },
  allSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 4
  },
  allSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#718096',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  }
});
