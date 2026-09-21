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
  formatWeekHeaderDate,
  cleanDateRangeDisplay,
  isGenericPlaceholderTheme,
  cleanAcademicWeekTheme,
  isItemForCourse,
  matchCourseForItem,
  extractReadingWeekNumber,
  getReadingChapterSortKey
} from '../utils/readingDisplayHelper';
import { calculateAcademicWeek } from '../utils/timeFormatters';

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
  const [calendarMonthYear, setCalendarMonthYear] = useState<string>('');
  const [sortMode, setSortMode] = useState<'readings' | 'completed' | 'trash'>('readings');
  const [groupingViewMode, setGroupingViewMode] = useState<'weeks' | 'modules'>('weeks');
  const [selectedReadingForDetail, setSelectedReadingForDetail] = useState<Reading | null>(null);

  // Deduplicate raw readings list to eliminate duplicate chapters & multi-week clone noise
  const deduplicatedRawReadings = useMemo(() => {
    return deduplicateReadingsList(readings, courses);
  }, [readings, courses]);

  // Active course resolution: matches selectedCourseFilter if explicitly selected,
  // or null when viewing All Courses (allowing all coursework across active courses to load).
  const activeCourse = selectedCourseFilter;

  // Helper to get effective week for reading
  const getEffectiveReadingWeek = (r: Reading): number | null => {
    const isWeekOn = isReadingWeekEnabled(r);
    if (isWeekOn) {
      const w = extractReadingWeekNumber(r);
      if (w && w > 0) return w;
    }
    return null;
  };

  // Filter active (non-deleted) readings
  const activeReadings = useMemo(() => {
    return deduplicatedRawReadings.filter(r => {
      if (sortMode === 'trash') {
        if (!r.isDeleted) return false;
        if (activeCourse && !isItemForCourse(r, activeCourse)) {
          return false;
        }
        return true;
      }
      if (r.isDeleted) return false;

      // Filter strictly by Course when a specific course filter is active
      if (activeCourse && !isItemForCourse(r, activeCourse)) {
        return false;
      }

      // Filter by Academic Week (only when user actively selects a week and in weekly schedule view)
      if (selectedWeekFilter !== null && groupingViewMode === 'weeks') {
        const w = getEffectiveReadingWeek(r);
        if (w !== selectedWeekFilter) return false;
      }

      // Filter by Completed mode
      if (sortMode === 'completed') {
        return r.isCompleted;
      }

      return true;
    });
  }, [deduplicatedRawReadings, sortMode, activeCourse, selectedWeekFilter, groupingViewMode]);

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

  // Completed readings in current view scope (displayed in single bottom Done section)
  const allCompletedInView = useMemo(() => {
    if (sortMode === 'trash') return [];
    return activeReadings.filter(r => r.isCompleted);
  }, [activeReadings, sortMode]);

  // List of all non-deleted readings in the active scope (strictly filtered by activeCourse when specified)
  const scopedReadings = useMemo(() => {
    return deduplicatedRawReadings.filter(r => {
      if (r.isDeleted) return false;
      if (activeCourse && !isItemForCourse(r, activeCourse)) {
        return false;
      }
      return true;
    });
  }, [deduplicatedRawReadings, activeCourse]);

  const completedCount = useMemo(() => {
    return scopedReadings.filter(r => r.isCompleted).length;
  }, [scopedReadings]);

  const deletedCount = useMemo(() => {
    return deduplicatedRawReadings.filter(r => {
      if (!r.isDeleted) return false;
      if (activeCourse && !isItemForCourse(r, activeCourse)) {
        return false;
      }
      return true;
    }).length;
  }, [deduplicatedRawReadings, activeCourse]);

  // Weeks that actually have readings in the active scope
  const readingWeeksList = useMemo(() => {
    const weeks = new Set<number>();
    for (const r of scopedReadings) {
      const w = getEffectiveReadingWeek(r);
      if (w && w > 0) weeks.add(w);
    }
    return Array.from(weeks).sort((a, b) => a - b);
  }, [scopedReadings]);

  // The earliest week with readings (e.g. 1, or 2 if week 1 had no readings)
  const firstReadingWeek = useMemo(() => {
    return readingWeeksList.length > 0 ? readingWeeksList[0] : null;
  }, [readingWeeksList]);

  // The active study week: starting from firstReadingWeek, find the first week with incomplete readings
  const activeStudyWeek = useMemo(() => {
    if (readingWeeksList.length === 0) return null;

    for (const w of readingWeeksList) {
      const weekReadings = scopedReadings.filter(r => getEffectiveReadingWeek(r) === w);
      const hasIncomplete = weekReadings.some(r => !r.isCompleted);
      if (hasIncomplete) {
        return w;
      }
    }

    // If all weeks are completed, stay on the last week
    return readingWeeksList[readingWeeksList.length - 1];
  }, [readingWeeksList, scopedReadings]);

  // Reset selectedWeekFilter when course changes, defaulting to null (all weeks)
  // so all coursework is immediately visible rather than hiding 90% of readings behind week 1!
  const hasInitializedWeekRef = useRef<boolean>(false);
  const prevCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    const courseKey = activeCourse ? activeCourse.id : '__ALL_COURSES__';
    if (!hasInitializedWeekRef.current || prevCourseIdRef.current !== courseKey) {
      hasInitializedWeekRef.current = true;
      prevCourseIdRef.current = courseKey;
      setSelectedWeekFilter(null);
    }
  }, [activeCourse]);

  const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleReading = (readingId: string) => {
    const targetReading = deduplicatedRawReadings.find(r => r.id === readingId);
    if (!targetReading) {
      toggleReading(readingId);
      return;
    }

    const willBeCompleted = !targetReading.isCompleted;

    // If unchecking, cancel any pending auto-advance timer
    if (!willBeCompleted && advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    toggleReading(readingId);

    // If completing the last incomplete reading of the active selected week, auto-advance to next week
    if (willBeCompleted && selectedWeekFilter !== null) {
      const currentWeek = selectedWeekFilter;
      const currentWeekReadings = scopedReadings.filter(
        r => getEffectiveReadingWeek(r) === currentWeek
      );
      const otherIncomplete = currentWeekReadings.filter(
        r => r.id !== readingId && !r.isCompleted
      );

      if (otherIncomplete.length === 0 && currentWeekReadings.length > 0) {
        const nextWeek = readingWeeksList.find(w => w > currentWeek);
        if (nextWeek) {
          if (advanceTimeoutRef.current) {
            clearTimeout(advanceTimeoutRef.current);
          }
          advanceTimeoutRef.current = setTimeout(() => {
            setSelectedWeekFilter(nextWeek);
            advanceTimeoutRef.current = null;
          }, 750);
        }
      }
    }
  };

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

      const matchedCourse = matchCourseForItem(r, courses);
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
        r => !r.isDeleted && isItemForCourse(r, selectedCourseFilter)
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

  // Fallback month/year title for top-left header before calendar callback arrives
  const fallbackMonthYear = useMemo(() => {
    const d = termStartDate || selectedDate;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [termStartDate, selectedDate]);

  // Group coursework (readings only): partition into unassigned and week-grouped modules
  const { unassignedReadings, groupedWeeks } = useMemo(() => {
    const unReadings: Reading[] = [];
    const readingsByWeek = new Map<number, Reading[]>();
    const allWeeks = new Set<number>();

    for (const r of activeReadings) {
      const w = getEffectiveReadingWeek(r);
      if (!w) {
        unReadings.push(r);
      } else {
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
  }, [activeReadings, selectedWeekFilter, courses, activeCourse, groupingViewMode]);

  // Group readings by Module curriculum if modules exist
  const groupedModules = useMemo(() => {
    const readingsByMod = new Map<number, Reading[]>();
    const allMods = new Set<number>();
    const targetCourses = activeCourse ? [activeCourse] : courses;

    // Scan targetCourses for any modules defined in course weeks
    for (const c of targetCourses) {
      if (Array.isArray(c.weeks)) {
        for (const w of c.weeks) {
          if (typeof w.moduleNumber === 'number' && w.moduleNumber > 0) {
            allMods.add(w.moduleNumber);
          } else if (w.moduleMention && /\d+/.test(w.moduleMention)) {
            allMods.add(parseInt(w.moduleMention.match(/\d+/)![0], 10));
          }
        }
      }
    }

    // For CPC 512, ensure Modules 1 through 10 are always present
    const isCpc = targetCourses.some(c =>
      (c.courseCode || '').toUpperCase().includes('512') ||
      (c.courseName || '').toLowerCase().includes('family systems')
    );
    if (isCpc) {
      for (let m = 1; m <= 10; m++) {
        allMods.add(m);
      }
    }

    // Group readings by moduleNumber, falling back to course week moduleNumber if needed
    const sourceList = groupingViewMode === 'modules' ? scopedReadings : activeReadings;
    for (const r of sourceList) {
      let mNum = (r.moduleNumber && r.moduleNumber > 0)
        ? r.moduleNumber
        : (r.moduleMention && /\d+/.test(r.moduleMention) ? parseInt(r.moduleMention.match(/\d+/)![0], 10) : null);

      if (!mNum && r.weekNumber && r.weekNumber > 0) {
        for (const c of targetCourses) {
          const wk = c.weeks?.find(w => w.weekNumber === r.weekNumber);
          if (typeof wk?.moduleNumber === 'number' && wk.moduleNumber > 0) {
            mNum = wk.moduleNumber;
            break;
          }
        }
      }

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
        const sampleReading = rList.find(r => r.relevantTopics) || rList[0];
        let theme = sampleReading?.relevantTopics;
        if (!theme) {
          for (const c of targetCourses) {
            const wk = c.weeks?.find(w => w.moduleNumber === m);
            if (wk?.theme) {
              theme = wk.theme;
              break;
            }
          }
        }
        if (theme) {
          const stripped = theme.replace(/^(?:module|mod|week|wk)\s*0*\d+[:\-–—\s]*/i, '').trim();
          theme = stripped.length > 0 ? stripped : undefined;
        }
        if (!theme) {
          const cpcFallbackThemes: Record<number, string> = {
            1: 'Systems Theory and the History of Family Therapy',
            2: 'Family of Origin/ Genograms',
            3: 'Diverse Populations and Family Therapy Case Conceptualization and Application',
            4: 'Bowen Family Systems',
            5: 'Structural Family Therapy',
            6: 'Strategic Family Therapy',
            7: 'Experiential Family Therapy',
            8: 'Psychoanalytic Family Therapy',
            9: 'Cognitive Behavioural Family Therapy Clinical issues in Family Counselling',
            10: 'Social Constructionist Family Therapy Future Research and Critiques'
          };
          const isCpcCourse = targetCourses.some(c =>
            (c.courseCode || '').toUpperCase().includes('512') ||
            (c.courseName || '').toLowerCase().includes('family systems')
          );
          if (isCpcCourse && cpcFallbackThemes[m]) {
            theme = cpcFallbackThemes[m];
          }
        }
        return {
          moduleNum: m,
          theme: theme || undefined,
          readings: rList
        };
      });
  }, [activeReadings, scopedReadings, groupingViewMode, courses, activeCourse]);

  const hasDistinctModules = useMemo(() => {
    return groupedModules.length > 0;
  }, [groupedModules]);

  useEffect(() => {
    if (!hasDistinctModules && groupingViewMode === 'modules') {
      setGroupingViewMode('weeks');
    } else if (hasDistinctModules && groupedWeeks.length === 0 && groupingViewMode === 'weeks') {
      setGroupingViewMode('modules');
    }
  }, [hasDistinctModules, groupedWeeks.length, groupingViewMode]);

  const renderReadingCard = (
    reading: Reading,
    weekDateStr: string | null = null,
    isModuleView: boolean = false
  ) => {
    const matchedCourse = matchCourseForItem(reading, courses);
    const courseColor = matchedCourse?.hexColor || reading.docColorHex || CoursePalTheme.accentBlue;
    const pillTitle = getSanitizedCoursePill(reading.courseCode, matchedCourse);
    const resolvedMedia = resolveReadingMediaType(reading);
    const matchedWeek = reading.weekNumber
      ? (matchedCourse?.weeks || []).find(w => w.weekNumber === reading.weekNumber)
      : null;
    const effectiveWeekDate =
      weekDateStr ||
      (matchedWeek?.dateRangeStr && isRealDateOrRangeString(matchedWeek.dateRangeStr) ? matchedWeek.dateRangeStr : null) ||
      (matchedWeek?.startDate ? (matchedWeek.startDate instanceof Date ? matchedWeek.startDate.toISOString().split('T')[0] : String(matchedWeek.startDate)) : null);
    const suggestedReadingText = isModuleView
      ? null
      : formatSuggestedReadingCardText(
          reading.dueDate,
          reading.dateRangeStr,
          effectiveWeekDate
        );
    const rawAuthor = reading.authorName || (() => {
      if ((reading.title || '').toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(reading.title || '')) {
        return 'Groth-Marnat';
      }
      if ((reading.resourceTitle || '').toLowerCase().includes('groth-marnat') || /\bMarnat\b/i.test(reading.resourceTitle || '')) {
        return 'Groth-Marnat';
      }
      const m = (reading.title || '').match(/^([A-Z][a-zA-Z\s.&–-]+?)\s*\(\s*(?:ch(?:apter)?s?\.?|pp?\.?|\d)/i);
      return m ? m[1].trim() : null;
    })();
    const resolvedAuthor = rawAuthor ? rawAuthor.replace(/;\s*/g, ', ').trim() : null;
    const weekTheme = isModuleView ? undefined : matchedWeek?.theme;
    let cleanWeekTheme = cleanAcademicWeekTheme(weekTheme);
    let baseTitle = reading.title || '';
    if (isModuleView && baseTitle.includes(' · ')) {
      baseTitle = baseTitle.split(' · ')[0].trim();
    }
    // In weekly schedule view, if baseTitle has " · [Topic]" that repeats weekTheme or cleanWeekTheme, strip it
    if ((cleanWeekTheme || weekTheme) && baseTitle.includes(' · ')) {
      const parts = baseTitle.split(' · ');
      const suffix = parts.slice(1).join(' · ').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const themeClean = (cleanWeekTheme || weekTheme || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (suffix.length >= 4 && (themeClean.includes(suffix) || suffix.includes(themeClean))) {
        baseTitle = parts[0].trim();
      }
    }
    const hasVisibleWeekHeader = Boolean(cleanWeekTheme && cleanWeekTheme.length > 0);
    const readingWithTopic = {
      ...reading,
      title: baseTitle,
      relevantTopics: (isModuleView || hasVisibleWeekHeader) ? undefined : (reading.relevantTopics || undefined)
    };
    let displayTitle = formatDisplayTitleWithChapter(
      readingWithTopic,
      reading.chapterText,
      reading.resourceTitle,
      matchedCourse?.courseName,
      resolvedAuthor
    );
    // If displayTitle still ends with a redundant repetition of the week theme, strip it
    if (hasVisibleWeekHeader && displayTitle.includes(' · ')) {
      const parts = displayTitle.split(' · ');
      const suffix = parts[parts.length - 1].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const themeClean = (cleanWeekTheme || weekTheme || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (suffix.length >= 4 && (themeClean.includes(suffix) || suffix.includes(themeClean))) {
        displayTitle = parts.slice(0, -1).join(' · ').trim();
      }
    }
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
        <View style={[styles.readingCard, reading.isCompleted && styles.readingCardCompleted]}>
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
              {(reading.isRequired === false || reading.requirementType === 'optional') && (
                <View style={styles.optionalPill}>
                  <Text style={styles.optionalPillText}>OPTIONAL</Text>
                </View>
              )}
              {((reading.weekNumber && [5, 7, 8].includes(reading.weekNumber) && (reading.title || '').includes('4–10')) || (reading.relevantTopics && /presentation/i.test(reading.relevantTopics))) && (
                <View style={styles.presentationRefBadge}>
                  <Text style={styles.presentationRefBadgeText}>Presentation Reference</Text>
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

            {/* Subtitle & Suggested Reading: Author · Pages · Suggested Date */}
            {(() => {
              const cleanSub = (displaySubtitle || '').replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();

              const cleanDate = suggestedReadingText
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

          {/* Right-side Action Buttons: Checkmark Ring & Trashcan OR Restore Pill */}
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
            </View>
          ) : (
            <View style={styles.cardRightActions}>
              <TouchableOpacity
                style={styles.touchCircleContainer}
                onPress={() => handleToggleReading(reading.id)}
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
        <View style={styles.headerLeftMonthWrap}>
          <Text
            style={styles.headerMonthText}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.85}
            testID="readings-header-month"
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
        startWeekNumber={firstReadingWeek || 1}
        termStartDate={termStartDate}
        currentAcademicWeek={currentAcademicWeek}
        hideCurrentWeekToggle={groupingViewMode === 'modules'}
        showCardMonth={false}
        onMonthYearChange={setCalendarMonthYear}
      />

      {/* MARK: - Single Course Reading Loading / Progress Section */}
      {activeCourse && (() => {
        const courseReadings = deduplicatedRawReadings.filter(
          r => !r.isDeleted && isItemForCourse(r, activeCourse)
        );
        const total = courseReadings.length;
        const completed = courseReadings.filter(r => r.isCompleted).length;
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
            {dateFilteredReadings.map(r => renderReadingCard(r, null))}
          </View>
        </View>
      )}

      {/* Segmented Switcher between Weeks and Modules (when course has modules) */}
      {hasDistinctModules && (
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
              Weeks ({groupedWeeks.length})
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

      {/* MARK: - Coursework List (Readings Only) */}
      {(groupingViewMode === 'modules' ? groupedModules.length === 0 : (groupedWeeks.length === 0 && unassignedReadings.length === 0)) ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>
            {selectedWeekFilter !== null
              ? `No Readings in Week ${selectedWeekFilter}`
              : selectedCourseFilter
              ? `No Readings in ${selectedCourseFilter.courseCode || selectedCourseFilter.courseName}`
              : 'No Readings Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {selectedWeekFilter !== null
              ? `There are no readings assigned to Week ${selectedWeekFilter}.`
              : selectedCourseFilter
              ? 'No readings were found in this syllabus document.'
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
          {isDateFilterActive && (
            <View style={styles.allSectionHeader}>
              <Text style={styles.allSectionTitle}>All Weeks</Text>
            </View>
          )}

          {/* Non-week readings (when week toggle is turned off) */}
          {unassignedReadings.length > 0 && (() => {
            const incompleteUnassigned = unassignedReadings.filter(r => !r.isCompleted);
            if (incompleteUnassigned.length === 0) return null;

            const renderUnassignedCard = (r: Reading) => {
              let fallbackDate: string | null = null;
              const wk = r.weekNumber || (r.weekId && /\d+/.test(r.weekId) ? parseInt(r.weekId.match(/\d+/)![0], 10) : null);
              if (wk) {
                const matchedCourse = matchCourseForItem(r, courses);
                const w = matchedCourse?.weeks?.find(wItem => wItem.weekNumber === wk);
                if (w?.dateRangeStr && isRealDateOrRangeString(w.dateRangeStr)) {
                  fallbackDate = w.dateRangeStr;
                } else if (w?.startDate) {
                  fallbackDate = w.startDate instanceof Date ? w.startDate.toISOString().split('T')[0] : String(w.startDate);
                }
              }
              return renderReadingCard(r, fallbackDate);
            };

            return (
              <View style={styles.unassignedGroupSection}>
                {incompleteUnassigned.map(renderUnassignedCard)}
              </View>
            );
          })()}

          {/* Week-grouped readings (when in Weekly Schedule view) */}
          {groupingViewMode === 'weeks' && groupedWeeks.map(({ weekNum, readings: weekReadingsList }) => {
            const incompleteReadings = weekReadingsList.filter(r => !r.isCompleted);
            if (incompleteReadings.length === 0 && selectedWeekFilter === null) {
              return null;
            }

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

            const targetCourse = selectedCourseFilter || (weekReadingsList[0] ? matchCourseForItem(weekReadingsList[0], courses) : undefined) || courses.find(c => c.weeks?.some(wk => wk.weekNumber === weekNum)) || courses[0];

            if (targetCourse) {
              const w = targetCourse.weeks?.find(wk => wk.weekNumber === weekNum);
              if (w?.dateRangeStr && isRealDateOrRangeString(w.dateRangeStr)) {
                weekDateStr = w.dateRangeStr;
              } else if (!weekDateStr && w?.startDate) {
                weekDateStr = w.startDate instanceof Date ? w.startDate.toISOString().split('T')[0] : String(w.startDate);
              }
            }

            const rawWeekTheme = targetCourse?.weeks?.find(wk => wk.weekNumber === weekNum)?.theme ||
              weekReadingsList.find(r => r.relevantTopics && !r.relevantTopics.toLowerCase().startsWith('week '))?.relevantTopics;
            let cleanWeekTheme = cleanAcademicWeekTheme(rawWeekTheme);
            if (!cleanWeekTheme) {
              for (const r of weekReadingsList) {
                if (r.relevantTopics) {
                  const candidate = cleanAcademicWeekTheme(r.relevantTopics);
                  if (candidate) {
                    cleanWeekTheme = candidate;
                    break;
                  }
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

                {/* Week Topic / Focus Theme */}
                {cleanWeekTheme ? (
                  <View style={styles.weekThemeHeaderRow}>
                    <Text style={styles.weekThemeHeaderText} numberOfLines={2}>
                      {cleanWeekTheme}
                    </Text>
                  </View>
                ) : null}

                {/* Readings for this Week (Incomplete Only) */}
                {(() => {
                  if (weekReadingsList.length === 0) {
                    return (
                      <View style={styles.emptyWeekContainer}>
                        <Text style={styles.emptyWeekThemeText}>
                          {cleanWeekTheme || 'No required readings assigned'}
                        </Text>
                      </View>
                    );
                  }

                  if (incompleteReadings.length === 0) {
                    return null;
                  }

                  const requiredIncomplete = incompleteReadings.filter(
                    r => r.isRequired !== false && r.requirementType !== 'optional'
                  );
                  const optionalIncomplete = incompleteReadings.filter(
                    r => r.isRequired === false || r.requirementType === 'optional'
                  );

                  return (
                    <View style={styles.weekReadingsContentWrapper}>
                      {optionalIncomplete.length > 0 ? (
                        <View style={styles.requirementSectionsWrapper}>
                          {requiredIncomplete.length > 0 && (
                            <View style={styles.requirementSectionBlock}>
                              <View style={styles.requirementSectionSubheader}>
                                <Text style={styles.requirementSectionSubheaderText}>REQUIRED READINGS</Text>
                                <View style={styles.requirementCountPill}>
                                  <Text style={styles.requirementCountPillText}>{requiredIncomplete.length}</Text>
                                </View>
                              </View>
                              {requiredIncomplete.map(r => renderReadingCard(r, weekDateStr))}
                            </View>
                          )}

                          {optionalIncomplete.length > 0 && (
                            <View style={[styles.requirementSectionBlock, requiredIncomplete.length > 0 && styles.requirementSectionBlockSpaced]}>
                              <View style={styles.requirementSectionSubheader}>
                                <Text style={[styles.requirementSectionSubheaderText, styles.requirementSectionSubheaderTextOptional]}>
                                  OPTIONAL READINGS
                                </Text>
                                <View style={[styles.requirementCountPill, styles.requirementCountPillOptional]}>
                                  <Text style={[styles.requirementCountPillText, styles.requirementCountPillTextOptional]}>
                                    {optionalIncomplete.length}
                                  </Text>
                                </View>
                              </View>
                              {optionalIncomplete.map(r => renderReadingCard(r, weekDateStr))}
                            </View>
                          )}
                        </View>
                      ) : (
                        incompleteReadings.map(r => renderReadingCard(r, weekDateStr))
                      )}
                    </View>
                  );
                })()}
              </View>
            );
          })}

          {/* Module-grouped readings (when in Course Modules view) */}
          {groupingViewMode === 'modules' && groupedModules.map(({ moduleNum, theme: modTheme, readings: moduleReadingsList }) => {
            const incompleteMod = moduleReadingsList.filter(r => !r.isCompleted);
            if (incompleteMod.length === 0 && selectedWeekFilter === null && moduleReadingsList.length > 0) {
              return null;
            }

            let cleanModTheme = cleanAcademicWeekTheme(modTheme);

            return (
              <View key={`module-${moduleNum}`} style={styles.weekGroupSection}>
                {/* Module Header Row */}
                <View style={styles.weekHeaderRow}>
                  <View style={styles.weekPill}>
                    <Text style={styles.weekPillText}>Module {moduleNum}</Text>
                  </View>
                </View>

                {/* Module Topic / Focus Theme */}
                {cleanModTheme ? (
                  <View style={styles.weekThemeHeaderRow}>
                    <Text style={styles.weekThemeHeaderText} numberOfLines={2}>
                      {cleanModTheme}
                    </Text>
                  </View>
                ) : null}

                {/* Readings for this Module */}
                {(() => {
                  if (moduleReadingsList.length === 0) {
                    return (
                      <View style={styles.emptyWeekContainer}>
                        <Text style={styles.emptyWeekThemeText}>
                          {cleanModTheme || 'No required readings assigned'}
                        </Text>
                      </View>
                    );
                  }

                  if (incompleteMod.length === 0) {
                    return null;
                  }

                  const requiredIncomplete = incompleteMod.filter(
                    r => r.isRequired !== false && r.requirementType !== 'optional'
                  );
                  const optionalIncomplete = incompleteMod.filter(
                    r => r.isRequired === false || r.requirementType === 'optional'
                  );

                  return (
                    <View style={styles.weekReadingsContentWrapper}>
                      {optionalIncomplete.length > 0 ? (
                        <View style={styles.requirementSectionsWrapper}>
                          {requiredIncomplete.length > 0 && (
                            <View style={styles.requirementSectionBlock}>
                              <View style={styles.requirementSectionSubheader}>
                                <Text style={styles.requirementSectionSubheaderText}>REQUIRED READINGS</Text>
                                <View style={styles.requirementCountPill}>
                                  <Text style={styles.requirementCountPillText}>{requiredIncomplete.length}</Text>
                                </View>
                              </View>
                              {requiredIncomplete.map(r => renderReadingCard(r, null, true))}
                            </View>
                          )}

                          {optionalIncomplete.length > 0 && (
                            <View style={[styles.requirementSectionBlock, requiredIncomplete.length > 0 && styles.requirementSectionBlockSpaced]}>
                              <View style={styles.requirementSectionSubheader}>
                                <Text style={[styles.requirementSectionSubheaderText, styles.requirementSectionSubheaderTextOptional]}>
                                  OPTIONAL READINGS
                                </Text>
                                <View style={[styles.requirementCountPill, styles.requirementCountPillOptional]}>
                                  <Text style={[styles.requirementCountPillText, styles.requirementCountPillTextOptional]}>
                                    {optionalIncomplete.length}
                                  </Text>
                                </View>
                              </View>
                              {optionalIncomplete.map(r => renderReadingCard(r, null, true))}
                            </View>
                          )}
                        </View>
                      ) : (
                        incompleteMod.map(r => renderReadingCard(r, null, true))
                      )}
                    </View>
                  );
                })()}
              </View>
            );
          })}

          {/* MARK: - Consolidated Done Section at Bottom */}
          {allCompletedInView.length > 0 && (
            <View style={styles.bottomDoneContainer}>
              <View style={styles.doneSectionDivider}>
                <View style={styles.donePill}>
                  <CheckmarkCircleFillIcon size={12} color="#64748B" />
                  <Text style={styles.donePillText}>Done</Text>
                </View>
              </View>
              <View style={styles.doneCardsList}>
                {allCompletedInView.map(r => {
                  let fallbackDate: string | null = null;
                  const wk = r.weekNumber || (r.weekId && /\d+/.test(r.weekId) ? parseInt(r.weekId.match(/\d+/)![0], 10) : null);
                  if (wk) {
                    const matchedCourse = matchCourseForItem(r, courses);
                    const w = matchedCourse?.weeks?.find(wItem => wItem.weekNumber === wk);
                    if (w?.dateRangeStr && isRealDateOrRangeString(w.dateRangeStr)) {
                      fallbackDate = w.dateRangeStr;
                    } else if (w?.startDate) {
                      fallbackDate = w.startDate instanceof Date ? w.startDate.toISOString().split('T')[0] : String(w.startDate);
                    }
                  }
                  return renderReadingCard(r, fallbackDate, groupingViewMode === 'modules');
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>

    {/* Reading Detail Modal */}
    <ReadingDetailModal
      visible={selectedReadingForDetail != null}
      reading={selectedReadingForDetail}
      courses={courses}
      viewMode={groupingViewMode}
      onClose={() => setSelectedReadingForDetail(null)}
      onSave={updated => {
        updateReading(updated);
        setSelectedReadingForDetail(updated);
      }}
      onToggleComplete={id => handleToggleReading(id)}
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
  weekDatePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8
  },
  weekDatePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  weekThemeHeaderRow: {
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 6
  },
  weekThemeHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18
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
  optionalPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionalPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3
  },
  requirementSectionsWrapper: {
    width: '100%'
  },
  requirementSectionBlock: {
    width: '100%'
  },
  requirementSectionBlockSpaced: {
    marginTop: 14
  },
  requirementSectionSubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6
  },
  requirementSectionSubheaderText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  requirementSectionSubheaderTextOptional: {
    color: '#64748B'
  },
  requirementCountPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  requirementCountPillOptional: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  requirementCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  requirementCountPillTextOptional: {
    color: '#64748B'
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
  presentationRefBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  presentationRefBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.2
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
  assignmentTypeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  assignmentTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.4
  },
  assignmentWeightBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  assignmentWeightBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4F46E5'
  },
  assignmentPtsBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  assignmentPtsBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B'
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
  },
  emptyWeekContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyWeekThemeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    textAlign: 'center'
  },
  weekReadingsContentWrapper: {
    width: '100%',
    gap: 10
  },
  completedReadingsGroup: {
    width: '100%',
    gap: 10
  },
  doneSectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    gap: 5
  },
  donePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3
  },
  bottomDoneContainer: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20
  },
  doneCardsList: {
    width: '100%',
    gap: 10
  },
  readingCardCompleted: {
    opacity: 0.85
  }
});
