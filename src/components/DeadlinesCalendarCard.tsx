import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { ChevronLeftIcon, ChevronRightIcon } from './SvgIcons';
import { weekNumberForDate } from '../utils/timeFormatters';

interface DeadlinesCalendarCardProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  isDateFilterActive: boolean;
  onToggleDateFilter: () => void;
  itemDatesWithColors: Map<string, string[]>; // 'YYYY-MM-DD' -> array of hex colors
  onSelectWeek?: (weekNumber: number) => void;
  selectedWeekFilter?: number | null;
  startWeekNumber?: number; // Defaults to 1 so the section starts at Week 1
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
  startWeekNumber = 1
}) => {
  // Current week start (Sunday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getStartOfWeek(selectedDate));
  const startWeek = startWeekNumber ?? 1;
  const [weekOffset, setWeekOffset] = useState<number>(() => {
    if (selectedWeekFilter != null && selectedWeekFilter >= startWeek) {
      return selectedWeekFilter - startWeek;
    }
    return 0;
  });

  // Re-sync current week if selectedDate changes drastically outside the week
  useEffect(() => {
    const selWeekStart = getStartOfWeek(selectedDate);
    const diffTime = selWeekStart.getTime() - currentWeekStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    if (diffDays < 0 || diffDays >= 7) {
      setCurrentWeekStart(selWeekStart);
    }
  }, [selectedDate]);

  // Sync weekOffset if selectedWeekFilter is passed in (e.g. from parent filter)
  useEffect(() => {
    if (selectedWeekFilter != null && selectedWeekFilter >= startWeek) {
      const targetOffset = selectedWeekFilter - startWeek;
      if (targetOffset !== weekOffset) {
        setWeekOffset(targetOffset);
      }
    }
  }, [selectedWeekFilter, startWeek]);

  // Display week label: starts at Week 1 (or startWeekNumber) and steps with user navigation
  const displayWeekNumber = useMemo(() => {
    return Math.max(1, startWeek + weekOffset);
  }, [startWeek, weekOffset]);

  const prevWeek = () => {
    if (displayWeekNumber <= 1) return;
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
    setWeekOffset(prev => Math.max(0, prev - 1));
  };

  const nextWeek = () => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
    setWeekOffset(prev => prev + 1);
  };

  // Month & Year string based on Thursday of the current week
  const monthYearString = useMemo(() => {
    const midWeek = new Date(currentWeekStart);
    midWeek.setDate(midWeek.getDate() + 3);
    return midWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentWeekStart]);

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

  // Formatted week date range, e.g. "Sep 13 – Sep 19"
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
          <Text style={styles.weekRangeSubtitleText}>
            Week {displayWeekNumber} · {weekRangeString}
          </Text>
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

      {/* Split Row: Left Week Badge ("Week X") + Right Horizontal 7-Day Row */}
      <View style={styles.splitRow}>
        {/* Left Hero Week Box */}
        <TouchableOpacity
          style={[
            styles.leftHeroContainer,
            isWeekSelected && styles.leftHeroContainerActive
          ]}
          onPress={() => {
            if (onSelectWeek) {
              onSelectWeek(displayWeekNumber);
            } else {
              onToggleDateFilter();
            }
          }}
          activeOpacity={0.8}
          testID="cal-hero-date-button"
        >
          <Text style={[styles.heroWeekLabel, isWeekSelected && styles.heroWeekLabelActive]}>
            Week
          </Text>
          <Text
            style={[
              styles.heroWeekNumber,
              (isDateFilterActive || isWeekSelected) && styles.heroWeekNumberActive
            ]}
          >
            {displayWeekNumber}
          </Text>
        </TouchableOpacity>

        {/* Vertical Divider */}
        <View style={styles.verticalDivider} />

        {/* Right Horizontal 7-Day Week Strip */}
        <View style={styles.rightDaysContainer}>
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
    </View>
  );
};

const styles = StyleSheet.create({
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
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  leftHeroContainer: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 2
  },
  leftHeroContainerActive: {
    backgroundColor: '#EEF4FF'
  },
  heroWeekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#596B85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1
  },
  heroWeekLabelActive: {
    color: CoursePalTheme.accentBlue
  },
  heroWeekNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue,
    lineHeight: 38
  },
  heroWeekNumberActive: {
    color: CoursePalTheme.accentBlue
  },
  verticalDivider: {
    width: 1,
    height: 52,
    backgroundColor: '#E3E8F0',
    marginHorizontal: 10
  },
  rightDaysContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
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

