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
import { Assignment, Course } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  CalendarIcon,
  CheckmarkCircleFillIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon
} from '../SvgIcons';
import { parseSafeDate } from '../../utils/readingDisplayHelper';

interface AssignmentDetailModalProps {
  visible: boolean;
  assignment: Assignment | null;
  courses: Course[];
  onClose: () => void;
  onEdit: (assignment: Assignment) => void;
  onToggleComplete: (id: string) => void;
  onUpdateAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (id: string) => void;
}

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  visible,
  assignment,
  courses,
  onClose,
  onEdit,
  onToggleComplete,
  onUpdateAssignment,
  onDeleteAssignment
}) => {
  if (!assignment) return null;

  const matchedCourse = courses.find(
    c =>
      (c.courseCode || c.courseName).toLowerCase() ===
      (assignment.courseCode || '').toLowerCase()
  );

  const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;
  const courseTitle = matchedCourse?.courseName || assignment.courseCode || 'Assignment';

  const [notes, setNotes] = useState<string>(assignment.noteText || '');
  const [completedMilestones, setCompletedMilestones] = useState<Set<number>>(new Set());

  // Parse milestones from relevantTopics ("|||" delimited)
  const milestones = React.useMemo(() => {
    if (!assignment.relevantTopics) return [];
    return assignment.relevantTopics
      .split('|||')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }, [assignment.relevantTopics]);

  useEffect(() => {
    setNotes(assignment.noteText || '');
  }, [assignment.noteText]);

  const handleNotesChange = (text: string) => {
    setNotes(text);
    onUpdateAssignment({
      ...assignment,
      noteText: text
    });
  };

  const toggleMilestone = (idx: number) => {
    setCompletedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Rubric items
  const rubricItems = assignment.rubricCriteria || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
              <Text style={styles.navTitle} numberOfLines={1}>Assignment Details</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                onClose();
                onEdit(assignment);
              }}
              style={[styles.navButton, styles.actionButton]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Course Header Pill */}
            <View style={styles.coursePillRow}>
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{courseTitle}</Text>
              </View>
              {assignment.subTypeRaw ? (
                <View style={styles.subTypePill}>
                  <Text style={styles.subTypePillText}>{assignment.subTypeRaw}</Text>
                </View>
              ) : null}
            </View>

            {/* Assignment Title */}
            <Text style={styles.assignmentTitle}>{assignment.title}</Text>

            {/* Date & Weight Card */}
            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <CalendarIcon size={16} color="#596B85" />
                <Text style={styles.metaText}>
                  {assignment.dueDate && (() => {
                    const d = parseSafeDate(assignment.dueDate);
                    if (!d) return null;
                    return `Due ${d.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })} · Week ${assignment.weekNumber || 1}`;
                  })() || `Week ${assignment.weekNumber || 1}`}
                </Text>
              </View>

              {assignment.weightPercentage ? (
                <View style={styles.weightBadge}>
                  <Text style={styles.weightBadgeText}>{assignment.weightPercentage} of Grade</Text>
                </View>
              ) : null}
            </View>

            {/* Instructions / Summary */}
            {assignment.fullInstructions ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>Instructions</Text>
                <Text style={styles.bodyText}>{assignment.fullInstructions}</Text>
              </View>
            ) : null}

            {/* MARK: - Rubric Breakdown (Title on Left, static 'pts' on left of numbers, numbers on Right, No Pill) */}
            {rubricItems.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.rubricHeaderRow}>
                  <Text style={styles.sectionHeader}>Rubric Criteria</Text>
                  {assignment.pointsPossible ? (
                    <Text style={styles.totalPtsHeader}>{assignment.pointsPossible}</Text>
                  ) : null}
                </View>

                <View style={styles.rubricList}>
                  {rubricItems.map((item, idx) => {
                    const ptsVal = item.points != null ? `${item.points}` : '';
                    return (
                      <View key={`rubric-${idx}`} style={styles.rubricItemRow}>
                        {/* Title on the left */}
                        <Text style={styles.rubricItemTitle} numberOfLines={2}>
                          {item.criterionName}
                        </Text>

                        {/* On the left of the numbers: static 'pts', then the numbers */}
                        <View style={styles.rubricPtsRow}>
                          <Text style={styles.ptsStaticLabel}>pts</Text>
                          <Text style={styles.ptsValueText}>{ptsVal || '0'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* MARK: - AI Study Milestones */}
            {milestones.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>Study Milestones</Text>
                {milestones.map((step, idx) => {
                  const isDone = completedMilestones.has(idx);
                  return (
                    <TouchableOpacity
                      key={`step-${idx}`}
                      style={styles.milestoneRow}
                      onPress={() => toggleMilestone(idx)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.milestoneCheckCircle, isDone && styles.milestoneCheckCircleDone]}>
                        {isDone && <Text style={styles.milestoneCheckmark}>✓</Text>}
                      </View>
                      <Text style={[styles.milestoneText, isDone && styles.milestoneTextDone]}>
                        {step}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* MARK: - Personal Notes */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Personal Notes</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={4}
                placeholder="Add personal thoughts, project links, or references..."
                placeholderTextColor="#8E9BAE"
                value={notes}
                onChangeText={handleNotesChange}
              />
            </View>

            {/* Complete Toggle Button */}
            <TouchableOpacity
              style={[
                styles.completeButton,
                assignment.isCompleted && styles.completeButtonDone
              ]}
              onPress={() => onToggleComplete(assignment.id)}
              activeOpacity={0.8}
            >
              <CheckmarkCircleFillIcon size={18} color={assignment.isCompleted ? '#059669' : '#FFFFFF'} />
              <Text
                style={[
                  styles.completeButtonText,
                  assignment.isCompleted && styles.completeButtonTextDone
                ]}
              >
                {assignment.isCompleted ? 'Completed' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>

            {/* Delete or Restore Assignment Button */}
            {assignment.isDeleted ? (
              <TouchableOpacity
                style={styles.restoreDetailButton}
                onPress={() => {
                  onUpdateAssignment({
                    ...assignment,
                    isDeleted: false
                  });
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <ArrowPathIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.restoreDetailButtonText}>Restore to Active Schedule</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  onDeleteAssignment(assignment.id);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <TrashIcon size={15} color="#D94033" />
                <Text style={styles.deleteButtonText}>Move to Trash</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA'
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
  editText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64
  },
  coursePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 12
  },
  coursePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  coursePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  subTypePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E5E7EB'
  },
  subTypePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563'
  },
  assignmentTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#121C33',
    lineHeight: 28,
    marginBottom: 18
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#354252'
  },
  weightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6'
  },
  weightBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563'
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#121C33',
    marginBottom: 14
  },
  bodyText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#354252',
    lineHeight: 24
  },
  rubricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  totalPtsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2470F5'
  },
  rubricList: {
    gap: 10
  },
  rubricItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF0F5'
  },
  rubricItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    marginRight: 12
  },
  rubricPtsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ptsStaticLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#73859E'
  },
  ptsValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141F38',
    minWidth: 24,
    textAlign: 'right'
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8
  },
  milestoneCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  milestoneCheckCircleDone: {
    backgroundColor: '#2470F5',
    borderColor: '#2470F5'
  },
  milestoneCheckmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  milestoneText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#1F2937'
  },
  milestoneTextDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF'
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA'
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2470F5',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 10
  },
  completeButtonDone: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  completeButtonTextDone: {
    color: '#059669'
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D94033'
  },
  restoreDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    marginVertical: 10
  },
  restoreDetailButtonText: {
    color: CoursePalTheme.accentBlue,
    fontSize: 14,
    fontWeight: '700'
  }
});
