/**
 * EditAssignmentModal
 * 1:1 Parity with native Swift EditAssignmentSheet in AssignmentsView.swift
 * Visual layout matching media_1788720741700.png
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
  Switch,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Assignment, Course, RubricCriterionDTO } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  XMarkCircleFillIcon,
  PlusCircleFillIcon,
  TrashIcon
} from '../SvgIcons';

export interface EditAssignmentModalProps {
  visible: boolean;
  assignment: Assignment | null;
  courses: Course[];
  onClose: () => void;
  onSave: (updated: Assignment) => void;
  onDeleteAssignment?: (id: string) => void;
}

export const EditAssignmentModal: React.FC<EditAssignmentModalProps> = ({
  visible,
  assignment,
  courses,
  onClose,
  onSave,
  onDeleteAssignment
}) => {
  if (!assignment) return null;

  const [courseNameInput, setCourseNameInput] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [moduleInput, setModuleInput] = useState<string>('');
  const [hasDueDate, setHasDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [gradeWeightPercent, setGradeWeightPercent] = useState<number>(25);
  const [rubricItems, setRubricItems] = useState<RubricCriterionDTO[]>([]);
  const [topicInputs, setTopicInputs] = useState<string[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [noteInputs, setNoteInputs] = useState<string[]>([]);

  useEffect(() => {
    if (assignment) {
      const matched = courses.find(
        c => (c.courseCode || c.courseName).toLowerCase() === (assignment.courseCode || '').toLowerCase()
      );
      setCourseNameInput(matched?.courseName || assignment.courseCode || 'New');

      setWeekNumber(assignment.weekNumber > 0 ? assignment.weekNumber : 1);
      setModuleInput(assignment.relevantTopics && assignment.relevantTopics.toLowerCase().includes('module') ? assignment.relevantTopics : '');
      setHasDueDate(assignment.dueDate != null);
      setDueDate(assignment.dueDate ? new Date(assignment.dueDate) : new Date());

      // Parse grade weight
      const rawWeight = assignment.weightPercentage || '25%';
      const weightNum = parseInt(rawWeight.replace(/[^0-9]/g, ''), 10);
      setGradeWeightPercent(isNaN(weightNum) ? 25 : weightNum);

      // Parse rubric items
      if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
        setRubricItems(assignment.rubricCriteria.map(r => ({ ...r })));
      } else {
        // Fallback default rubrics matching user syllabus
        setRubricItems([
          { criterionName: 'Communication', points: 20 },
          { criterionName: 'Engagement & Attendance', points: 20 },
          { criterionName: 'Empathy & Compassion', points: 20 },
          { criterionName: 'Self Awareness', points: 20 },
          { criterionName: 'Self Regulation', points: 20 }
        ]);
      }

      // Topics
      const topics = (assignment.relevantTopics || 'Module 1')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && !t.toLowerCase().startsWith('week '));
      setTopicInputs(topics.length > 0 ? topics : ['Module 1']);

      setVideoUrlInput(assignment.mediaUrl || '');

      // Notes
      const notes = (assignment.noteText || '')
        .split('\n')
        .map(n => n.replace(/^[•\-\*▪●]\s*/, '').trim())
        .filter(n => n.length > 0);
      setNoteInputs(notes);
    }
  }, [assignment, courses]);

  const handleAddRubricItem = () => {
    setRubricItems(prev => [
      ...prev,
      {
        criterionName: '',
        points: 20
      }
    ]);
  };

  const handleRemoveRubricItem = (idx: number) => {
    setRubricItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateCriterionName = (idx: number, text: string) => {
    setRubricItems(prev => prev.map((item, i) => (i === idx ? { ...item, criterionName: text } : item)));
  };

  const handleUpdateCriterionPoints = (idx: number, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    setRubricItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, points: isNaN(num) ? 0 : num } : item))
    );
  };

  const handleAddTopic = () => {
    setTopicInputs(prev => [...prev, '']);
  };

  const handleRemoveTopic = (idx: number) => {
    setTopicInputs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateTopic = (idx: number, text: string) => {
    setTopicInputs(prev => prev.map((t, i) => (i === idx ? text : t)));
  };

  const handleAddNote = () => {
    setNoteInputs(prev => [...prev, '']);
  };

  const handleRemoveNote = (idx: number) => {
    setNoteInputs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateNote = (idx: number, text: string) => {
    setNoteInputs(prev => prev.map((n, i) => (i === idx ? text : n)));
  };

  const handleSave = () => {
    const totalPts = rubricItems.reduce((acc, curr) => acc + (curr.points || 0), 0);
    const updated: Assignment = {
      ...assignment,
      weekNumber: weekNumber > 0 ? weekNumber : 1,
      dueDate: hasDueDate ? dueDate : null,
      weightPercentage: `${gradeWeightPercent}%`,
      pointsPossible: totalPts > 0 ? `${totalPts} Points` : assignment.pointsPossible,
      rubricCriteria: rubricItems.filter(r => r.criterionName.trim().length > 0),
      relevantTopics: topicInputs.filter(t => t.trim().length > 0).join(', ') || undefined,
      mediaUrl: videoUrlInput.trim() || undefined,
      noteText: noteInputs.filter(n => n.trim().length > 0).join('\n') || undefined
    };
    onSave(updated);
    onClose();
  };

  const formattedDate = dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

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
              <Text style={styles.navTitle} numberOfLines={1}>Details</Text>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.navButton, styles.actionButton]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.saveText}>Save</Text>
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
            {/* MARK: - Section 1: Schedule */}
            <View style={styles.sectionCard}>
              {/* Due Date Row with Switch */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Due Date</Text>
                <Switch
                  value={hasDueDate}
                  onValueChange={setHasDueDate}
                  trackColor={{ false: '#E2E8F0', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Select Date Row (if Due Date is on) */}
              {hasDueDate && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.formRow}>
                    <Text style={styles.rowLabel}>Select Date</Text>
                    <View style={styles.dateCapsule}>
                      <Text style={styles.dateCapsuleText}>{formattedDate}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* MARK: - Section 2: Points Breakdown (Matching Screenshot 1:1) */}
            <Text style={styles.sectionHeaderTitle}>Points Breakdown</Text>
            <View style={styles.sectionCard}>
              {/* Grade Weight Selector */}
              <View style={styles.formRow}>
                <Text style={styles.gradeWeightLabel}>Grade Weight</Text>
                <TouchableOpacity
                  style={styles.gradeWeightSelector}
                  onPress={() => {
                    const weights = [5, 10, 15, 20, 25, 30, 40, 50];
                    const nextIdx = (weights.indexOf(gradeWeightPercent) + 1) % weights.length;
                    setGradeWeightPercent(weights[nextIdx]);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gradeWeightSelectorText}>{gradeWeightPercent}% ⇅</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rowDivider} />

              {/* Rubric Items List */}
              <View style={styles.rubricListContainer}>
                {rubricItems.map((item, idx) => (
                  <View key={`rubric-${idx}`} style={styles.rubricCard}>
                    <Text style={styles.rubricItemIndex}>{idx + 1} -</Text>
                    <TextInput
                      style={styles.rubricTitleInput}
                      value={item.criterionName}
                      onChangeText={t => handleUpdateCriterionName(idx, t)}
                      placeholder="Item name..."
                      placeholderTextColor="#8E9BAE"
                    />

                    {/* Points Pill Container (pts label on right of number) */}
                    <View style={styles.pointsPill}>
                      <TextInput
                        style={styles.pointsNumberInput}
                        value={item.points != null ? `${item.points}` : '0'}
                        keyboardType="decimal-pad"
                        onChangeText={t => handleUpdateCriterionPoints(idx, t)}
                      />
                      <Text style={styles.pointsLabelText}>pts</Text>
                    </View>

                    {/* Remove Item Button (x) */}
                    <TouchableOpacity
                      onPress={() => handleRemoveRubricItem(idx)}
                      style={styles.removeRubricButton}
                      activeOpacity={0.7}
                    >
                      <XMarkCircleFillIcon size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Add Item Button */}
              <TouchableOpacity onPress={handleAddRubricItem} style={styles.addItemButton} activeOpacity={0.7}>
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - Section 3: Topics */}
            <Text style={styles.sectionHeaderTitle}>Topics</Text>
            <View style={styles.sectionCard}>
              {topicInputs.map((topic, idx) => (
                <View key={`topic-${idx}`} style={styles.topicRow}>
                  <Text style={styles.topicPrefix}>{idx + 1} -</Text>
                  <TextInput
                    style={styles.topicInput}
                    value={topic}
                    onChangeText={t => handleUpdateTopic(idx, t)}
                    placeholder="Topic description..."
                    placeholderTextColor="#8E9BAE"
                  />
                  {topic.length > 0 && (
                    <TouchableOpacity onPress={() => handleRemoveTopic(idx)} style={styles.removeTopicButton}>
                      <XMarkCircleFillIcon size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity onPress={handleAddTopic} style={styles.addItemButton} activeOpacity={0.7}>
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemButtonText}>Add Topic</Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - Section 4: Resource Link */}
            <Text style={styles.sectionHeaderTitle}>Resource Link</Text>
            <View style={styles.sectionCardSingle}>
              <TextInput
                style={styles.singleFieldInput}
                value={videoUrlInput}
                onChangeText={setVideoUrlInput}
                placeholder="Paste video or article URL..."
                placeholderTextColor="#8E9BAE"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            {/* MARK: - Section 5: Notes */}
            <Text style={styles.sectionHeaderTitle}>Notes</Text>
            <View style={styles.sectionCard}>
              {noteInputs.map((note, idx) => (
                <View key={`note-${idx}`} style={styles.noteItemCard}>
                  <View style={styles.noteItemHeader}>
                    <Text style={styles.topicPrefix}>{idx + 1} -</Text>
                    <TextInput
                      style={styles.noteTextInput}
                      value={note}
                      onChangeText={t => handleUpdateNote(idx, t)}
                      placeholder="Add note or instruction..."
                      placeholderTextColor="#8E9BAE"
                      multiline
                    />
                    <TouchableOpacity onPress={() => handleRemoveNote(idx)} style={styles.removeTopicButton}>
                      <XMarkCircleFillIcon size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity onPress={handleAddNote} style={styles.addItemButton} activeOpacity={0.7}>
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>

            {/* Move to Trash Action */}
            {onDeleteAssignment && (
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
    color: '#081324',
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
    paddingBottom: 64,
    paddingTop: 20
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85',
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  sectionCardSingle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  singleFieldInput: {
    fontSize: 16,
    fontWeight: '500',
    color: '#081324',
    paddingVertical: 4
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#081324'
  },
  gradeWeightLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#081324'
  },
  gradeWeightSelector: {
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  gradeWeightSelectorText: {
    fontSize: 15,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6
  },
  dateCapsule: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  dateCapsuleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#081324'
  },
  rubricListContainer: {
    gap: 8,
    marginTop: 6
  },
  rubricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8
  },
  rubricItemIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: '#596B85'
  },
  rubricTitleInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#081324',
    paddingVertical: 0
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4
  },
  pointsNumberInput: {
    fontSize: 14,
    fontWeight: '700',
    color: '#081324',
    minWidth: 22,
    textAlign: 'center',
    paddingVertical: 0
  },
  pointsLabelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#596B85'
  },
  removeRubricButton: {
    padding: 2
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8
  },
  topicPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#596B85'
  },
  topicInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#081324',
    paddingVertical: 0
  },
  removeTopicButton: {
    padding: 2
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 8
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  noteItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginVertical: 4
  },
  noteItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  noteTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#081324',
    lineHeight: 20,
    paddingVertical: 0
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(217, 64, 51, 0.25)',
    gap: 8
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D94033'
  }
});
