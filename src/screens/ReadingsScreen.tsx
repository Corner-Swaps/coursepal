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
import { DeadlinesCalendarCard } from '../components/DeadlinesCalendarCard';
import { SwipeableRow } from '../components/SwipeableRow';
import {
  FilterIcon,
  CheckmarkCircleFillIcon,
  TrashIcon,
  CalendarIcon,
  ArrowPathIcon
} from '../components/SvgIcons';
import { Course, Reading } from '../types/models';
import { ReadingDetailModal } from '../components/modals';
import {
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  formatSuggestedReadingCardText,
  isRealDateOrRangeString,
  resolveReadingMediaType,
  parseSafeDate,
  getSanitizedCoursePill,
  deduplicateReadingsList,
  isReadingWeekEnabled,
  extractReadingWeekNumber
} from '../utils/readingDisplayHelper';

interface ReadingsScreenProps {
  onOpenFilterModal: () => void;
}

export const ReadingsScreen: React.FC<ReadingsScreenProps> = ({ onOpenFilterModal }) => {
  const {
    courses,
    readings,
    toggleReading,
    updateReading,
    deleteReading,
    restoreReading,
    emptyReadingsTrash,
    permanentlyDeleteReading,
    selectedCourseFilter,
    setSelectedCourseFilter
  } = useCoursePal();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDateFilterActive, setIsDateFilterActive] = useState<boolean>(false);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<'readings' | 'completed' | 'trash'>('readings');
  const [selectedReadingForDetail, setSelectedReadingForDetail] = useState<Reading | null>(null);

  // Deduplicate raw readings list to eliminate duplicate chapters & multi-week clone noise
  const deduplicatedRawReadings = useMemo(() => {
    return deduplicateReadingsList(readings, courses);
  }, [readings, courses]);

  // Filter active (non-deleted) readings
  const activeReadings = useMemo(() => {
    return deduplicatedRawReadings.filter(r => {
      if (sortMode === 'trash') {
        return r.isDeleted;
      }
      if (r.isDeleted) return false;

      // Filter by Course if selected
      if (selectedCourseFilter) {
        const cCode = (selectedCourseFilter.courseCode || selectedCourseFilter.courseName).toLowerCase();
        const matchesCourse =
          r.courseId === selectedCourseFilter.id ||
          (r.courseCode || '').toLowerCase() === cCode;
        if (!matchesCourse) {
          return false;
        }
      }

      // Filter by Specific Calendar Date
      if (isDateFilterActive) {
        if (!r.dueDate) return false;
        const d = parseSafeDate(r.dueDate);
        if (!d) return false;
        const isSame =
          d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
        if (!isSame) return false;
      }

      // Filter by Academic Week
      if (selectedWeekFilter !== null) {
        const isWeekOn = isReadingWeekEnabled(r);
        const w = isWeekOn ? extractReadingWeekNumber(r) : null;
        if (w !== selectedWeekFilter) return false;
      }

      // Filter by Completed mode
      if (sortMode === 'completed') {
        return r.isCompleted;
      }

      return true;
    });
  }, [deduplicatedRawReadings, sortMode, selectedCourseFilter, isDateFilterActive, selectedDate, selectedWeekFilter]);

  const completedCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => !r.isDeleted && r.isCompleted).length;
  }, [deduplicatedRawReadings]);

  const deletedCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => r.isDeleted).length;
  }, [deduplicatedRawReadings]);

  const remainingTotalCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => !r.isDeleted && !r.isCompleted).length;
  }, [deduplicatedRawReadings]);

  // Map of date string -> array of course hex colors for deadlines calendar dots
  const itemDatesWithColors = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of readings) {
      if (r.isDeleted || !r.dueDate) continue;
      const d = parseSafeDate(r.dueDate);
      if (!d) continue;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;

      const matchedCourse = courses.find(
        c => c.id === r.courseId || (c.courseCode || c.courseName).toLowerCase() === (r.courseCode || '').toLowerCase()
      );
      const color = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;

      const existing = map.get(key) || [];
      if (!existing.includes(color)) {
        existing.push(color);
      }
      map.set(key, existing);
    }
    return map;
  }, [readings, courses]);

  // Group readings: partition into unassigned (week toggle off) and week-grouped (week toggle on)
  const { unassignedReadings, groupedReadings } = useMemo(() => {
    const unassigned: Reading[] = [];
    const map = new Map<number, Reading[]>();

    for (const r of activeReadings) {
      const isWeekOn = isReadingWeekEnabled(r);
      if (!isWeekOn) {
        unassigned.push(r);
      } else {
        const w = extractReadingWeekNumber(r) || 1;
        const list = map.get(w) || [];
        list.push(r);
        map.set(w, list);
      }
    }

    return {
      unassignedReadings: unassigned,
      groupedReadings: Array.from(map.entries()).sort(([w1], [w2]) => w1 - w2)
    };
  }, [activeReadings]);

  const renderReadingCard = (reading: Reading, weekDateStr: string | null = null) => {
    const matchedCourse = courses.find(
      c =>
        c.id === reading.courseId ||
        (c.courseCode || c.courseName).toLowerCase() ===
        (reading.courseCode || '').toLowerCase()
    );
    const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;
    const pillTitle = getSanitizedCoursePill(reading.courseCode, matchedCourse);
    const resolvedMedia = resolveReadingMediaType(reading);
    const suggestedReadingText = formatSuggestedReadingCardText(
      reading.dueDate,
      reading.dateRangeStr,
      weekDateStr
    );
    const displayTitle = formatDisplayTitleWithChapter(
      reading,
      reading.chapterText,
      reading.resourceTitle,
      matchedCourse?.courseName,
      reading.authorName
    );
    const displaySubtitle = formatAuthorAndPagesSubtitle(
      reading.authorName,
      reading.pagesText,
      reading.resourceTitle,
      displayTitle,
      matchedCourse?.courseName
    );

    return (
      <SwipeableRow
        key={reading.id}
        onDelete={() => deleteReading(reading.id)}
        enabled={sortMode !== 'trash'}
      >
        <View style={styles.readingCard}>
          {/* Left Vertical Course Color Line Indicator */}
          <View style={[styles.leftAccentStripe, { backgroundColor: courseColor }]} />

          {/* Middle Content Area */}
          <TouchableOpacity
            style={styles.cardMainContent}
            onPress={() => setSelectedReadingForDetail({ ...reading, mediaType: resolvedMedia })}
            activeOpacity={0.7}
          >
            {/* Top Line: Course Title Pill & Media Type Badge */}
            <View style={styles.pillRow}>
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{pillTitle.toUpperCase()}</Text>
              </View>
              {resolvedMedia !== 'textbook' && (
                <View style={styles.mediaTypeBadge}>
                  <Text style={styles.mediaTypeBadgeText}>
                    {resolvedMedia === 'video' ? 'Video' : resolvedMedia === 'podcast' ? 'Podcast' : 'Article / Paper'}
                  </Text>
                </View>
              )}
            </View>

            {/* Reading Title / Chapter Name */}
            <Text
              style={[
                styles.readingTitle,
                reading.isCompleted && styles.readingTitleCompleted
              ]}
              numberOfLines={3}
            >
              {displayTitle}
            </Text>

            {/* Suggested Reading Section (just below the chapter name, no icon, abbreviated day) */}
            {suggestedReadingText ? (
              <View style={styles.suggestedReadingPill}>
                <Text style={styles.suggestedReadingPillText}>
                  {suggestedReadingText}
                </Text>
              </View>
            ) : null}

            {/* Subtitle: Author · Pages */}
            {displaySubtitle ? (
              <Text style={styles.readingAuthor} numberOfLines={2}>
                {displaySubtitle}
              </Text>
            ) : null}
          </TouchableOpacity>

          {/* Right-side Action Buttons: Checkmark Ring & Trashcan OR Restore & Permanent Delete */}
          {sortMode === 'trash' ? (
            <View style={styles.trashActionsRow}>
              <TouchableOpacity
                style={styles.restorePillButton}
                onPress={() => restoreReading(reading.id)}
                activeOpacity={0.7}
              >
                <ArrowPathIcon size={13} color={CoursePalTheme.accentBlue} />
                <Text style={styles.restorePillText}>Restore</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.permanentTrashBtn}
                onPress={() => {
                  Alert.alert(
                    'Delete Reading Permanently?',
                    `Are you sure you want to permanently delete '${reading.title}'? This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => permanentlyDeleteReading(reading.id)
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
                onPress={() => toggleReading(reading.id)}
                activeOpacity={0.7}
                accessibilityLabel={`Mark ${reading.title} as ${reading.isCompleted ? 'incomplete' : 'complete'}`}
              >
                <View
                  style={[
                    styles.checkboxCircle,
                    reading.isCompleted && {
                      backgroundColor: CoursePalTheme.accentBlue,
                      borderColor: CoursePalTheme.accentBlue
                    }
                  ]}
                >
                  {reading.isCompleted && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.trashTouchContainer}
                onPress={() => deleteReading(reading.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityLabel={`Delete ${reading.title}`}
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
        testID="readings-screen-scroll"
      >
      {/* MARK: - Page Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftCol}>
          <Text style={styles.pageTitle}>Readings</Text>
          <Text style={styles.pageSubtitle}>
            {remainingTotalCount} reading{remainingTotalCount === 1 ? '' : 's'} remaining
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
            testID="readings-filter-button"
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
            onPress={() => setSortMode(sortMode === 'completed' ? 'readings' : 'completed')}
            activeOpacity={0.7}
            testID="readings-completed-pill"
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
            onPress={() => setSortMode(sortMode === 'trash' ? 'readings' : 'trash')}
            activeOpacity={0.7}
            testID="readings-trash-pill"
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
          setSelectedWeekFilter(null);
        }}
        isDateFilterActive={isDateFilterActive}
        onToggleDateFilter={() => {
          if (isDateFilterActive || selectedWeekFilter !== null) {
            setIsDateFilterActive(false);
            setSelectedWeekFilter(null);
          } else {
            setIsDateFilterActive(true);
          }
        }}
        onSelectWeek={w => {
          if (selectedWeekFilter === w) {
            setSelectedWeekFilter(null);
          } else {
            setSelectedWeekFilter(w);
            setIsDateFilterActive(false);
          }
        }}
        selectedWeekFilter={selectedWeekFilter}
        itemDatesWithColors={itemDatesWithColors}
        startWeekNumber={1}
      />

      {/* Active Calendar Date or Week Filter Banner */}
      {(isDateFilterActive || selectedWeekFilter !== null) && (
        <View style={styles.calendarFilterBanner}>
          <CalendarIcon size={14} color="#2470F5" />
          <Text style={styles.calendarFilterBannerText} numberOfLines={1}>
            {selectedWeekFilter !== null
              ? `Showing: Week ${selectedWeekFilter} Readings`
              : `Showing: ${selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} Readings`}
          </Text>
          <TouchableOpacity
            style={styles.clearFilterButton}
            onPress={() => {
              setIsDateFilterActive(false);
              setSelectedWeekFilter(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.clearFilterText}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MARK: - Per-Course Reading Progress Bars */}
      {courses.length > 0 && (
        <View style={styles.progressCardContainer}>
          {courses.map(course => {
            const courseReadings = deduplicatedRawReadings.filter(
              r =>
                !r.isDeleted &&
                (r.courseId === course.id ||
                  (r.courseCode || '').toLowerCase() === (course.courseCode || course.courseName).toLowerCase())
            );
            const total = courseReadings.length;
            const completed = courseReadings.filter(r => r.isCompleted).length;
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
                  'This will permanently delete all readings in the trash. This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Empty Trash',
                      style: 'destructive',
                      onPress: () => emptyReadingsTrash()
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

      {/* MARK: - Grouped Reading Cards */}
      {activeReadings.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>
            {isDateFilterActive
              ? 'No Readings on This Date'
              : selectedWeekFilter !== null
              ? `No Readings in Week ${selectedWeekFilter}`
              : 'No Readings Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isDateFilterActive
              ? 'There are no readings scheduled for this selected date.'
              : selectedWeekFilter !== null
              ? `There are no readings assigned to Week ${selectedWeekFilter}.`
              : 'Upload a syllabus to automatically populate your reading schedule.'}
          </Text>
          {(isDateFilterActive || selectedWeekFilter !== null) && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => {
                setIsDateFilterActive(false);
                setSelectedWeekFilter(null);
              }}
            >
              <Text style={styles.showAllButtonText}>Show All Readings</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.readingsListContainer}>
          {/* Non-week readings (when week toggle is turned off) */}
          {unassignedReadings.length > 0 && (
            <View style={styles.unassignedGroupSection}>
              {unassignedReadings.map(r => renderReadingCard(r, null))}
            </View>
          )}

          {/* Week-grouped readings (when week toggle is turned on) */}
          {groupedReadings.map(([weekNum, groupList]) => {
            const firstWithRealDate = groupList.find(
              r => r.dueDate || (r.dateRangeStr && isRealDateOrRangeString(r.dateRangeStr))
            );
            let weekDateStr =
              firstWithRealDate?.dateRangeStr && isRealDateOrRangeString(firstWithRealDate.dateRangeStr)
                ? firstWithRealDate.dateRangeStr
                : firstWithRealDate?.dueDate
                ? (firstWithRealDate.dueDate instanceof Date
                    ? firstWithRealDate.dueDate.toISOString()
                    : String(firstWithRealDate.dueDate))
                : null;

            if (!weekDateStr) {
              for (const c of courses) {
                const w = c.weeks?.find(wk => wk.weekNumber === weekNum);
                if (w?.dateRangeStr && isRealDateOrRangeString(w.dateRangeStr)) {
                  weekDateStr = w.dateRangeStr;
                  break;
                } else if (w?.startDate) {
                  weekDateStr = w.startDate instanceof Date ? w.startDate.toISOString().split('T')[0] : String(w.startDate);
                  break;
                }
              }
            }

            return (
              <View key={`week-${weekNum}`} style={styles.weekGroupSection}>
                {/* Week Header Row */}
                <View style={styles.weekHeaderRow}>
                  <View style={styles.weekPill}>
                    <Text style={styles.weekPillText}>Week {weekNum}</Text>
                  </View>
                </View>

                {/* Reading Cards */}
                {groupList.map(r => renderReadingCard(r, weekDateStr))}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>

    {/* Reading Detail Modal */}
    <ReadingDetailModal
      visible={selectedReadingForDetail != null}
      reading={selectedReadingForDetail}
      courses={courses}
      onClose={() => setSelectedReadingForDetail(null)}
      onSave={updated => {
        updateReading(updated);
        setSelectedReadingForDetail(updated);
      }}
      onToggleComplete={id => toggleReading(id)}
      onDeleteReading={id => deleteReading(id)}
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
  readingsListContainer: {
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
    gap: 8,
    flexWrap: 'wrap'
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
  suggestedReadingPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginVertical: 1
  },
  suggestedReadingPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1E60D5'
  },
  readingCard: {
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
  mediaTypeBadge: {
    backgroundColor: '#ECEFF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  mediaTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#596B85'
  },
  calendarFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D8E6FD'
  },
  calendarFilterBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E60D5'
  },
  readingTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19
  },
  readingTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E9BAE'
  },
  readingAuthor: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  readingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1
  },
  readingDateText: {
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
