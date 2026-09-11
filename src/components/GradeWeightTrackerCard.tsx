/**
 * GradeWeightTrackerCard
 * 1:1 Parity with native Swift GradeWeightTrackerView.swift
 * Real-time academic deliverables weight breakdown, completed grade tracking,
 * and target course grade calculation slider.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Course, Assignment } from '../types/models';
import { CoursePalTheme } from '../constants/theme';
import { computeGradeWeights, calculateTargetGradeNeeded } from '../utils/gradeWeightHelper';

export interface GradeWeightTrackerCardProps {
  course: Course;
  assignments: Assignment[];
}

export const GradeWeightTrackerCard: React.FC<GradeWeightTrackerCardProps> = ({
  course,
  assignments
}) => {
  const [desiredGrade, setDesiredGrade] = useState<number>(90);

  const courseColor = course.hexColor || CoursePalTheme.accentBlue;
  const courseCodeKey = (course.courseCode || course.courseName).toLowerCase();

  // Active deliverables for this course
  const courseAssignments = useMemo(() => {
    return assignments.filter(
      a =>
        !a.isDeleted &&
        (a.courseId === course.id ||
          (a.courseCode || '').toLowerCase() === courseCodeKey)
    );
  }, [assignments, course.id, courseCodeKey]);

  const {
    totalWeight,
    completedWeight,
    remainingWeight,
    completionPercentage
  } = useMemo(() => computeGradeWeights(courseAssignments), [courseAssignments]);

  // Target Grade Calculus
  const neededOnRemaining = useMemo(
    () =>
      calculateTargetGradeNeeded({
        desiredGrade,
        completedWeight,
        remainingWeight,
        totalWeight
      }),
    [desiredGrade, completedWeight, remainingWeight, totalWeight]
  );

  if (courseAssignments.length === 0) {
    return null;
  }

  return (
    <View style={styles.cardContainer}>
      {/* Header Row: Title & Target Grade */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <View style={[styles.statusDot, { backgroundColor: courseColor }]} />
          <Text style={[styles.headerLabel, { color: courseColor }]}>
            GRADE WEIGHT TRACKER
          </Text>
        </View>

        {totalWeight > 100 && (
          <View style={styles.warningPill}>
            <Text style={styles.warningPillText}>Total {totalWeight}% (Adjust Weight)</Text>
          </View>
        )}

        <Text style={styles.targetLabel}>Target: {desiredGrade}%</Text>
      </View>

      {/* Visual Dual-Tone Progress Track */}
      <View style={styles.progressTrackContainer}>
        <View style={styles.progressBackgroundTrack}>
          <View
            style={[
              styles.progressFillBar,
              {
                backgroundColor: courseColor,
                width: `${Math.max(completionPercentage > 0 ? 4 : 0, completionPercentage)}%`
              }
            ]}
          />
        </View>

        <View style={styles.progressMetricsRow}>
          <Text style={[styles.completedMetricText, { color: courseColor }]}>
            {completedWeight}% Completed ({completionPercentage}%)
          </Text>
          <Text style={styles.remainingMetricText}>
            {remainingWeight}% Remaining
          </Text>
        </View>
      </View>

      {/* Target Grade Stepper / Presets */}
      <View style={styles.targetControlRow}>
        <View style={styles.targetInfoCol}>
          <Text style={styles.targetTitle}>Desired Course Grade:</Text>
          {neededOnRemaining !== null && (
            <Text style={styles.neededText}>
              {neededOnRemaining <= 0
                ? 'Goal achieved! Any score maintains grade'
                : neededOnRemaining > 100
                ? `Requires ${neededOnRemaining}% on remaining deliverables`
                : `Need ${neededOnRemaining}% avg on remaining assignments`}
            </Text>
          )}
        </View>

        {/* Discrete Quick-Pick Steppers */}
        <View style={styles.stepperGroup}>
          {[80, 85, 90, 95].map(target => {
            const isSelected = desiredGrade === target;
            return (
              <TouchableOpacity
                key={`target-${target}`}
                style={[
                  styles.stepperPill,
                  isSelected && { backgroundColor: courseColor, borderColor: courseColor }
                ]}
                onPress={() => setDesiredGrade(target)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.stepperPillText,
                    isSelected && styles.stepperPillTextActive
                  ]}
                >
                  {target}%
                </Text>
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
    borderRadius: 16,
    padding: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  warningPill: {
    backgroundColor: 'rgba(217, 64, 51, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  warningPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D94033'
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#141F38'
  },
  progressTrackContainer: {
    gap: 6,
    marginBottom: 12
  },
  progressBackgroundTrack: {
    height: 10,
    backgroundColor: '#EEF2F7',
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%'
  },
  progressFillBar: {
    height: '100%',
    borderRadius: 5
  },
  progressMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  completedMetricText: {
    fontSize: 11,
    fontWeight: '700'
  },
  remainingMetricText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096'
  },
  targetControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDF2F7',
    gap: 8
  },
  targetInfoCol: {
    flex: 1
  },
  targetTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#141F38'
  },
  neededText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  stepperGroup: {
    flexDirection: 'row',
    gap: 4
  },
  stepperPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D9E6',
    backgroundColor: '#F8FAFC'
  },
  stepperPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#596B85'
  },
  stepperPillTextActive: {
    color: '#FFFFFF'
  }
});
