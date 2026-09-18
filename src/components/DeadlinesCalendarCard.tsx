import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { ChevronLeftIcon, ChevronRightIcon } from './SvgIcons';
import { weekNumberForDate, getBaseTermStartDate } from '../utils/timeFormatters';

interface DeadlinesCalendarCardProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  isDateFilterActive: boolean;
  onToggleDateFilter: () => void;
  itemDatesWithColors: Map<string, string[]>; // 'YYYY-MM-DD' -> array of hex colors
  onSelectWeek?: (weekNumber: number) => void;
  selectedWeekFilter?: number | null;
  startWeekNumber?: number; // Defaults to 1 so the section starts at Week 1
  termStartDate?: Date | null;
  currentAcademicWeek?: number;
}

// Helper: Get Sunday of the week for a given date
function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() - day);
  return d;
}

export const DeadlinesCalendarCard: React.FC<DeadlinesCalendarCardProps> = ({
  selectedDate,
  onSelectDate,
  isDateFilterActive,
  onToggleDateFilter,
  itemDatesWithColors,
  onSelectWeek,
  selectedWeekFilter,
  startWeekNumber = 1,
  termStartDate,
  currentAcademicWeek
}) => {
  // Base term start (Sunday)
  const baseTermStartSunday = useMemo(() => {
    if (termStartDate) {
      return getStartOfWeek(termStartDate);
    }
    return getStartOfWeek(getBaseTermStartDate(selectedDate));
  }, [termStartDate, selectedDate]);

  // Current week start (Sunday) - initialize to selectedWeekFilter if provided, else selectedDate
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (selectedWeekFilter != null && selectedWeekFilter >= 1) {
      const base = termStartDate ? getStartOfWeek(termStartDate) : getStartOfWeek(getBaseTermStartDate(selectedDate));
      const target = new Date(base);
      target.setDate(target.getDate() + (selectedWeekFilter - 1) * 7);
      return target;
    }
    return getStartOfWeek(selectedDate);
  });

  // Re-sync current week if selectedDate changes drastically outside the week while date filter is active
  useEffect(() => {
    if (isDateFilterActive) {
      const selWeekStart = getStartOfWeek(selectedDate);
      const diffTime = selWeekStart.getTime() - currentWeekStart.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      if (diffDays < 0 || diffDays >= 7) {
        setCurrentWeekStart(selWeekStart);
      }
    }
  }, [selectedDate, isDateFilterActive]);

  // Sync currentWeekStart if selectedWeekFilter is passed in
  useEffect(() => {
    if (selectedWeekFilter != null && selectedWeekFilter >= 1) {
      const targetDate = new Date(baseTermStartSunday);
      targetDate.setDate(targetDate.getDate() + (selectedWeekFilter - 1) * 7);
      setCurrentWeekStart(targetDate);
    }
  }, [selectedWeekFilter, baseTermStartSunday]);

  // Derive week number directly from currentWeekStart relative to baseTermStartSunday
  const displayWeekNumber = useMemo(() => {
    const diffMs = currentWeekStart.getTime() - baseTermStartSunday.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 86400000));
    const raw = diffWeeks + 1;
    if (raw >= 1 && raw <= 16) {
      return raw;
    }
    return weekNumberForDate(currentWeekStart);
  }, [currentWeekStart, baseTermStartSunday]);

  const targetCurrentWeekNum = currentAcademicWeek != null ? currentAcademicWeek : 1;
  const isCurrentWeekActive = useMemo(() => {
    if (selectedWeekFilter != null) {
      return selectedWeekFilter === targetCurrentWeekNum;
    }
    if (isDateFilterActive) {
      return (
        selectedDate.getFullYear() === new Date().getFullYear() &&
        selectedDate.getMonth() === new Date().getMonth() &&
        selectedDate.getDate() === new Date().getDate()
      );
    }
    return false;
  }, [selectedWeekFilter, targetCurrentWeekNum, isDateFilterActive, selectedDate]);

  const handleToggleCurrentWeek = () => {
    if (isCurrentWeekActive) {
      if (onSelectWeek) {
        onSelectWeek(0);
      }
      if (isDateFilterActive) {
        onToggleDateFilter();
      }
    } else {
      const today = new Date();
      const todaySunday = getStartOfWeek(today);
      setCurrentWeekStart(todaySunday);
      if (onSelectWeek) {
        onSelectWeek(targetCurrentWeekNum);
      } else {
        onSelectDate(today);
      }
    }
  };

  const prevWeek = () => {
    if (displayWeekNumber <= 1) return;
    const newWeek = displayWeekNumber - 1;
    if (newWeek === 1) {
      setCurrentWeekStart(new Date(baseTermStartSunday));
    } else {
      setCurrentWeekStart(prev => {
        const next = new Date(prev);
        next.setDate(next.getDate() - 7);
        return next;
      });
    }
    if (onSelectWeek) {
      onSelectWeek(newWeek);
    }
  };

  const nextWeek = () => {
    const newWeek = displayWeekNumber + 1;
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
    if (onSelectWeek) {
      onSelectWeek(newWeek);
    }
  };

  // Days in this week: Sunday through Saturday (7 days)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  // Accurate month & year string: ensures Week 1 correctly displays the starting month
  const monthYearString = useMemo(() => {
    if (weekDays.length < 7) {
      return currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const start = weekDays[0];
    const end = weekDays[6];
    const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startMonth === endMonth && startYear === endYear) {
      return `${startMonth} ${startYear}`;
    }
    if (startYear === endYear) {
      return `${startMonth} – ${endMonth} ${startYear}`;
    }
    return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  }, [weekDays, currentWeekStart]);

  // Formatted week date range, e.g. "Sep 13 – Sep 19" or "Aug 30 – Sep 5"
  const weekRangeString = useMemo(() => {
    if (weekDays.length < 7) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    const startM = start.toLocaleDateString('en-US', { month: 'short' });
    const endM = end.toLocaleDateString('en-US', { month: 'short' });
    if (startM === endM) {
      return `${startM} ${start.getDate()} – ${end.getDate()}`;
    }
    return `${startM} ${start.getDate()} – ${endM} ${end.getDate()}`;
  }, [weekDays]);

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const weekdayShortNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const isWeekSelected = selectedWeekFilter === displayWeekNumber;

  return (
    <View style={styles.outerWrapper}>
      {/* Calendar 7-Day Card */}
      <View style={styles.cardContainer} testID="deadlines-calendar-card">
        {/* Month Nav Header (< Month Year >) */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={prevWeek}
            style={[styles.navButton, displayWeekNumber <= 1 && styles.navButtonDisabled]}
            activeOpacity={0.7}
            disabled={displayWeekNumber <= 1}
            testID="cal-prev-month"
          >
            <ChevronLeftIcon size={14} color={displayWeekNumber <= 1 ? '#BAC4D4' : '#596B85'} />
          </TouchableOpacity>

          <View style={styles.monthTitleCenter}>
            <Text style={styles.monthTitleText}>{monthYearString}</Text>
            <Text style={styles.weekRangeSubtitleText}>{weekRangeString}</Text>
          </View>

          <TouchableOpacity
            onPress={nextWeek}
            style={styles.navButton}
            activeOpacity={0.7}
            testID="cal-next-month"
          >
            <ChevronRightIcon size={14} color="#596B85" />
          </TouchableOpacity>
        </View>

        {/* Horizontal 7-Day Week Strip */}
        <View style={styles.daysContainer}>
          {weekDays.map((dateObj, idx) => {
            const isSelected = isDateFilterActive && isSameDay(dateObj, selectedDate);
            const dateKey = formatDateKey(dateObj);
            const colors = itemDatesWithColors.get(dateKey) || [];
            const isToday = isSameDay(dateObj, new Date());

            return (
              <TouchableOpacity
                key={`day-${idx}`}
                style={styles.dayCol}
                activeOpacity={0.7}
                onPress={() => onSelectDate(dateObj)}
              >
                {/* Weekday Label */}
                <Text style={[styles.weekdayLabel, isToday && styles.weekdayLabelToday]}>
                  {weekdayShortNames[idx]}
                </Text>

                {/* Day Circle */}
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    !isSelected && isToday && styles.dayCircleToday
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumberText,
                      isSelected && styles.dayNumberTextSelected,
                      !isSelected && isToday && styles.dayNumberTextToday
                    ]}
                  >
                    {dateObj.getDate()}
                  </Text>
                </View>

                {/* Color Dot Indicators */}
                <View style={styles.dotRow}>
                  {colors.length > 0 ? (
                    colors.slice(0, 3).map((c, cIdx) => (
                      <View
                        key={`dot-${cIdx}`}
                        style={[styles.colorDot, { backgroundColor: c }]}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyDotSpacer} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Standalone Current Week Pill Card - Styled like the course percentage capsule */}
      <View style={styles.currentWeekCardContainer}>
        <TouchableOpacity
          style={styles.currentWeekCardRow}
          onPress={handleToggleCurrentWeek}
          activeOpacity={0.7}
          testID="cal-current-week-toggle"
        >
          <View style={styles.currentWeekLeftWrap}>
            <View style={[styles.statusDot, isCurrentWeekActive && styles.statusDotActive]} />
            <View style={[styles.currentWeekPill, isCurrentWeekActive && styles.currentWeekPillActive]}>
              <Text style={[styles.currentWeekPillText, isCurrentWeekActive && styles.currentWeekPillTextActive]}>
                Current week{currentAcademicWeek != null ? ` · Wk ${currentAcademicWeek}` : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.toggleTrack, isCurrentWeekActive && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, isCurrentWeekActive && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    gap: 10
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  navButton: {
    padding: 6
  },
  navButtonDisabled: {
    opacity: 0.35
  },
  monthTitleCenter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  monthTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.2
  },
  weekRangeSubtitleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#718096',
    marginTop: 2
  },
  daysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  currentWeekCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  currentWeekCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  currentWeekLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BAC4D4'
  },
  statusDotActive: {
    backgroundColor: CoursePalTheme.accentBlue
  },
  currentWeekPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  currentWeekPillActive: {
    backgroundColor: 'rgba(36, 112, 245, 0.10)'
  },
  currentWeekPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: -0.1
  },
  currentWeekPillTextActive: {
    color: CoursePalTheme.accentBlue
  },
  toggleTrack: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D1D9E4',
    padding: 2,
    justifyContent: 'center'
  },
  toggleTrackActive: {
    backgroundColor: CoursePalTheme.accentBlue
  },
  toggleThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start'
  },
  toggleThumbActive: {
    alignSelf: 'flex-end'
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A99AD'
  },
  weekdayLabelToday: {
    color: CoursePalTheme.accentBlue
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  dayCircleSelected: {
    backgroundColor: CoursePalTheme.accentBlue
  },
  dayCircleToday: {
    backgroundColor: 'rgba(36, 112, 245, 0.12)'
  },
  dayNumberText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#141F38'
  },
  dayNumberTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  dayNumberTextToday: {
    color: CoursePalTheme.accentBlue,
    fontWeight: '700'
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 5,
    marginTop: 1
  },
  colorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1
  },
  emptyDotSpacer: {
    height: 4
  }
});

