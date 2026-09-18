import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking
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
import { PulsingColorDot } from '../components/PulsingColorDot';
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
  extractReadingWeekNumber,
  getReadingChapterSortKey,
  cleanDateRangeDisplay,
  formatWeekHeaderDate
} from '../utils/readingDisplayHelper';
import { getStartOfWeek, getBaseTermStartDate, calculateAcademicWeek } from '../utils/timeFormatters';

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
  const [groupingViewMode, setGroupingViewMode] = useState<'weeks' | 'modules'>('weeks');
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
          r.courseId ? r.courseId === selectedCourseFilter.id : (r.courseCode || '').toLowerCase() === cCode;
        if (!matchesCourse) {
          return false;
        }
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
  }, [deduplicatedRawReadings, sortMode, selectedCourseFilter, selectedWeekFilter]);

  // Items due on currently selected calendar date (for highlight banner)
  const dateFilteredReadings = useMemo(() => {
    if (!isDateFilterActive) return [];
    return activeReadings.filter(r => {
      if (!r.dueDate) return false;
      const d = parseSafeDate(r.dueDate);
      if (!d) return false;
      return (
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate()
      );
    });
  }, [activeReadings, isDateFilterActive, selectedDate]);

  const completedCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => !r.isDeleted && r.isCompleted).length;
  }, [deduplicatedRawReadings]);

  const deletedCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => r.isDeleted).length;
  }, [deduplicatedRawReadings]);

  const remainingTotalCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => {
      if (r.isDeleted || r.isCompleted) return false;
      if (selectedCourseFilter) {
        const cCode = (selectedCourseFilter.courseCode || selectedCourseFilter.courseName).toLowerCase();
        return r.courseId ? r.courseId === selectedCourseFilter.id : (r.courseCode || '').toLowerCase() === cCode;
      }
      return true;
    }).length;
  }, [deduplicatedRawReadings, selectedCourseFilter]);

  // Map of date string -> array of course hex colors for deadlines calendar dots (readings only)
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
        c => (r.courseId ? c.id === r.courseId : (c.courseCode || c.courseName).toLowerCase() === (r.courseCode || '').toLowerCase())
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

  // Earliest academic start date of the courses/readings in view
  const termStartDate = useMemo(() => {
    // 1. If a course is selected, use that course's earliest date
    if (selectedCourseFilter) {
      if (selectedCourseFilter.weeks && selectedCourseFilter.weeks.length > 0) {
        for (const w of selectedCourseFilter.weeks) {
          if (w.startDate) {
            const d = parseSafeDate(w.startDate);
            if (d) return d;
          }
        }
      }
      const courseReadings = readings.filter(
        r => !r.isDeleted && (r.courseId ? r.courseId === selectedCourseFilter.id : (r.courseCode || '').toLowerCase() === (selectedCourseFilter.courseCode || selectedCourseFilter.courseName).toLowerCase())
      );
      for (const r of courseReadings) {
        if (r.dueDate) {
          const d = parseSafeDate(r.dueDate);
          if (d) return d;
        }
      }
    }

    // 2. Otherwise, find the earliest date across all courses/readings
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
    for (const r of readings) {
      if (r.isDeleted) continue;
      if (r.dueDate) {
        const d = parseSafeDate(r.dueDate);
        if (d && (!earliest || d.getTime() < earliest.getTime())) earliest = d;
      }
    }

    return earliest || null;
  }, [selectedCourseFilter, courses, readings]);

  // Available academic week numbers across all active readings and courses
  const availableWeekNumbers = useMemo(() => {
    const set = new Set<number>();
    for (const r of deduplicatedRawReadings) {
      if (r.isDeleted) continue;
      const w = extractReadingWeekNumber(r);
      if (w && w > 0) set.add(w);
    }
    for (const c of courses) {
      if (c.weeks) {
        for (const w of c.weeks) {
          if (w.weekNumber && w.weekNumber > 0) set.add(w.weekNumber);
        }
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [deduplicatedRawReadings, courses]);

  // Determine the current academic week that the student is in today
  const currentAcademicWeek = useMemo(() => {
    const activeCourse = selectedCourseFilter || courses[0];
    return calculateAcademicWeek(new Date(), activeCourse, termStartDate, availableWeekNumbers);
  }, [selectedCourseFilter, courses, termStartDate, availableWeekNumbers]);

  // Group coursework (readings only): partition into unassigned and week-grouped modules
  const { unassignedReadings, groupedWeeks } = useMemo(() => {
    const unReadings: Reading[] = [];
    const readingsByWeek = new Map<number, Reading[]>();
    const allWeeks = new Set<number>();

    for (const r of activeReadings) {
      const isWeekOn = isReadingWeekEnabled(r);
      if (!isWeekOn) {
        unReadings.push(r);
      } else {
        const w = extractReadingWeekNumber(r) || 1;
        if (selectedWeekFilter === null || selectedWeekFilter === w) {
          allWeeks.add(w);
          const list = readingsByWeek.get(w) || [];
          list.push(r);
          readingsByWeek.set(w, list);
        }
      }
    }

    const sortedUnReadings = [...unReadings].sort((a, b) => {
      const chA = getReadingChapterSortKey(a);
      const chB = getReadingChapterSortKey(b);
      if (chA !== chB) return chA - chB;
      const dA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      if (dA !== dB) return dA - dB;
      return (a.title || '').localeCompare(b.title || '');
    });

    const sortedWeeks = Array.from(allWeeks)
      .sort((a, b) => a - b)
      .map(w => {
        const rList = (readingsByWeek.get(w) || []).sort((a, b) => {
          const chA = getReadingChapterSortKey(a);
          const chB = getReadingChapterSortKey(b);
          if (chA !== chB) return chA - chB;
          const dA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const dB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          if (dA !== dB) return dA - dB;
          return (a.title || '').localeCompare(b.title || '');
        });
        return {
          weekNum: w,
          readings: rList
        };
      });

    return {
      unassignedReadings: sortedUnReadings,
      groupedWeeks: sortedWeeks
    };
  }, [activeReadings, selectedWeekFilter]);

  // Group readings by Module curriculum if modules exist
  const groupedModules = useMemo(() => {
    const readingsByMod = new Map<number, Reading[]>();
    const allMods = new Set<number>();

    for (const r of activeReadings) {
      const mNum = (r.moduleNumber && r.moduleNumber > 0)
        ? r.moduleNumber
        : (r.moduleMention && /\d+/.test(r.moduleMention) ? parseInt(r.moduleMention.match(/\d+/)![0], 10) : null);
      if (mNum) {
        allMods.add(mNum);
        const list = readingsByMod.get(mNum) || [];
        list.push(r);
        readingsByMod.set(mNum, list);
      }
    }

    return Array.from(allMods)
      .sort((a, b) => a - b)
      .map(m => {
        const rList = (readingsByMod.get(m) || []).sort((a, b) => {
          const chA = getReadingChapterSortKey(a);
          const chB = getReadingChapterSortKey(b);
          if (chA !== chB) return chA - chB;
          return (a.title || '').localeCompare(b.title || '');
        });
        const sampleReading = rList[0];
        return {
          moduleNum: m,
          theme: sampleReading?.relevantTopics || `Module ${m}`,
          readings: rList
        };
      });
  }, [activeReadings]);

  const hasModules = groupedModules.length > 0;

  const renderReadingCard = (
    reading: Reading,
    weekDateStr: string | null = null,
    isUnderDatedHeader: boolean = false
  ) => {
    const matchedCourse = courses.find(
      c =>
        (reading.courseId ? c.id === reading.courseId : (c.courseCode || c.courseName).toLowerCase() === (reading.courseCode || '').toLowerCase())
    );
    const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;
    const pillTitle = getSanitizedCoursePill(reading.courseCode, matchedCourse);
    const resolvedMedia = resolveReadingMediaType(reading);
    const suggestedReadingText = formatSuggestedReadingCardText(
      reading.dueDate,
      reading.dateRangeStr,
      weekDateStr
    );
    const resolvedAuthor = reading.authorName || (() => {
      if ((reading.title || '').toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(reading.title || '')) {
        return 'Groth-Marnat';
      }
      if ((reading.resourceTitle || '').toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(reading.resourceTitle || '')) {
        return 'Groth-Marnat';
      }
      const m = (reading.title || '').match(/^([A-Z][a-zA-Z\s.&–-]+?)\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d)/i);
      return m ? m[1].trim() : null;
    })();
    const matchedWeek = reading.weekNumber
      ? (matchedCourse?.weeks || []).find(w => w.weekNumber === reading.weekNumber)
      : null;
    const weekTheme = matchedWeek?.theme;
    const readingWithTopic = {
      ...reading,
      relevantTopics: reading.relevantTopics || weekTheme || undefined
    };
    const displayTitle = formatDisplayTitleWithChapter(
      readingWithTopic,
      reading.chapterText,
      reading.resourceTitle,
      matchedCourse?.courseName,
      resolvedAuthor
    );
    const displaySubtitle = formatAuthorAndPagesSubtitle(
      resolvedAuthor,
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
            {/* Top Line: Course Title Pill, Gray Module Pill & Media Type Badge */}
            <View style={styles.pillRow}>
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{pillTitle.toUpperCase()}</Text>
              </View>
              {Boolean(reading.moduleMention || reading.moduleNumber) && (
                <View style={styles.cardModulePill}>
                  <Text style={styles.cardModulePillText}>
                    {(reading.moduleMention || `Module ${reading.moduleNumber}`).toUpperCase()}
                  </Text>
                </View>
              )}
              {reading.videoUrl ? (
                <TouchableOpacity
                  style={[styles.mediaTypeBadge, styles.youtubeMediaTypeBadge]}
                  onPress={() => {
                    const url = reading.videoUrl!.startsWith('http') ? reading.videoUrl! : `https://${reading.videoUrl}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.mediaTypeBadgeText}>
                    {/youtube\.com|youtu\.be/i.test(reading.videoUrl) ? 'YouTube' : 'Video'}
                  </Text>
                </TouchableOpacity>
              ) : resolvedMedia !== 'textbook' ? (
                <View style={styles.mediaTypeBadge}>
                  <Text style={styles.mediaTypeBadgeText}>
                    {resolvedMedia === 'video'
                      ? 'Video'
                      : resolvedMedia === 'podcast'
                      ? 'Podcast'
                      : resolvedMedia === 'article'
                      ? 'Article'
                      : 'Paper'}
                  </Text>
                </View>
              ) : null}
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

            {/* Subtitle & Suggested Reading: Author · Pages (never repeating dates under dated headers) */}
            {(() => {
              const cleanSub = (displaySubtitle || '').replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();

              // When displayed inside a dated week section or date filter, suppress suggested reading date so we never repeat dates
              const shouldShowDate = !isUnderDatedHeader && !weekDateStr && !!suggestedReadingText;

              const cleanDate = shouldShowDate && suggestedReadingText
                ? suggestedReadingText.replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim()
                : '';

              const bottomText = cleanSub && cleanDate
                ? `${cleanSub} · ${cleanDate}`
                : (cleanSub || cleanDate);
              if (!bottomText) return null;
              return (
                <Text style={styles.readingAuthor} numberOfLines={2}>
                  {bottomText}
                </Text>
              );
            })()}
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
          <View style={styles.titlePill}>
            <Text style={styles.pageSubtitle} numberOfLines={1}>
              {selectedCourseFilter
                ? `${selectedCourseFilter.courseCode || selectedCourseFilter.courseName} • ${remainingTotalCount} Remaining`
                : `All Courses • ${remainingTotalCount} Remaining`}
            </Text>
          </View>
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
          const isSame =
            isDateFilterActive &&
            d.getFullYear() === selectedDate.getFullYear() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getDate() === selectedDate.getDate();
          if (isSame) {
            setIsDateFilterActive(false);
          } else {
            setSelectedDate(d);
            setIsDateFilterActive(true);
            setSelectedWeekFilter(null);
          }
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
          if (w === 0 || w === null || selectedWeekFilter === w) {
            setSelectedWeekFilter(null);
          } else {
            setSelectedWeekFilter(w);
            setIsDateFilterActive(false);
          }
        }}
        selectedWeekFilter={selectedWeekFilter}
        itemDatesWithColors={itemDatesWithColors}
        startWeekNumber={1}
        termStartDate={termStartDate}
        currentAcademicWeek={currentAcademicWeek}
      />

      {/* MARK: - Per-Course Reading Progress Bars */}
      {courses.length > 0 && (
        <View style={styles.progressCardContainer}>
          {courses.map(course => {
            const courseReadings = deduplicatedRawReadings.filter(
              r =>
                !r.isDeleted &&
                (r.courseId ? r.courseId === course.id : (r.courseCode || '').toLowerCase() === (course.courseCode || course.courseName).toLowerCase())
            );
            const total = courseReadings.length;
            const completed = courseReadings.filter(r => r.isCompleted).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            const isSelected = selectedCourseFilter?.id === course.id;

            return (
              <TouchableOpacity
                key={course.id}
                style={styles.courseProgressRow}
                onPress={() => setSelectedCourseFilter(isSelected ? null : course)}
                activeOpacity={0.7}
              >
                <View style={styles.courseProgressHeader}>
                  <View style={styles.courseColorDotContainer}>
                    <PulsingColorDot color={course.hexColor} isPulsing={isSelected} size={8} />
                  </View>
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
                          width: `${pct === 0 ? 0 : Math.max(4, pct)}%`
                        }
                      ]}
                    />
                  </View>

                  <View style={[styles.percentageBadge, { backgroundColor: course.hexColor }]}>
                    <Text style={styles.percentageBadgeText}>
                      {total === 0 ? '0 readings' : `${completed} of ${total} (${pct}%)`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
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

      {/* Active Calendar Date Highlight Banner / Section */}
      {isDateFilterActive && dateFilteredReadings.length > 0 && (
        <View style={styles.dateFilterSection}>
          <View style={styles.dateFilterHeader}>
            <View style={styles.dateFilterTitleRow}>
              <CalendarIcon size={14} color={CoursePalTheme.accentBlue} />
              <Text style={styles.dateFilterTitle}>
                Scheduled for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
            {dateFilteredReadings.map(r => renderReadingCard(r, null, true))}
          </View>
        </View>
      )}

      {/* MARK: - Coursework List (Readings Only) */}
      {groupedWeeks.length === 0 && unassignedReadings.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>
            {selectedWeekFilter !== null
              ? `No Readings in Week ${selectedWeekFilter}`
              : 'No Readings Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {selectedWeekFilter !== null
              ? `There are no readings assigned to Week ${selectedWeekFilter}.`
              : 'Upload a syllabus to automatically populate your reading schedule.'}
          </Text>
          {selectedWeekFilter !== null && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => setSelectedWeekFilter(null)}
            >
              <Text style={styles.showAllButtonText}>Show All Weeks</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.readingsListContainer}>
          {/* Segmented Switcher between Weeks and Modules (when course has modules) */}
          {hasModules && (
            <View style={styles.viewModeSegmentContainer}>
              <TouchableOpacity
                style={[
                  styles.viewModeSegmentBtn,
                  groupingViewMode === 'weeks' && styles.viewModeSegmentBtnActive
                ]}
                onPress={() => setGroupingViewMode('weeks')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.viewModeSegmentText,
                    groupingViewMode === 'weeks' && styles.viewModeSegmentTextActive
                  ]}
                >
                  Weekly Schedule ({groupedWeeks.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.viewModeSegmentBtn,
                  groupingViewMode === 'modules' && styles.viewModeSegmentBtnActive
                ]}
                onPress={() => setGroupingViewMode('modules')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.viewModeSegmentText,
                    groupingViewMode === 'modules' && styles.viewModeSegmentTextActive
                  ]}
                >
                  Modules ({groupedModules.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isDateFilterActive && (
            <View style={styles.allSectionHeader}>
              <Text style={styles.allSectionTitle}>All Weeks</Text>
            </View>
          )}

          {/* Non-week readings (when week toggle is turned off) */}
          {unassignedReadings.length > 0 && (
            <View style={styles.unassignedGroupSection}>
              {unassignedReadings.map(r => {
                let fallbackDate: string | null = null;
                const wk = r.weekNumber || (r.weekId && /\d+/.test(r.weekId) ? parseInt(r.weekId.match(/\d+/)![0], 10) : null);
                if (wk) {
                  const matchedCourse = courses.find(
                    c => (r.courseId ? c.id === r.courseId : (c.courseCode || c.courseName).toLowerCase() === (r.courseCode || '').toLowerCase())
                  );
                  const w = matchedCourse?.weeks?.find(wItem => wItem.weekNumber === wk);
                  if (w?.dateRangeStr && isRealDateOrRangeString(w.dateRangeStr)) {
                    fallbackDate = w.dateRangeStr;
                  } else if (w?.startDate) {
                    fallbackDate = w.startDate instanceof Date ? w.startDate.toISOString().split('T')[0] : String(w.startDate);
                  }
                }
                return renderReadingCard(r, fallbackDate, false);
              })}
            </View>
          )}

          {/* Week-grouped readings (when in Weekly Schedule view) */}
          {groupingViewMode === 'weeks' && groupedWeeks.map(({ weekNum, readings: weekReadingsList }) => {
            const firstWithRealDate = weekReadingsList.find(
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
              const targetCourse = selectedCourseFilter || courses.find(
                c => {
                  const sample = weekReadingsList[0];
                  if (!sample) return false;
                  return sample.courseId ? c.id === sample.courseId : (c.courseCode || c.courseName).toLowerCase() === (sample.courseCode || '').toLowerCase();
                }
              );
              if (targetCourse) {
                const w = targetCourse.weeks?.find(wk => wk.weekNumber === weekNum);
                if (w?.dateRangeStr && isRealDateOrRangeString(w.dateRangeStr)) {
                  weekDateStr = w.dateRangeStr;
                } else if (w?.startDate) {
                  weekDateStr = w.startDate instanceof Date ? w.startDate.toISOString().split('T')[0] : String(w.startDate);
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
                  {weekNum === currentAcademicWeek && (
                    <View style={styles.currentWeekHeaderBadge}>
                      <Text style={styles.currentWeekHeaderBadgeText}>Current Week</Text>
                    </View>
                  )}
                  {weekDateStr && (() => {
                    const parsed = parseSafeDate(weekDateStr);
                    if (parsed && !isNaN(parsed.getTime())) {
                      const fullMonth = parsed.toLocaleDateString('en-US', { month: 'long' });
                      const day = parsed.getDate();
                      const year = parsed.getFullYear();
                      return (
                        <Text style={styles.weekDateHeaderText}>
                          {fullMonth} {day}, {year}
                        </Text>
                      );
                    }
                    if (isRealDateOrRangeString(weekDateStr)) {
                      return (
                        <Text style={styles.weekDateHeaderText}>
                          {cleanDateRangeDisplay(weekDateStr)}
                        </Text>
                      );
                    }
                    return (
                      <Text style={styles.weekDateHeaderText}>
                        {formatWeekHeaderDate(weekDateStr)}
                      </Text>
                    );
                  })()}
                  {selectedWeekFilter !== null && (
                    <TouchableOpacity
                      style={styles.showAllPillBtn}
                      onPress={() => setSelectedWeekFilter(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.showAllPillBtnText}>Show All Weeks</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Readings for this Week */}
                {weekReadingsList.map(r => renderReadingCard(r, weekDateStr, !!weekDateStr))}
              </View>
            );
          })}

          {/* Module-grouped readings (when in Course Modules view) */}
          {groupingViewMode === 'modules' && groupedModules.map(({ moduleNum, theme, readings: moduleReadingsList }) => {
            return (
              <View key={`module-${moduleNum}`} style={styles.weekGroupSection}>
                {/* Module Header Row */}
                <View style={styles.weekHeaderRow}>
                  <View style={styles.weekPill}>
                    <Text style={styles.weekPillText}>Module {moduleNum}</Text>
                  </View>
                  {theme && (
                    <Text style={styles.weekDateHeaderText} numberOfLines={1}>
                      {theme}
                    </Text>
                  )}
                </View>

                {/* Readings for this Module */}
                {moduleReadingsList.map(r => renderReadingCard(r, null, false))}
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
  titlePill: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  pageSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#596B85'
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
  weekDateHeaderText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B'
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
  showAllPillBtn: {
    marginLeft: 'auto',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  showAllPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
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
  cardModulePill: {
    backgroundColor: '#738094',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardModulePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  viewModeSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14
  },
  viewModeSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  viewModeSegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2
  },
  viewModeSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  viewModeSegmentTextActive: {
    color: '#1E293B',
    fontWeight: '700'
  },
  mediaTypeBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  mediaTypeBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  youtubeMediaTypeBadge: {
    backgroundColor: '#475569'
  },
  youtubeMediaTypeBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  videoMediaTypeBadge: {
    backgroundColor: '#475569'
  },
  videoMediaTypeBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700'
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
  assignmentTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19
  },
  assignmentTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E9BAE'
  },
  assignmentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    gap: 4
  },
  assignmentDateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  weightText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  deliverableBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  deliverableBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2470F5',
    letterSpacing: 0.5
  },
  presentationBadge: {
    backgroundColor: '#FAF5FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E9D5FF'
  },
  presentationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9333EA'
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D4E4FC'
  },
  clearDateFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
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
  },
  subCategorySection: {
    gap: 8,
    marginBottom: 6
  },
  subCategoryHeaderRow: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 2
  },
  subCategoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#718096',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  }
});
