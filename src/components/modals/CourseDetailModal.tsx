/**
 * CourseDetailModal
 * 1:1 Parity with native Swift CourseDetailView.swift
 * Allows in-place editing of course header, code, faculty contact, and view/add tasks.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Course, Assignment, Reading } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import { SparklesIcon, ChevronRightIcon } from '../SvgIcons';
import { formatDisplayTitleWithChapter, formatAuthorAndPagesSubtitle } from '../../utils/readingDisplayHelper';

export interface CourseDetailModalProps {
  visible: boolean;
  course: Course | null;
  assignments: Assignment[];
  readings: Reading[];
  onClose: () => void;
  onSave: (updated: Course) => void;
  onAddAssignment?: (courseId: string) => void;
  onAddReading?: (courseId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
  onEditReading?: (reading: Reading) => void;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  visible,
  course,
  assignments,
  readings,
  onClose,
  onSave,
  onAddAssignment,
  onAddReading,
  onEditAssignment,
  onEditReading
}) => {
  if (!course) return null;

  const [courseName, setCourseName] = useState<string>(course.courseName);
  const [courseCode, setCourseCode] = useState<string>(course.courseCode || '');
  const [instructorName, setInstructorName] = useState<string>(course.instructorName || '');
  const [instructorEmail, setInstructorEmail] = useState<string>(course.instructorEmail || '');

  useEffect(() => {
    if (course) {
      setCourseName(course.courseName);
      setCourseCode(course.courseCode || '');
      setInstructorName(course.instructorName || '');
      setInstructorEmail(course.instructorEmail || '');
    }
  }, [course]);

  const courseColor = course.hexColor || CoursePalTheme.accentBlue;

  // Filter assignments & readings for this course
  const courseCodeKey = (course.courseCode || course.courseName).toLowerCase();
  const courseAssignments = assignments
    .filter(a => !a.isDeleted && (a.courseId === course.id || (a.courseCode || '').toLowerCase() === courseCodeKey))
    .sort((a, b) => {
      const d1 = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const d2 = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return d1 - d2;
    });

  const courseReadings = readings
    .filter(r => !r.isDeleted && (r.courseCode || '').toLowerCase() === courseCodeKey);

  const handleSave = () => {
    const cleanName = courseName.trim();
    const cleanCode = courseCode.trim();
    const cleanInstructor = instructorName.trim();
    const cleanEmail = instructorEmail.trim();

    const updated: Course = {
      ...course,
      courseName: cleanName.length > 0 ? cleanName : course.courseName,
      courseCode: cleanCode.length > 0 ? cleanCode : course.courseCode,
      instructorName: cleanInstructor.length > 0 ? cleanInstructor : undefined,
      instructorEmail: cleanEmail.length > 0 ? cleanEmail : undefined
    };

    onSave(updated);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* Navigation Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.navButton, styles.cancelButton]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.navTitleContainer}>
              <Text style={styles.navTitle} numberOfLines={1}>Edit Course</Text>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.navButton, styles.actionButton]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.saveText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            alwaysBounceHorizontal={false}
            showsHorizontalScrollIndicator={false}
            bounces={true}
            overScrollMode="never"
          >
            {/* MARK: - 0. Ask Course AI Assistant Card */}
            <View style={styles.aiCard}>
              <View style={[styles.aiIconCircle, { backgroundColor: `${courseColor}18` }]}>
                <SparklesIcon size={20} color={courseColor} />
              </View>

              <View style={styles.aiTextCol}>
                <View style={styles.aiTitleRow}>
                  <Text style={styles.aiTitleText}>Ask Course AI</Text>
                  <View style={[styles.aiBadgePill, { backgroundColor: `${courseColor}18` }]}>
                    <Text style={[styles.aiBadgeText, { color: courseColor }]}>AI</Text>
                  </View>
                </View>
                <Text style={styles.aiSubtitleText}>Instant answers for policies, rubrics & schedule</Text>
              </View>

              <ChevronRightIcon size={14} color="#8E9BAE" />
            </View>

            {/* MARK: - 1. Course Header Section */}
            <Text style={styles.sectionHeaderTitle}>Course Header</Text>
            <View style={styles.sectionCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>COURSE TITLE</Text>
                <TextInput
                  style={styles.textInput}
                  value={courseName}
                  onChangeText={setCourseName}
                  placeholder="Course Name (e.g. Intro to Psychology)"
                  placeholderTextColor="#8E9BAE"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>COURSE CODE</Text>
                <TextInput
                  style={[styles.textInput, { color: courseColor, fontWeight: '700' }]}
                  value={courseCode}
                  onChangeText={setCourseCode}
                  placeholder="Course Code (e.g. PSYC 101)"
                  placeholderTextColor="#8E9BAE"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* MARK: - 2. Faculty & Contact Info Section */}
            <Text style={styles.sectionHeaderTitle}>Faculty & Contact Info</Text>
            <View style={styles.sectionCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>INSTRUCTOR / FACULTY</Text>
                <TextInput
                  style={styles.textInput}
                  value={instructorName}
                  onChangeText={setInstructorName}
                  placeholder="Faculty Name (e.g. Dr. Jane Smith)"
                  placeholderTextColor="#8E9BAE"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  style={[styles.textInput, { color: CoursePalTheme.accentBlue }]}
                  value={instructorEmail}
                  onChangeText={setInstructorEmail}
                  placeholder="Email (e.g. jsmith@university.edu)"
                  placeholderTextColor="#8E9BAE"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* MARK: - 3. Course Assignments Section */}
            <Text style={styles.sectionHeaderTitle}>Assignments</Text>
            <View style={styles.sectionCard}>
              {courseAssignments.map(assign => (
                <TouchableOpacity
                  key={assign.id}
                  style={styles.itemRowCard}
                  onPress={() => onEditAssignment && onEditAssignment(assign)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemRowTitle}>{assign.title}</Text>
                  {assign.dueDate && (
                    <Text style={styles.itemRowDate}>
                      Due {new Date(assign.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.actionPillButton}
                onPress={() => onAddAssignment && onAddAssignment(course.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionPillText}>+ Add Assignment</Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - 4. Course Readings Section */}
            <Text style={styles.sectionHeaderTitle}>Readings</Text>
            <View style={styles.sectionCard}>
              {courseReadings.map(reading => {
                const dispTitle = formatDisplayTitleWithChapter(
                  reading,
                  undefined,
                  reading.resourceTitle,
                  course.courseName
                );
                const dispSub = formatAuthorAndPagesSubtitle(
                  reading,
                  undefined,
                  reading.resourceTitle,
                  dispTitle,
                  course.courseName
                );
                return (
                  <TouchableOpacity
                    key={reading.id}
                    style={styles.itemRowCard}
                    onPress={() => onEditReading && onEditReading(reading)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.itemRowTitle}>{dispTitle}</Text>
                    {dispSub.length > 0 && (
                      <Text style={styles.itemRowSubtitle}>{dispSub}</Text>
                    )}
                    {reading.dueDate && (
                      <Text style={styles.itemRowDate}>
                        Due {new Date(reading.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.actionPillButton}
                onPress={() => onAddReading && onAddReading(course.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionPillText}>+ Add Reading</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA',
    width: '100%'
  },
  navBar: {
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D9E6',
    backgroundColor: '#F2F5FA'
  },
  navButton: {
    minWidth: 70,
    height: 44,
    justifyContent: 'center'
  },
  cancelButton: {
    alignItems: 'flex-start'
  },
  actionButton: {
    alignItems: 'flex-end'
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5'
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#121C33',
    textAlign: 'center'
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5'
  },
  scrollView: {
    flex: 1,
    width: '100%'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64,
    gap: 20
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  aiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  aiTextCol: {
    flex: 1
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  aiTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141F38'
  },
  aiBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '900'
  },
  aiSubtitleText: {
    fontSize: 12,
    color: '#596B85',
    marginTop: 2
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 2
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    gap: 12
  },
  fieldBlock: {
    gap: 6,
    paddingVertical: 4
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#738094',
    letterSpacing: 0.5
  },
  textInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#141F38',
    paddingVertical: 6
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F6',
    marginVertical: 4
  },
  itemRowCard: {
    padding: 14,
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: 4,
    marginBottom: 4
  },
  itemRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141F38'
  },
  itemRowSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#596B85'
  },
  itemRowDate: {
    fontSize: 12,
    color: '#596B85'
  },
  actionPillButton: {
    padding: 12,
    backgroundColor: '#F0F4FC',
    borderRadius: 12,
    alignItems: 'center'
  },
  actionPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  }
});
