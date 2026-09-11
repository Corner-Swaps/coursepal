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
  const [pointsPossibleText, setPointsPossibleText] = useState<string>(assignment.pointsPossible || '100 Points');
  const [gradeWeightPercent, setGradeWeightPercent] = useState<number>(() => {
    const raw = assignment.weightPercentage || '25%';
    const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 25 : num;
  });

  // Schedule Toggles
  const [isWeekEnabled, setIsWeekEnabled] = useState<boolean>(assignment.weekNumber > 0);
  const [weekNumber, setWeekNumber] = useState<number>(assignment.weekNumber > 0 ? assignment.weekNumber : 1);
  const [isModuleEnabled, setIsModuleEnabled] = useState<boolean>(
    Boolean(assignment.moduleMention && assignment.moduleMention.trim().length > 0)
  );
  const [moduleText, setModuleText] = useState<string>(assignment.moduleMention || '');
  const [hasDueDate, setHasDueDate] = useState<boolean>(assignment.dueDate != null);
  const [dueDate, setDueDate] = useState<Date>(parseSafeDate(assignment.dueDate) || new Date());

  // Rubric Items State
  const [rubricItems, setRubricItems] = useState<RubricCriterionDTO[]>(() => {
    if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
      return assignment.rubricCriteria.map(r => ({ ...r }));
    }
    return [
      { criterionName: 'Depth of Analysis & Insight', points: 30, percentage: 30 },
      { criterionName: 'Academic Evidence & Citations', points: 30, percentage: 30 },
      { criterionName: 'Structural Coherence & Flow', points: 20, percentage: 20 },
      { criterionName: 'Formatting & Mechanics', points: 20, percentage: 20 }
    ];
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
      setPointsPossibleText(assignment.pointsPossible || '100 Points');
      const raw = assignment.weightPercentage || '25%';
      const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      setGradeWeightPercent(isNaN(num) ? 25 : num);

      setIsWeekEnabled(assignment.weekNumber > 0);
      setWeekNumber(assignment.weekNumber > 0 ? assignment.weekNumber : 1);
      setIsModuleEnabled(Boolean(assignment.moduleMention && assignment.moduleMention.trim().length > 0));
      setModuleText(assignment.moduleMention || '');
      setHasDueDate(assignment.dueDate != null);
      setDueDate(parseSafeDate(assignment.dueDate) || new Date());
      setMediaUrlText(assignment.mediaUrl || '');

      if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
        setRubricItems(assignment.rubricCriteria.map(r => ({ ...r })));
      } else {
        setRubricItems([
          { criterionName: 'Depth of Analysis & Insight', points: 30, percentage: 30 },
          { criterionName: 'Academic Evidence & Citations', points: 30, percentage: 30 },
          { criterionName: 'Structural Coherence & Flow', points: 20, percentage: 20 },
          { criterionName: 'Formatting & Mechanics', points: 20, percentage: 20 }
        ]);
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
      title: titleText.trim() || 'Assignment',
      fullInstructions: instructionsText.trim(),
      pointsPossible: pointsPossibleText.trim() || '100 Points',
      weightPercentage: `${gradeWeightPercent}%`,
      weekNumber: isWeekEnabled ? weekNumber : 0,
      moduleMention: isModuleEnabled && moduleText.trim().length > 0 ? moduleText.trim() : null,
      dueDate: hasDueDate ? dueDate : null,
      mediaUrl: mediaUrlText.trim() || null,
      noteText: cleanNotes || null,
      relevantTopics: isModuleEnabled ? moduleText.trim() : null,
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
    saveAllChanges({ weekNumber: enabled ? weekNumber : 0 });
  };

  const handleToggleModule = (enabled: boolean) => {
    setIsModuleEnabled(enabled);
    saveAllChanges({ moduleMention: enabled ? (moduleText.trim() || 'Module 1') : null });
  };

  const handleToggleDueDate = (enabled: boolean) => {
    setHasDueDate(enabled);
    saveAllChanges({ dueDate: enabled ? dueDate : null });
  };

  // Steppers
  const handleWeekStep = (delta: number) => {
    const next = Math.max(1, Math.min(52, weekNumber + delta));
    setWeekNumber(next);
    saveAllChanges({ weekNumber: next });
  };

  const handleWeightStep = (delta: number) => {
    const next = Math.max(0, Math.min(100, gradeWeightPercent + delta));
    setGradeWeightPercent(next);
    saveAllChanges({ weightPercentage: `${next}%` });
  };

  // Rubric Item Handlers
  const handleAddRubricItem = () => {
    const newItem: RubricCriterionDTO = {
      criterionName: '',
      points: 20,
      percentage: 20
    };
    const updated = [...rubricItems, newItem];
    setRubricItems(updated);
    saveAllChanges({ rubricCriteria: updated });
  };

  const handleRemoveRubricItem = (idx: number) => {
    const updated = rubricItems.filter((_, i) => i !== idx);
    setRubricItems(updated);
    saveAllChanges({ rubricCriteria: updated });
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
    saveAllChanges({ rubricCriteria: updated });
  };

  const handleUpdateCriterionPercentage = (idx: number, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    const updated = rubricItems.map((item, i) => (i === idx ? { ...item, percentage: isNaN(num) ? 0 : num } : item));
    setRubricItems(updated);
    saveAllChanges({ rubricCriteria: updated });
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
    if (hasDueDate && dueDate) {
      return dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return isWeekEnabled ? `Week ${weekNumber}` : 'No due date specified';
  }, [hasDueDate, dueDate, isWeekEnabled, weekNumber]);

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
            {/* MARK: - Header Banner (Clean Title & Genuine Pills Only) */}
            <View style={styles.headerBannerCard}>
              <View style={styles.headerPillsRow}>
                {validCourseCode && (
                  <View style={[styles.courseCodePill, { backgroundColor: `${courseColor}22` }]}>
                    <Text style={[styles.courseCodePillText, { color: courseColor }]}>{validCourseCode}</Text>
                  </View>
                )}

                <View style={styles.subTypeBadge}>
                  <DocRichtextFillIcon size={12} color="#2470F5" />
                  <Text style={styles.subTypeBadgeText}>
                    {(assignment.subTypeRaw || 'PAPER').toUpperCase()}
                  </Text>
                </View>
              </View>

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

              {/* Module Row with Toggle */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Module / Unit</Text>
                <Switch
                  value={isModuleEnabled}
                  onValueChange={handleToggleModule}
                  trackColor={{ false: '#E2E8F0', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                  style={styles.switchControl}
                />
              </View>

              {isModuleEnabled && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.formRow}>
                    <TextInput
                      style={styles.rowFullInput}
                      value={moduleText}
                      onChangeText={t => {
                        setModuleText(t);
                        saveAllChanges({ moduleMention: t.trim() || null });
                      }}
                      placeholder="e.g. Module 2: Ethics & Research"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </>
              )}

              <View style={styles.rowDivider} />

              {/* Due Date Row with Toggle */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Due Date</Text>
                <Switch
                  value={hasDueDate}
                  onValueChange={handleToggleDueDate}
                  trackColor={{ false: '#E2E8F0', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                  style={styles.switchControl}
                />
              </View>

              {hasDueDate && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.selectedDateBanner}>
                    <CalendarIcon size={14} color="#2470F5" />
                    <Text style={styles.selectedDateBannerText}>{formattedDueDateStr}</Text>
                  </View>

                  {/* Inline Calendar Picker */}
                  <InlineCalendarPicker
                    selectedDate={dueDate}
                    onSelectDate={d => {
                      setDueDate(d);
                      saveAllChanges({ dueDate: d });
                    }}
                    accentColor={CoursePalTheme.accentBlue}
                  />
                </>
              )}
            </View>

            {/* MARK: - Section 2: Instructions */}
            <Text style={styles.sectionHeaderTitle}>Instructions</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={styles.multilineInstructionsInput}
                value={instructionsText}
                onChangeText={t => {
                  setInstructionsText(t);
                  saveAllChanges({ fullInstructions: t });
                }}
                placeholder="Enter assignment requirements, format guidelines, and instructions..."
                placeholderTextColor="#94A3B8"
                multiline={true}
              />
            </View>

            {/* MARK: - Section 3: Points Breakdown & Rubric */}
            <Text style={styles.sectionHeaderTitle}>Points Breakdown</Text>
            <View style={styles.sectionCard}>
              {/* Grade Weight Stepper (Up & Down) */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Grade Weight</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleWeightStep(-5)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>

                  <View style={styles.stepperValueBox}>
                    <Text style={styles.stepperValueText}>{gradeWeightPercent}%</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleWeightStep(5)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
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
                  placeholder="100 Points"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.rowDivider} />

              {/* Rubric Items List */}
              <View style={styles.rubricListContainer}>
                {rubricItems.map((item, idx) => (
                  <View key={`rubric-${idx}`} style={styles.rubricRowCard}>
                    <Text style={styles.itemIndexNumber}>{idx + 1} -</Text>
                    <TextInput
                      style={styles.rubricNameInput}
                      value={item.criterionName}
                      onChangeText={t => handleUpdateCriterionName(idx, t)}
                      placeholder="Criterion title..."
                      placeholderTextColor="#94A3B8"
                    />

                    {/* Percentage Box */}
                    <View style={styles.rubricInputPill}>
                      <TextInput
                        style={styles.rubricNumInput}
                        value={item.percentage != null ? `${item.percentage}` : '0'}
                        keyboardType="numeric"
                        onChangeText={t => handleUpdateCriterionPercentage(idx, t)}
                      />
                      <Text style={styles.rubricUnitLabel}>%</Text>
                    </View>

                    {/* Points Box */}
                    <View style={styles.rubricInputPill}>
                      <TextInput
                        style={styles.rubricNumInput}
                        value={item.points != null ? `${item.points}` : '0'}
                        keyboardType="numeric"
                        onChangeText={t => handleUpdateCriterionPoints(idx, t)}
                      />
                      <Text style={styles.rubricUnitLabel}>pts</Text>
                    </View>

                    {/* Delete Item Button */}
                    <TouchableOpacity
                      onPress={() => handleRemoveRubricItem(idx)}
                      style={styles.deleteIconBtn}
                      activeOpacity={0.7}
                    >
                      <XMarkCircleFillIcon size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Add Rubric Criterion Button */}
              <TouchableOpacity
                onPress={handleAddRubricItem}
                style={styles.addItemBtn}
                activeOpacity={0.7}
              >
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemBtnText}>Add Criterion</Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - Section 4: Resource Link */}
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

            {/* MARK: - Section 5: Notes (Keyboard-Aware, No Giant Bottom Gap) */}
            <Text style={styles.sectionHeaderTitle}>Notes</Text>
            <View style={styles.sectionCard}>
              {noteInputs.map((note, idx) => (
                <View key={`note-${idx}`} style={styles.noteItemCard}>
                  <Text style={styles.itemIndexNumber}>{idx + 1} -</Text>
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
                  >
                    <XMarkCircleFillIcon size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleAddNote}
                style={styles.addItemBtn}
                activeOpacity={0.7}
              >
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemBtnText}>Add Note</Text>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 26,
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
    borderRadius: 10,
    marginBottom: 12
  },
  selectedDateBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2470F5'
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
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  itemIndexNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85'
  },
  rubricNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#141F38'
  },
  rubricInputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 2
  },
  rubricNumInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141F38',
    minWidth: 26,
    textAlign: 'center',
    padding: 0
  },
  rubricUnitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B'
  },
  deleteIconBtn: {
    padding: 2
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 4
  },
  addItemBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2470F5'
  },
  singleFieldInput: {
    fontSize: 14.5,
    color: '#141F38',
    paddingVertical: 4
  },
  openLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
    marginTop: 8
  },
  openLinkPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2470F5'
  },
  noteItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  noteTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#141F38',
    lineHeight: 20,
    padding: 0
  }
});
