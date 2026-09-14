import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from './SvgIcons';

export interface AssignmentsMonthCalendarCardProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  isDateFilterActive: boolean;
  onToggleDateFilter: () => void;
  itemDatesWithColors: Map<string, string[]>; // 'YYYY-MM-DD' -> array of hex colors
}

const WEEKDAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const AssignmentsMonthCalendarCard: React.FC<AssignmentsMonthCalendarCardProps> = ({
  selectedDate,
  onSelectDate,
  isDateFilterActive,
  onToggleDateFilter,
  itemDatesWithColors
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date(selectedDate.getTime()));

  // Keep viewDate in sync when selectedDate changes outside the current view month
  useEffect(() => {
    if (
      selectedDate.getFullYear() !== viewDate.getFullYear() ||
      selectedDate.getMonth() !== viewDate.getMonth()
    ) {
      setViewDate(new Date(selectedDate.getTime()));
    }
  }, [selectedDate]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

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

  // Compute grid days
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const gridCells: (number | null)[] = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [firstDayOfWeek, daysInMonth]);

  // Chunk cells into rows of 7
  const calendarRows: (number | null)[][] = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < gridCells.length; i += 7) {
      rows.push(gridCells.slice(i, i + 7));
    }
    return rows;
  }, [gridCells]);

  const today = new Date();

  return (
    <View style={styles.cardContainer} testID="assignments-month-calendar-card">
      {/* Header: Month Year & Navigation Controls */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handlePrevMonth}
          style={styles.navButton}
          activeOpacity={0.7}
          testID="month-cal-prev"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeftIcon size={14} color="#596B85" />
        </TouchableOpacity>

        <View style={styles.titleCenterWrap}>
          <Text style={styles.monthTitleText}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          {isDateFilterActive && (
            <TouchableOpacity
              style={styles.filterActiveBadge}
              onPress={onToggleDateFilter}
              activeOpacity={0.7}
            >
              <Text style={styles.filterActiveBadgeText}>Filtered</Text>
              <XMarkIcon size={10} color={CoursePalTheme.accentBlue} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={handleNextMonth}
          style={styles.navButton}
          activeOpacity={0.7}
          testID="month-cal-next"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronRightIcon size={14} color="#596B85" />
        </TouchableOpacity>
      </View>

      {/* Weekday Column Headers */}
      <View style={styles.weekdaysRow}>
        {WEEKDAY_NAMES.map((name, idx) => (
          <View key={`weekday-${idx}`} style={styles.weekdayCol}>
            <Text style={styles.weekdayLabel}>{name}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Rows Grid */}
      <View style={styles.gridContainer}>
        {calendarRows.map((row, rowIdx) => (
          <View key={`cal-row-${rowIdx}`} style={styles.gridRow}>
            {row.map((dayNum, colIdx) => {
              if (dayNum === null) {
                return <View key={`cell-empty-${rowIdx}-${colIdx}`} style={styles.dayCol} />;
              }

              const cellDate = new Date(viewYear, viewMonth, dayNum);
              const isSelected = isDateFilterActive && isSameDay(cellDate, selectedDate);
              const isCellToday = isSameDay(cellDate, today);
              const dateKey = formatDateKey(cellDate);
              const colors = itemDatesWithColors.get(dateKey) || [];

              return (
                <TouchableOpacity
                  key={`cell-day-${dayNum}`}
                  style={styles.dayCol}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isSelected) {
                      onToggleDateFilter();
                    } else {
                      onSelectDate(cellDate);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleSelected,
                      !isSelected && isCellToday && styles.dayCircleToday
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        isSelected && styles.dayNumberTextSelected,
                        !isSelected && isCellToday && styles.dayNumberTextToday
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </View>

                  {/* Course Color Dots (up to 3) */}
                  <View style={styles.dotRow}>
                    {colors.length > 0 ? (
                      colors.slice(0, 3).map((c, cIdx) => (
                        <View
                          key={`dot-${dayNum}-${cIdx}`}
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
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  titleCenterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  monthTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.2
  },
  filterActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10
  },
  filterActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  navButton: {
    padding: 6
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekdayLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#8E9BAE'
  },
  gridContainer: {
    gap: 2
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayCircleSelected: {
    backgroundColor: CoursePalTheme.accentBlue
  },
  dayCircleToday: {
    backgroundColor: 'rgba(36, 112, 245, 0.12)'
  },
  dayNumberText: {
    fontSize: 13,
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
    height: 6,
    marginTop: 2,
    gap: 2
  },
  colorDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25
  },
  emptyDotSpacer: {
    width: 4.5,
    height: 4.5
  }
});
