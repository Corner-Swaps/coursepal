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
import { ChevronRightIcon } from '../SvgIcons';
import {
  formatDisplayTitleWithChapter,
  formatAuthorAndPagesSubtitle,
  isItemForCourse
} from '../../utils/readingDisplayHelper';
import { resolveFullAuthorName } from '../../utils/authorResolver';

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
  const [officeHours, setOfficeHours] = useState<string>(course.officeHours || '');

  useEffect(() => {
    if (course) {
      setCourseName(course.courseName);
      setCourseCode(course.courseCode || '');
      setInstructorName(course.instructorName || '');
      setInstructorEmail(course.instructorEmail || '');
      setOfficeHours(course.officeHours || '');
    }
  }, [course]);

  const courseColor = course.hexColor || CoursePalTheme.accentBlue;

  // Filter assignments & readings for this course using resilient matching
  const courseAssignments = assignments
    .filter(a => !a.isDeleted && isItemForCourse(a, course))
    .sort((a, b) => {
      const d1 = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const d2 = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return d1 - d2;
    });

  const courseReadings = readings
    .filter(r => !r.isDeleted && isItemForCourse(r, course));

  const handleSave = () => {
    const cleanName = courseName.trim();
    const cleanCode = courseCode.trim();
    const cleanInstructor = instructorName.trim();
    const cleanEmail = instructorEmail.trim();
    const cleanOffice = officeHours.trim();

    const updated: Course = {
      ...course,
      courseName: cleanName.length > 0 ? cleanName : course.courseName,
      courseCode: cleanCode.length > 0 ? cleanCode : course.courseCode,
      instructorName: cleanInstructor.length > 0 ? cleanInstructor : undefined,
      instructorEmail: cleanEmail.length > 0 ? cleanEmail : undefined,
      officeHours: cleanOffice.length > 0 ? cleanOffice : undefined
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

              <View style={styles.divider} />

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>SCHEDULE / OFFICE HOURS</Text>
                <TextInput
                  style={[styles.textInput, { color: CoursePalTheme.accentBlue }]}
                  value={officeHours}
                  onChangeText={setOfficeHours}
                  placeholder="Schedule / Office Hours (e.g. Tuesdays 2–4 PM)"
                  placeholderTextColor="#8E9BAE"
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
                const matchedWeek = reading.weekNumber
                  ? (course.weeks || []).find(w => w.weekNumber === reading.weekNumber)
                  : null;
                const readingWithTopic = {
                  ...reading,
                  relevantTopics: reading.relevantTopics || matchedWeek?.theme || undefined
                };
                const dispTitle = formatDisplayTitleWithChapter(
                  readingWithTopic,
                  reading.chapterText,
                  reading.resourceTitle,
                  course.courseName
                );
                const dispSub = formatAuthorAndPagesSubtitle(
                  readingWithTopic,
                  reading.pagesText,
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
                    {(() => {
                      let cleanSub = (dispSub || '').replace(/^[:;•·\-–—\s,.]+|[:;•·\-–—\s,.]+$/g, '').trim();
                      const rawAuth = reading.authorName?.trim() ||
                        (course.textbooks?.length === 1 ? course.textbooks[0].authorName : undefined);
                      const resolvedAuthor = resolveFullAuthorName(rawAuth) || rawAuth;
                      if (!cleanSub && resolvedAuthor && !dispTitle.toLowerCase().includes(resolvedAuthor.toLowerCase())) {
                        cleanSub = resolvedAuthor;
                      } else if (!cleanSub && reading.resourceTitle && !dispTitle.toLowerCase().includes(reading.resourceTitle.toLowerCase())) {
                        cleanSub = reading.resourceTitle;
                      } else if (!cleanSub && resolvedAuthor) {
                        cleanSub = `By ${resolvedAuthor}`;
                      }
                      if (!cleanSub) return null;
                      return <Text style={styles.itemRowSubtitle}>{cleanSub}</Text>;
                    })()}
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

            {/* MARK: - 5. Course Textbooks & Authors Section */}
            {(() => {
              const cleanTextbooks = (course.textbooks || [])
                .map(tb => {
                  if (/^\(?\s*ch(?:apter)?s?\.?\s*[\d\s&,\-–—]+\s*\)?$/i.test(tb.title.trim())) {
                    if (tb.authorName) {
                      return { ...tb, title: `Core Literature: ${tb.authorName}` };
                    }
                    return null;
                  }
                  return tb;
                })
                .filter((tb): tb is NonNullable<typeof tb> => tb !== null);

              if (cleanTextbooks.length === 0) return null;

              return (
                <>
                  <Text style={styles.sectionHeaderTitle}>Required Textbooks & Authors</Text>
                  <View style={styles.sectionCard}>
                    {cleanTextbooks.map((tb, idx) => (
                      <View key={`modal-tb-${idx}`} style={styles.textbookRow}>
                        <Text style={styles.itemRowTitle}>{tb.title}</Text>
                        {tb.authorName ? (
                          <Text style={styles.itemRowSubtitle}>Author: {resolveFullAuthorName(tb.authorName) || tb.authorName}</Text>
                        ) : null}
                        {tb.edition ? (
                          <Text style={styles.textbookEditionSubtitle}>Edition: {tb.edition}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              );
            })()}
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
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85',
    letterSpacing: 0.5,
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
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 19,
    letterSpacing: -0.2
  },
  itemRowSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 17
  },
  itemRowDate: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#596B85'
  },
  actionPillButton: {
    padding: 12,
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 12,
    alignItems: 'center'
  },
  actionPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  textbookRow: {
    padding: 14,
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    gap: 4,
    marginBottom: 8
  },
  textbookEditionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE'
  }
});
