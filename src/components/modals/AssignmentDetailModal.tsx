/**
 * AssignmentDetailModal
 * In-place editable assignment details with reliable Schedule toggles,
 * adjustable Grade Weight stepper (up/down), direct Points Breakdown & Rubric editing,
 * and clean keyboard-aware notes with zero extra negative space.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Assignment, Course, RubricCriterionDTO } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  XMarkCircleFillIcon,
  PlusCircleFillIcon,
  DocRichtextFillIcon,
  ArrowUpRightIcon,
  CalendarIcon
} from '../SvgIcons';
import { parseSafeDate } from '../../utils/readingDisplayHelper';
import { InlineCalendarPicker } from '../InlineCalendarPicker';

export interface AssignmentDetailModalProps {
  visible: boolean;
  assignment: Assignment | null;
  courses: Course[];
  onClose: () => void;
  onEdit?: (assignment: Assignment) => void;
  onToggleComplete?: (id: string) => void;
  onUpdateAssignment: (assignment: Assignment) => void;
  onDeleteAssignment?: (id: string) => void;
}

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  visible,
  assignment,
  courses,
  onClose,
  onUpdateAssignment
}) => {
  if (!assignment) return null;

  const scrollViewRef = useRef<ScrollView>(null);
  const currentAssignmentIdRef = useRef<string | null>(null);

  const matchedCourse = courses.find(
    c =>
      (c.courseCode || c.courseName).toLowerCase() ===
      (assignment.courseCode || '').toLowerCase()
  );

  const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;

  // Validate course code to exclude generic labels like "New", "New Assignments", "CRS"
  const isInvalidCourseCode = (code?: string | null) =>
    !code || /^(new|assignment|reading|crs|gen\s*101|details)/i.test(code.trim());

  const validCourseCode = !isInvalidCourseCode(assignment.courseCode)
    ? assignment.courseCode
    : matchedCourse && !isInvalidCourseCode(matchedCourse.courseCode)
    ? matchedCourse.courseCode
    : null;

  // In-place editable state
  const [titleText, setTitleText] = useState<string>(assignment.title || '');
  const [instructionsText, setInstructionsText] = useState<string>(assignment.fullInstructions || '');
  const [pointsPossibleText, setPointsPossibleText] = useState<string>(assignment.pointsPossible || '');
  const [gradeWeightPercent, setGradeWeightPercent] = useState<number | null>(() => {
    if (!assignment.weightPercentage) return null;
    const num = parseInt(assignment.weightPercentage.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? null : num;
  });

  // Schedule Toggles
  const [isWeekEnabled, setIsWeekEnabled] = useState<boolean>(assignment.weekNumber > 0);
  const [weekNumber, setWeekNumber] = useState<number>(assignment.weekNumber > 0 ? assignment.weekNumber : 1);
  const [dueDate, setDueDate] = useState<Date | null>(assignment.dueDate ? parseSafeDate(assignment.dueDate) : null);

  // Rubric Items State - truthful extraction only; no fabricated generic defaults
  const [rubricItems, setRubricItems] = useState<RubricCriterionDTO[]>(() => {
    if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
      return assignment.rubricCriteria.map(r => ({ ...r }));
    }
    return [];
  });

  // Resource Link
  const [mediaUrlText, setMediaUrlText] = useState<string>(assignment.mediaUrl || '');

  // Notes
  const [noteInputs, setNoteInputs] = useState<string[]>(() => {
    return (assignment.noteText || '')
      .split('\n')
      .map(n => n.replace(/^[•\-\*▪●]\s*/, '').trim())
      .filter(n => n.length > 0);
  });

  // Re-sync ONLY when switching assignment IDs or when modal opens
  useEffect(() => {
    if (!assignment || !visible) return;

    if (currentAssignmentIdRef.current !== assignment.id) {
      currentAssignmentIdRef.current = assignment.id;
      setTitleText(assignment.title || '');
      setInstructionsText(assignment.fullInstructions || '');
      setPointsPossibleText(assignment.pointsPossible || '');
      if (assignment.weightPercentage) {
        const num = parseInt(assignment.weightPercentage.replace(/[^0-9]/g, ''), 10);
        setGradeWeightPercent(isNaN(num) ? null : num);
      } else {
        setGradeWeightPercent(null);
      }

      setIsWeekEnabled(assignment.weekNumber > 0);
      setWeekNumber(assignment.weekNumber > 0 ? assignment.weekNumber : 1);
      setDueDate(assignment.dueDate ? parseSafeDate(assignment.dueDate) : null);
      setMediaUrlText(assignment.mediaUrl || '');

      if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
        setRubricItems(assignment.rubricCriteria.map(r => ({ ...r })));
      } else {
        setRubricItems([]);
      }

      const parsedNotes = (assignment.noteText || '')
        .split('\n')
        .map(n => n.replace(/^[•\-\*▪●]\s*/, '').trim())
        .filter(n => n.length > 0);
      setNoteInputs(parsedNotes);
    }
  }, [assignment?.id, visible]);

  // Persist edits to assignment
  const saveAllChanges = (overrides: Partial<Assignment> = {}) => {
    if (!assignment) return;
    const cleanNotes = noteInputs.filter(n => n.trim().length > 0).join('\n');
    const cleanRubrics = rubricItems.filter(r => r.criterionName.trim().length > 0);

    const updated: Assignment = {
      ...assignment,
      title: titleText.trim() || assignment.title || 'Assignment',
      fullInstructions: instructionsText.trim(),
      pointsPossible: pointsPossibleText.trim() ? pointsPossibleText.trim() : null,
      weightPercentage: gradeWeightPercent !== null ? `${gradeWeightPercent}%` : null,
      weekNumber: isWeekEnabled ? (weekNumber > 0 ? weekNumber : 1) : 0,
      dueDate: dueDate || null,
      mediaUrl: mediaUrlText.trim() || null,
      noteText: cleanNotes || null,
      rubricCriteria: cleanRubrics,
      ...overrides
    };

    onUpdateAssignment(updated);
  };

  const handleDone = () => {
    saveAllChanges();
    currentAssignmentIdRef.current = null;
    onClose();
  };

  // Toggle Handlers
  const handleToggleWeek = (enabled: boolean) => {
    setIsWeekEnabled(enabled);
    const resolvedWeek = enabled ? (weekNumber > 0 ? weekNumber : 1) : 0;
    if (enabled && weekNumber <= 0) {
      setWeekNumber(1);
    }
    saveAllChanges({ weekNumber: resolvedWeek });
  };

  // Stepper for Week
  const handleWeekStep = (delta: number) => {
    const next = Math.max(1, Math.min(52, weekNumber + delta));
    setWeekNumber(next);
    saveAllChanges({ weekNumber: next });
  };

  // Rubric Item Handlers & Total Points Recalculation
  const computeTotalPoints = (items: RubricCriterionDTO[]): number => {
    return items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  };

  const handleAddRubricItem = () => {
    const newItem: RubricCriterionDTO = {
      criterionName: '',
      points: 20,
      percentage: 20
    };
    const updated = [...rubricItems, newItem];
    setRubricItems(updated);
    const newTotal = computeTotalPoints(updated);
    const newTotalText = `${newTotal} Points`;
    setPointsPossibleText(newTotalText);
    saveAllChanges({ rubricCriteria: updated, pointsPossible: newTotalText });
  };

  const handleRemoveRubricItem = (idx: number) => {
    const updated = rubricItems.filter((_, i) => i !== idx);
    setRubricItems(updated);
    const newTotal = computeTotalPoints(updated);
    const newTotalText = `${newTotal} Points`;
    setPointsPossibleText(newTotalText);
    saveAllChanges({ rubricCriteria: updated, pointsPossible: newTotalText });
  };

  const handleUpdateCriterionName = (idx: number, text: string) => {
    const updated = rubricItems.map((item, i) => (i === idx ? { ...item, criterionName: text } : item));
    setRubricItems(updated);
    saveAllChanges({ rubricCriteria: updated });
  };

  const handleUpdateCriterionPoints = (idx: number, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    const updated = rubricItems.map((item, i) => (i === idx ? { ...item, points: isNaN(num) ? 0 : num } : item));
    setRubricItems(updated);
    const newTotal = computeTotalPoints(updated);
    const newTotalText = `${newTotal} Points`;
    setPointsPossibleText(newTotalText);
    saveAllChanges({ rubricCriteria: updated, pointsPossible: newTotalText });
  };

  const handleRubricPointsStep = (idx: number, delta: number) => {
    const current = rubricItems[idx]?.points ?? 0;
    const next = Math.max(0, current + delta);
    const updated = rubricItems.map((item, i) => (i === idx ? { ...item, points: next } : item));
    setRubricItems(updated);
    const newTotal = computeTotalPoints(updated);
    const newTotalText = `${newTotal} Points`;
    setPointsPossibleText(newTotalText);
    saveAllChanges({ rubricCriteria: updated, pointsPossible: newTotalText });
  };

  // Note Handlers
  const handleAddNote = () => {
    const updated = [...noteInputs, ''];
    setNoteInputs(updated);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleRemoveNote = (idx: number) => {
    const updated = noteInputs.filter((_, i) => i !== idx);
    setNoteInputs(updated);
    saveAllChanges({ noteText: updated.filter(n => n.trim().length > 0).join('\n') || null });
  };

  const handleUpdateNote = (idx: number, text: string) => {
    const updated = noteInputs.map((n, i) => (i === idx ? text : n));
    setNoteInputs(updated);
    saveAllChanges({ noteText: updated.filter(n => n.trim().length > 0).join('\n') || null });
  };

  const formattedDueDateStr = useMemo(() => {
    if (dueDate) {
      return dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return isWeekEnabled ? `Week ${weekNumber}` : 'No due date specified';
  }, [dueDate, isWeekEnabled, weekNumber]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleDone}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={handleDone}
            style={styles.doneNavButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneNavText}>Done</Text>
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitle} numberOfLines={1}>Assignment Details</Text>
          </View>

          <View style={styles.navPlaceholder} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={true}
          >
            {/* MARK: - Header Banner */}
            <View style={styles.headerBannerCard}>

              {/* Title Input */}
              <View style={styles.titleSection}>
                <TextInput
                  style={styles.assignmentTitleInput}
                  value={titleText}
                  onChangeText={t => {
                    setTitleText(t);
                    saveAllChanges({ title: t });
                  }}
                  placeholder="Assignment Title"
                  placeholderTextColor="#8E9BAE"
                  multiline={true}
                />
              </View>
            </View>

            {/* MARK: - Section 1: Systemized Schedule & Due Date */}
            <Text style={styles.sectionHeaderTitle}>Schedule & Due Date</Text>
            <View style={styles.sectionCard}>
              {/* Week Row with Toggle */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Schedule Week</Text>
                <Switch
                  value={isWeekEnabled}
                  onValueChange={handleToggleWeek}
                  trackColor={{ false: '#E2E8F0', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                  style={styles.switchControl}
                />
              </View>

              {isWeekEnabled && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.formRow}>
                    <Text style={styles.rowSubLabel}>Select Week Number</Text>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleWeekStep(-1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>

                      <View style={styles.stepperValueBox}>
                        <Text style={styles.stepperValueText}>Week {weekNumber}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleWeekStep(1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.rowDivider} />

              {/* Due Date Row (Always Visible) */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Due Date</Text>
                <View style={styles.selectedDateBanner}>
                  <CalendarIcon size={14} color="#2470F5" />
                  <Text style={styles.selectedDateBannerText}>{formattedDueDateStr}</Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Inline Calendar Picker */}
              <InlineCalendarPicker
                selectedDate={dueDate}
                onSelectDate={d => {
                  setDueDate(d);
                  saveAllChanges({ dueDate: d });
                }}
                accentColor={CoursePalTheme.accentBlue}
              />
            </View>

            {/* MARK: - Section 2: Points Breakdown & Rubric */}
            <Text style={styles.sectionHeaderTitle}>Points Breakdown</Text>
            <View style={styles.sectionCard}>
              {/* Grade Weight */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Grade Weight</Text>
                <View style={styles.weightBadge}>
                  <Text style={styles.weightBadgeText}>
                    {gradeWeightPercent !== null ? `${gradeWeightPercent}%` : 'Unspecified'}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Total Points Input Row */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Total Points</Text>
                <TextInput
                  style={styles.totalPointsInput}
                  value={pointsPossibleText}
                  onChangeText={t => {
                    setPointsPossibleText(t);
                    saveAllChanges({ pointsPossible: t });
                  }}
                  placeholder="e.g. 100 Points"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {rubricItems.length > 0 ? (
                <>
                  <View style={styles.rowDivider} />

                  {/* Rubric Items List - Clean presentation without delete or steppers */}
                  <View style={styles.rubricListContainer}>
                    {rubricItems.map((item, idx) => (
                      <View key={`rubric-${idx}`} style={styles.rubricRowCard}>
                        <View style={styles.noteIndexBadge}>
                          <Text style={styles.noteIndexBadgeText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.rubricNameInput} numberOfLines={2}>
                          {item.criterionName}
                        </Text>
                        <View style={styles.rubricPointsPill}>
                          <Text style={styles.rubricNumInput}>
                            {item.points != null ? `${item.points}` : '0'}
                          </Text>
                          <Text style={styles.rubricUnitLabel}>pts</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.emptyRubricContainer}>
                    <Text style={styles.emptyRubricText}>No rubric criteria specified</Text>
                  </View>
                </>
              )}
            </View>

            {/* MARK: - Section 3: Resource Link */}
            <Text style={styles.sectionHeaderTitle}>Resource Link</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={styles.singleFieldInput}
                value={mediaUrlText}
                onChangeText={t => {
                  setMediaUrlText(t);
                  saveAllChanges({ mediaUrl: t.trim() || null });
                }}
                placeholder="Paste reference link or video URL..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="url"
              />

              {mediaUrlText.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.openLinkPill}
                  onPress={() => {
                    const url = mediaUrlText.startsWith('http') ? mediaUrlText : `https://${mediaUrlText}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <ArrowUpRightIcon size={13} color="#2470F5" />
                  <Text style={styles.openLinkPillText} numberOfLines={1}>
                    Open {mediaUrlText}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* MARK: - Section 4: Notes (Keyboard-Aware, No Giant Bottom Gap) */}
            <Text style={styles.sectionHeaderTitle}>Notes</Text>
            <View style={styles.sectionCard}>

              {noteInputs.map((note, idx) => (
                <View key={`note-${idx}`} style={styles.noteItemCard}>
                  <View style={styles.noteIndexBadge}>
                    <Text style={styles.noteIndexBadgeText}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.noteTextInput}
                    value={note}
                    onChangeText={t => handleUpdateNote(idx, t)}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 150);
                    }}
                    placeholder="Add personal note or study plan..."
                    placeholderTextColor="#94A3B8"
                    multiline={true}
                  />
                  <TouchableOpacity
                    onPress={() => handleRemoveNote(idx)}
                    style={styles.deleteIconBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <XMarkCircleFillIcon size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleAddNote}
                style={styles.addNotePillBtn}
                activeOpacity={0.7}
              >
                <PlusCircleFillIcon size={15} color="#2470F5" />
                <Text style={styles.addNotePillBtnText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA'
  },
  keyboardAvoid: {
    flex: 1
  },
  navBar: {
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D9E6',
    backgroundColor: '#F2F5FA'
  },
  doneNavButton: {
    minWidth: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  doneNavText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2470F5'
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#141F38'
  },
  navPlaceholder: {
    minWidth: 60
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  headerBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  courseCodePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  courseCodePillText: {
    fontSize: 12,
    fontWeight: '700'
  },
  subTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4
  },
  subTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2470F5'
  },
  titleSection: {
    marginBottom: 4
  },
  assignmentTitleInput: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 22,
    padding: 0
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 8,
    marginTop: 10
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingRight: 4
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#141F38'
  },
  rowSubLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#596B85'
  },
  switchControl: {
    marginRight: 2
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 10
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2470F5'
  },
  stepperValueBox: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center'
  },
  stepperValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141F38'
  },
  weightBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weightBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141F38'
  },
  rowFullInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#141F38',
    paddingVertical: 4
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  selectedDateBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2470F5',
    includeFontPadding: false
  },
  multilineInstructionsInput: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#243048',
    lineHeight: 22,
    minHeight: 80,
    paddingTop: 0
  },
  totalPointsInput: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141F38',
    textAlign: 'right',
    minWidth: 100
  },
  rubricListContainer: {
    gap: 8,
    marginTop: 4
  },
  rubricRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  itemIndexNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#596B85'
  },
  rubricNameInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#141F38'
  },
  rubricStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  rubricStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rubricStepperBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2470F5'
  },
  rubricPointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 46,
    justifyContent: 'center',
    gap: 2
  },
  rubricInputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2
  },
  rubricNumInput: {
    fontSize: 12,
    fontWeight: '700',
    color: '#141F38',
    minWidth: 24,
    textAlign: 'center',
    padding: 0
  },
  rubricUnitLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B'
  },
  deleteIconBtn: {
    padding: 2
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 3
  },
  addItemBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2470F5'
  },
  singleFieldInput: {
    fontSize: 14,
    color: '#141F38',
    paddingVertical: 4
  },
  openLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 8,
    marginTop: 6
  },
  openLinkPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2470F5'
  },
  noteItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    minHeight: 46
  },
  noteIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  noteIndexBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  noteTextInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    lineHeight: 19,
    padding: 0,
    paddingTop: 1,
    minHeight: 32
  },
  notesEmptyPrompt: {
    fontSize: 12.5,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
    lineHeight: 17
  },
  addNotePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 2
  },
  addNotePillBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#2470F5'
  },
  emptyRubricContainer: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyRubricText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic'
  }
});
