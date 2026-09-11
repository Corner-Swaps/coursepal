/**
 * InlineCalendarPicker
 * Apple-style interactive calendar date picker with month navigation,
 * day grid, and quick date selection presets.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { ChevronLeftIcon, ChevronRightIcon } from './SvgIcons';

interface InlineCalendarPickerProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  accentColor?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const InlineCalendarPicker: React.FC<InlineCalendarPickerProps> = ({
  selectedDate,
  onSelectDate,
  accentColor = CoursePalTheme.accentBlue
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date(selectedDate.getTime()));

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Compute days in month and starting day offset
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const today = new Date();
  const isSelected = (day: number) => {
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day: number) => {
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  const handleDayPress = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day, 23, 59, 0);
    onSelectDate(newDate);
  };

  // Quick select presets
  const handleSelectToday = () => {
    const d = new Date();
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    onSelectDate(d);
  };

  const handleSelectNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    onSelectDate(d);
  };

  // Construct calendar grid cells
  const gridCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    gridCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push(d);
  }
  // Pad trailing days to complete full weeks of 7
  while (gridCells.length % 7 !== 0) {
    gridCells.push(null);
  }

  // Chunk into 7-day rows
  const calendarRows: (number | null)[][] = [];
  for (let i = 0; i < gridCells.length; i += 7) {
    calendarRows.push(gridCells.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      {/* Month & Year Navigation Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.navArrowButton}
          onPress={handlePrevMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <ChevronLeftIcon size={16} color="#596B85" />
        </TouchableOpacity>

        <Text style={styles.monthYearTitle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>

        <TouchableOpacity
          style={styles.navArrowButton}
          onPress={handleNextMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <ChevronRightIcon size={16} color="#596B85" />
        </TouchableOpacity>
      </View>

      {/* Weekday Header Row */}
      <View style={styles.weekdayRow}>
        {DAYS_OF_WEEK.map((dayName, idx) => (
          <View key={`day-${idx}`} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{dayName}</Text>
          </View>
        ))}
      </View>

      {/* Days Grid: Chunked by 7-day Rows */}
      <View style={styles.daysGrid}>
        {calendarRows.map((row, rowIdx) => (
          <View key={`cal-row-${rowIdx}`} style={styles.calendarRow}>
            {row.map((dayNum, colIdx) => {
              const cellKey = `cell-${rowIdx}-${colIdx}`;
              if (dayNum === null) {
                return <View key={cellKey} style={styles.dayCell} />;
              }

              const selected = isSelected(dayNum);
              const currentDay = isToday(dayNum);

              return (
                <TouchableOpacity
                  key={cellKey}
                  style={[
                    styles.dayCell,
                    selected && [styles.dayCellSelected, { backgroundColor: accentColor }]
                  ]}
                  onPress={() => handleDayPress(dayNum)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      currentDay && styles.dayTextToday,
                      selected && styles.dayTextSelected
                    ]}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Quick Presets Row */}
      <View style={styles.presetsRow}>
        <TouchableOpacity
          style={styles.presetButton}
          onPress={handleSelectToday}
          activeOpacity={0.7}
        >
          <Text style={styles.presetButtonText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.presetButton}
          onPress={handleSelectNextWeek}
          activeOpacity={0.7}
        >
          <Text style={styles.presetButtonText}>+1 Week</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  monthYearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#121C33'
  },
  navArrowButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    textTransform: 'uppercase'
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
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20
  },
  dayCellSelected: {
    borderRadius: 20
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#121C33'
  },
  dayTextToday: {
    fontWeight: '800',
    color: CoursePalTheme.accentBlue
  },
  dayTextSelected: {
    fontWeight: '700',
    color: '#FFFFFF'
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 8
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  }
});
