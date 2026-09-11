import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { ChevronLeftIcon, ChevronRightIcon } from './SvgIcons';

interface DeadlinesCalendarCardProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  isDateFilterActive: boolean;
  onToggleDateFilter: () => void;
  itemDatesWithColors: Map<string, string[]>; // 'YYYY-MM-DD' -> array of hex colors
}

export const DeadlinesCalendarCard: React.FC<DeadlinesCalendarCardProps> = ({
  selectedDate,
  onSelectDate,
  isDateFilterActive,
  onToggleDateFilter,
  itemDatesWithColors
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const prevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };

  const monthYearString = useMemo(() => {
    return currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonthDate]);

  const selectedDayName = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  }, [selectedDate]);

  const selectedDayNumber = selectedDate.getDate();

  // Generate 7-column calendar grid rows for currentMonthDate
  const calendarRows = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [currentMonthDate]);

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

  return (
    <View style={styles.cardContainer} testID="deadlines-calendar-card">
      {/* Month Nav Header (< Month Year >) */}
      <View style={styles.monthHeader}>
        <TouchableOpacity
          onPress={prevMonth}
          style={styles.navButton}
          activeOpacity={0.7}
          testID="cal-prev-month"
        >
          <ChevronLeftIcon size={14} color="#596B85" />
        </TouchableOpacity>

        <Text style={styles.monthTitleText}>{monthYearString}</Text>

        <TouchableOpacity
          onPress={nextMonth}
          style={styles.navButton}
          activeOpacity={0.7}
          testID="cal-next-month"
        >
          <ChevronRightIcon size={14} color="#596B85" />
        </TouchableOpacity>
      </View>

      {/* Split Row: Left Hero Date + Right Mini Month Grid */}
      <View style={styles.splitRow}>
        {/* Left Hero Date */}
        <TouchableOpacity
          style={styles.leftHeroContainer}
          onPress={onToggleDateFilter}
          activeOpacity={0.8}
          testID="cal-hero-date-button"
        >
          <Text style={styles.heroDayName}>{selectedDayName}</Text>
          <Text
            style={[
              styles.heroDayNumber,
              isDateFilterActive && styles.heroDayNumberActive
            ]}
          >
            {selectedDayNumber}
          </Text>
        </TouchableOpacity>

        {/* Vertical Divider */}
        <View style={styles.verticalDivider} />

        {/* Right Mini Month Grid */}
        <View style={styles.rightGridContainer}>
          {/* Weekday Headers */}
          <View style={styles.weekdayHeaderRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <Text key={`weekday-${idx}`} style={styles.weekdayLabel}>
                {day}
              </Text>
            ))}
          </View>

          {/* Day Grid: Structured 7-Day Rows */}
          <View style={styles.daysGrid}>
            {calendarRows.map((row, rowIdx) => (
              <View key={`cal-row-${rowIdx}`} style={styles.calendarRow}>
                {row.map((dateObj, colIdx) => {
                  const cellKey = `cell-${rowIdx}-${colIdx}`;
                  if (!dateObj) {
                    return <View key={cellKey} style={styles.dayCell} />;
                  }

                  const isSelected = isDateFilterActive && isSameDay(dateObj, selectedDate);
                  const dateKey = formatDateKey(dateObj);
                  const colors = itemDatesWithColors.get(dateKey) || [];

                  return (
                    <TouchableOpacity
                      key={cellKey}
                      style={styles.dayCell}
                      activeOpacity={0.7}
                      onPress={() => {
                        onSelectDate(dateObj);
                      }}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isSelected && styles.dayCircleSelected
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            isSelected && styles.dayNumberTextSelected
                          ]}
                        >
                          {dateObj.getDate()}
                        </Text>
                      </View>

                      {/* Dot Indicators */}
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
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
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
    marginBottom: 12
  },
  navButton: {
    padding: 6
  },
  monthTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.2
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  leftHeroContainer: {
    width: 86,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroDayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#596B85',
    marginBottom: 2
  },
  heroDayNumber: {
    fontSize: 50,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue,
    lineHeight: 56
  },
  heroDayNumberActive: {
    color: CoursePalTheme.accentBlue
  },
  verticalDivider: {
    width: 1,
    height: 140,
    backgroundColor: '#E3E8F0',
    marginHorizontal: 12
  },
  rightGridContainer: {
    flex: 1
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#596B85'
  },
  daysGrid: {
    width: '100%'
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 2
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
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
  dayNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#141F38'
  },
  dayNumberTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 6,
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
