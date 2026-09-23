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
  Linking,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Assignment, Course, RubricCriterionDTO } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  XMarkCircleFillIcon,
  PlusCircleFillIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpRightIcon,
  CalendarIcon
} from '../SvgIcons';
import {
  parseSafeDate,
  cleanRubricCriterionName,
  splitInstructionsIntoParagraphs,
  getSanitizedCoursePill
} from '../../utils/readingDisplayHelper';
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
  const pillTitle = getSanitizedCoursePill(assignment.courseCode, matchedCourse);

  // Validate course code to exclude generic labels like "New", "New Assignments", "CRS"
  const isInvalidCourseCode = (code?: string | null) =>
    !code || /^(new|assignment|reading|crs|gen\s*101|details)/i.test(code.trim());

  const validCourseCode = !isInvalidCourseCode(assignment.courseCode)
    ? assignment.courseCode
    : matchedCourse && !isInvalidCourseCode(matchedCourse.courseCode)
    ? matchedCourse.courseCode
    : null;

  const sanitizeTitle = (t?: string | null) => {
    if (!t) return '';
    const trimmed = t.trim();
    return /^\d+$/.test(trimmed) ? '' : trimmed;
  };

  // In-place editable state
  // Helper to resolve fallback points if missing
  const resolveAssignmentPoints = (assign: Assignment): string => {
    if (assign.pointsPossible && assign.pointsPossible.trim()) {
      const ptsTrim = assign.pointsPossible.trim();
      const numM = ptsTrim.match(/\b\d{1,4}\b/);
      if (numM) return `${numM[0]} Points`;
      return ptsTrim;
    }
    if (assign.rubricCriteria && assign.rubricCriteria.length > 0) {
      const sumPts = assign.rubricCriteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
      if (sumPts > 0) return `${sumPts} Points`;
    }
    const combined = `${assign.title || ''} ${assign.fullInstructions || ''} ${assign.noteText || ''}`;
    const match = combined.match(/\b(\d{1,4})\s*(?:points|pts|pt)\b/i);
    if (match) return `${match[1]} Points`;
    return '';
  };

  // Helper to resolve fallback grade weight if missing
  const resolveAssignmentWeight = (assign: Assignment): number | null => {
    if (assign.weightPercentage) {
      const num = parseInt(assign.weightPercentage.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > 0 && num <= 100) return num;
    }
    const combined = `${assign.title || ''} ${assign.fullInstructions || ''} ${assign.noteText || ''}`;
    const match = combined.match(/\b(?:worth\s+|weight:\s*)?(\d{1,2}(?:\.\d+)?)\s*%/i) || combined.match(/\b(\d{1,2})\s*percent\b/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num <= 100) return num;
    }
    return null;
  };

  // In-place editable state
  const [titleText, setTitleText] = useState<string>(() => sanitizeTitle(assignment.title) || 'Assignment');
  const [instructionsText, setInstructionsText] = useState<string>(assignment.fullInstructions || '');
  const [pointsPossibleText, setPointsPossibleText] = useState<string>(() => resolveAssignmentPoints(assignment));
  const [gradeWeightPercent, setGradeWeightPercent] = useState<number | null>(() => resolveAssignmentWeight(assignment));

  // Schedule Toggles
  const [isWeekEnabled, setIsWeekEnabled] = useState<boolean>(assignment.weekNumber > 0);
  const [weekNumber, setWeekNumber] = useState<number>(assignment.weekNumber > 0 ? assignment.weekNumber : 1);
  const [dueDate, setDueDate] = useState<Date | null>(assignment.dueDate ? parseSafeDate(assignment.dueDate) : null);

  // Rubric Items State - truthful extraction only; cleaned of spaced-out header noise
  const [rubricItems, setRubricItems] = useState<RubricCriterionDTO[]>(() => {
    if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
      return assignment.rubricCriteria.map(r => ({
        ...r,
        criterionName: cleanRubricCriterionName(r.criterionName)
      }));
    }
    if (assignment.rubricJSON) {
      try {
        const parsed = JSON.parse(assignment.rubricJSON);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => ({
            ...r,
            criterionName: cleanRubricCriterionName(r.criterionName || r.name || r.title)
          }));
        }
      } catch {}
    }
    return [];
  });

  // Resource Link
  const [mediaUrlText, setMediaUrlText] = useState<string>(assignment.mediaUrl || '');

  // Detected Resource / Video URL (triple checking mediaUrl, noteText, and instructions)
  const detectedUrl = useMemo(() => {
    if (mediaUrlText && mediaUrlText.trim().length > 0) return mediaUrlText.trim();
    if (assignment.mediaUrl && assignment.mediaUrl.trim().length > 0) return assignment.mediaUrl.trim();
    const fromNotes = (assignment.noteText || '').match(/https?:\/\/[^\s)]+/);
    if (fromNotes && !fromNotes[0].includes('simplesyllabus') && !fromNotes[0].includes('error_codes')) {
      return fromNotes[0];
    }
    const fromInstr = (assignment.fullInstructions || instructionsText || '').match(/https?:\/\/[^\s)]+/);
    if (fromInstr && !fromInstr[0].includes('simplesyllabus') && !fromInstr[0].includes('error_codes')) {
      return fromInstr[0];
    }
    return null;
  }, [mediaUrlText, assignment.mediaUrl, assignment.noteText, assignment.fullInstructions, instructionsText]);

  const isYouTube = useMemo(() => {
    if (!detectedUrl) return false;
    return /youtube\.com|youtu\.be/i.test(detectedUrl);
  }, [detectedUrl]);

  // Notes state
  const [noteTextState, setNoteTextState] = useState<string>(assignment.noteText || '');

  const isPresentation = useMemo(() => {
    const t = (titleText || assignment.title || '').toLowerCase();
    const n = (noteTextState || assignment.noteText || '').toLowerCase();
    const inst = (instructionsText || assignment.fullInstructions || '').toLowerCase();
    const sub = (assignment.subTypeRaw || '').toLowerCase();
    return t.includes('presentation') || n.includes('presentation') || sub.includes('presentation') || inst.includes('presentation');
  }, [titleText, assignment.title, noteTextState, assignment.noteText, instructionsText, assignment.fullInstructions, assignment.subTypeRaw]);

  const isGroupPresentation = useMemo(() => {
    const t = (titleText || assignment.title || '').toLowerCase();
    const n = (noteTextState || assignment.noteText || '').toLowerCase();
    const inst = (instructionsText || assignment.fullInstructions || '').toLowerCase();
    return isPresentation && (t.includes('group') || n.includes('group') || inst.includes('small group') || inst.includes('groups'));
  }, [isPresentation, titleText, assignment.title, noteTextState, assignment.noteText, instructionsText, assignment.fullInstructions]);

  const scheduledWeeksList = useMemo(() => {
    if (Array.isArray(assignment.scheduledWeeks) && assignment.scheduledWeeks.length > 0) {
      return assignment.scheduledWeeks;
    }
    const note = assignment.noteText || '';
    const m = note.match(/Weeks?\s*([\d,\s&–-]+)/i);
    if (m) {
      const numbers = m[1].match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
      if (numbers.length > 0) return numbers;
    }
    return assignment.weekNumber > 0 ? [assignment.weekNumber] : [];
  }, [assignment.scheduledWeeks, assignment.noteText, assignment.weekNumber]);

  const isModule = useMemo(() => {
    if (!assignment) return false;
    const a = assignment as any;
    if (a.moduleNumber && a.moduleNumber > 0) return true;
    if (assignment.moduleMention && /\bmod(?:ule)?\b/i.test(assignment.moduleMention)) return true;
    if (assignment.noteText && /\bmod(?:ule)?\s*0*\d+\b/i.test(assignment.noteText)) return true;
    const full = (assignment.fullInstructions || '').toLowerCase();
    if (full.includes('module') && !full.includes('week')) return true;
    return false;
  }, [assignment]);

  const scheduleLabel = isModule ? 'Module' : 'Week';

  // Total rubric points memo
  const totalRubricPoints = useMemo(() => {
    return rubricItems.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  }, [rubricItems]);

  // Memoized read-only instruction paragraphs separated for readability
  const instructionParagraphs = useMemo(() => {
    const raw = assignment?.fullInstructions || instructionsText || '';
    return splitInstructionsIntoParagraphs(raw);
  }, [assignment?.fullInstructions, instructionsText]);

  // Extracted deliverable format (e.g. "6 to 8 pages Paper (APA Format)", "Weekly Case Contributions & Diagnostic Briefs")
  const deliverableFormat = useMemo(() => {
    const note = (assignment?.noteText || noteTextState || '').trim();
    if (note && !note.startsWith('Presentations:') && !note.startsWith('Group Presentations:')) {
      const parts = note.split('·').map(p => p.trim());
      if (parts.length > 1 && parts[1].length > 2) {
        return parts[1];
      }
      if (parts.length > 0 && parts[0].length > 2 && !/^(?:module|mod|week|wk)\s*\d+/i.test(parts[0])) {
        return parts[0];
      }
    }
    const t = (titleText || assignment?.title || '').toLowerCase();
    const inst = (instructionsText || assignment?.fullInstructions || '').toLowerCase();
    const combined = `${t} ${inst} ${note.toLowerCase()}`;

    // Page count paper e.g. "6 to 8 pages", "10–12 pages"
    const pageMatch = combined.match(/(\d{1,2}\s*(?:to|–|-)\s*\d{1,2}\s*pages?|\d{1,2}\+?\s*pages?)/i);
    if (pageMatch && (combined.includes('paper') || combined.includes('report') || combined.includes('essay'))) {
      const isApa = combined.includes('apa');
      return `${pageMatch[1].replace(/\s+/g, ' ')} Paper${isApa ? ' (APA Format)' : ''}`;
    }

    if (t.includes('presentation') || t.includes('role-play') || t.includes('role play') || note.toLowerCase().includes('presentation')) {
      const isGrp = isGroupPresentation || combined.includes('group');
      if (combined.includes('role-play') || combined.includes('role play') || combined.includes('video') || combined.includes('simulat')) {
        return `${isGrp ? 'Group ' : ''}In-Class Role-Play & Simulation`;
      }
      return `${isGrp ? 'Group ' : ''}In-Class Presentation`;
    }

    if (t.includes('peer review')) {
      return combined.includes('group') ? 'Peer Review Group Report' : 'Peer Review Report';
    }

    if (t.includes('case conceptualization')) {
      return combined.includes('in-class') || combined.includes('in class')
        ? 'In-Class Case Conceptualization'
        : 'Case Conceptualization Report';
    }

    if (t.includes('collaboration') || t.includes('participation') || t.includes('attendance')) {
      return 'Continuous In-Person Engagement & Discussion';
    }

    if (combined.includes('exam') || combined.includes('midterm') || combined.includes('final exam')) {
      return 'In-Class Examination';
    }

    if (combined.includes('quiz')) {
      return 'Online Quiz';
    }

    return null;
  }, [assignment?.noteText, noteTextState, titleText, assignment?.title, instructionsText, assignment?.fullInstructions, isGroupPresentation]);

  // Section / Criteria addition state
  const [isAddingSection, setIsAddingSection] = useState<boolean>(false);
  const [newSectionTitle, setNewSectionTitle] = useState<string>('');
  const [newSectionPoints, setNewSectionPoints] = useState<string>('');
  const [newSectionPercentage, setNewSectionPercentage] = useState<string>('');

  // Re-sync ONLY when switching assignment IDs or when modal opens
  useEffect(() => {
    if (!assignment || !visible) return;

    if (currentAssignmentIdRef.current !== assignment.id) {
      currentAssignmentIdRef.current = assignment.id;
      setTitleText(sanitizeTitle(assignment.title) || 'Assignment');
      setInstructionsText(assignment.fullInstructions || '');
      
      const resolvedPts = resolveAssignmentPoints(assignment);
      setPointsPossibleText(resolvedPts);
      
      const resolvedWt = resolveAssignmentWeight(assignment);
      setGradeWeightPercent(resolvedWt);

      const initialWeek = assignment.weekNumber > 0 ? assignment.weekNumber : 1;
      let initialDueDate = assignment.dueDate ? parseSafeDate(assignment.dueDate) : null;
      if (!initialDueDate && assignment.weekNumber > 0 && matchedCourse?.weeks) {
        const w = matchedCourse.weeks.find(wk => wk.weekNumber === assignment.weekNumber);
        if (w?.startDate) {
          initialDueDate = parseSafeDate(w.startDate);
        } else if (w?.dateRangeStr) {
          initialDueDate = parseSafeDate(w.dateRangeStr);
        }
      }

      setIsWeekEnabled(assignment.weekNumber > 0);
      setWeekNumber(initialWeek);
      setDueDate(initialDueDate);

      // Auto-assign any missing points, weight, or due date back to model
      const updatesToSync: Partial<Assignment> = {};
      let hasUpdates = false;
      if (!assignment.pointsPossible && resolvedPts) {
        updatesToSync.pointsPossible = resolvedPts;
        hasUpdates = true;
      }
      if (!assignment.weightPercentage && resolvedWt !== null) {
        updatesToSync.weightPercentage = `${resolvedWt}%`;
        hasUpdates = true;
      }
      if (!assignment.dueDate && initialDueDate) {
        updatesToSync.dueDate = initialDueDate;
        hasUpdates = true;
      }
      if (hasUpdates) {
        onUpdateAssignment({ ...assignment, ...updatesToSync });
      }

      setMediaUrlText(assignment.mediaUrl || '');

      if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
        setRubricItems(assignment.rubricCriteria.map(r => ({
          ...r,
          criterionName: cleanRubricCriterionName(r.criterionName)
        })));
      } else if (assignment.rubricJSON) {
        try {
          const parsed = JSON.parse(assignment.rubricJSON);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRubricItems(parsed.map((r: any) => ({
              ...r,
              criterionName: cleanRubricCriterionName(r.criterionName || r.name || r.title)
            })));
          } else {
            setRubricItems([]);
          }
        } catch {
          setRubricItems([]);
        }
      } else {
        setRubricItems([]);
      }

      setNoteTextState(assignment.noteText || '');
    }
  }, [assignment?.id, visible]);

  // Persist edits to assignment
  const saveAllChanges = (overrides: Partial<Assignment> = {}) => {
    if (!assignment) return;
    const cleanNotes = (overrides.noteText !== undefined ? overrides.noteText : noteTextState)?.trim() || null;
    const rawRubrics = overrides.rubricCriteria !== undefined ? overrides.rubricCriteria : rubricItems;
    const cleanRubrics = rawRubrics
      .filter(r => r.criterionName.trim().length > 0)
      .map(r => ({
        ...r,
        criterionName: cleanRubricCriterionName(r.criterionName)
      }));

    const rawTitle = overrides.title !== undefined ? overrides.title : titleText;
    const validTitle = sanitizeTitle(rawTitle) || sanitizeTitle(assignment.title) || 'Assignment';

    const updated: Assignment = {
      ...assignment,
      title: validTitle,
      fullInstructions: (overrides.fullInstructions !== undefined ? overrides.fullInstructions : instructionsText)?.trim() || null,
      pointsPossible: (overrides.pointsPossible !== undefined ? overrides.pointsPossible : pointsPossibleText)?.trim() || null,
      weightPercentage: gradeWeightPercent !== null ? `${gradeWeightPercent}%` : null,
      weekNumber: isWeekEnabled ? (weekNumber > 0 ? weekNumber : 1) : 0,
      dueDate: dueDate || null,
      mediaUrl: (overrides.mediaUrl !== undefined ? overrides.mediaUrl : mediaUrlText)?.trim() || null,
      noteText: cleanNotes,
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

  // Section / Rubric criteria handlers
  const handleDeleteRubricCriterion = (indexToDelete: number) => {
    const updated = rubricItems.filter((_, idx) => idx !== indexToDelete);
    setRubricItems(updated);
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
    const newPointsText = newTotal > 0 ? `${newTotal} Points` : '';
    setPointsPossibleText(newPointsText);
    saveAllChanges({ rubricCriteria: updated, pointsPossible: newPointsText || null });
  };

  const handleSaveNewSection = () => {
    const trimmedTitle = newSectionTitle.trim();
    if (!trimmedTitle) {
      Alert.alert('Section Title Required', 'Please enter a title for the new section or criterion.');
      return;
    }
    const ptsNum = parseFloat(newSectionPoints.replace(/[^0-9.]/g, '')) || 0;
    const pctNum = newSectionPercentage ? (parseInt(newSectionPercentage.replace(/[^0-9]/g, ''), 10) || null) : null;

    const newItem: RubricCriterionDTO = {
      criterionName: trimmedTitle,
      points: ptsNum,
      percentage: pctNum
    };

    const updated = [...rubricItems, newItem];
    setRubricItems(updated);
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
    const newPointsText = newTotal > 0 ? `${newTotal} Points` : (pointsPossibleText || `${ptsNum} Points`);
    setPointsPossibleText(newPointsText);
    saveAllChanges({ rubricCriteria: updated, pointsPossible: newPointsText || null });

    setNewSectionTitle('');
    setNewSectionPoints('');
    setNewSectionPercentage('');
    setIsAddingSection(false);
  };

  // Toggle Handlers
  const handleToggleWeek = (enabled: boolean) => {
    setIsWeekEnabled(enabled);
    const resolvedWeek = enabled ? (weekNumber > 0 ? weekNumber : 1) : 0;
    if (enabled && weekNumber <= 0) {
      setWeekNumber(1);
    }
    let nextDate = dueDate;
    if (enabled && !dueDate && matchedCourse?.weeks) {
      const w = matchedCourse.weeks.find(wk => wk.weekNumber === (resolvedWeek || 1));
      if (w?.startDate) {
        nextDate = parseSafeDate(w.startDate);
        setDueDate(nextDate);
      } else if (w?.dateRangeStr) {
        nextDate = parseSafeDate(w.dateRangeStr);
        setDueDate(nextDate);
      }
    }
    saveAllChanges({ weekNumber: resolvedWeek, ...(nextDate ? { dueDate: nextDate } : {}) });
  };

  // Stepper for Week
  const handleWeekStep = (delta: number) => {
    const next = Math.max(1, Math.min(52, weekNumber + delta));
    setWeekNumber(next);
    let nextDate = dueDate;
    if (matchedCourse?.weeks) {
      const w = matchedCourse.weeks.find(wk => wk.weekNumber === next);
      if (w?.startDate) {
        nextDate = parseSafeDate(w.startDate);
        setDueDate(nextDate);
      } else if (w?.dateRangeStr) {
        nextDate = parseSafeDate(w.dateRangeStr);
        setDueDate(nextDate);
      }
    }
    saveAllChanges({ weekNumber: next, ...(nextDate ? { dueDate: nextDate } : {}) });
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

  // Note Handler
  const handleUpdateNote = (text: string) => {
    setNoteTextState(text);
    saveAllChanges({ noteText: text });
  };

  const formattedDueDateStr = useMemo(() => {
    let resolvedDate = dueDate;
    if (!resolvedDate && isWeekEnabled && weekNumber > 0 && matchedCourse?.weeks) {
      const w = matchedCourse.weeks.find(wk => wk.weekNumber === weekNumber);
      if (w?.startDate) {
        resolvedDate = parseSafeDate(w.startDate);
      } else if (w?.dateRangeStr) {
        resolvedDate = parseSafeDate(w.dateRangeStr);
      }
    }

    const dateFormatted = resolvedDate
      ? resolvedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : null;

    if (isWeekEnabled && weekNumber > 0) {
      if (dateFormatted) {
        return `${scheduleLabel} ${weekNumber} · ${dateFormatted}`;
      }
      return `${scheduleLabel} ${weekNumber}`;
    }

    if (dateFormatted) {
      return dateFormatted;
    }

    return 'No due date specified';
  }, [dueDate, isWeekEnabled, weekNumber, matchedCourse]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleDone}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navPlaceholder} />

          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitle} numberOfLines={1}>Assignment Details</Text>
          </View>

          <TouchableOpacity
            onPress={handleDone}
            style={styles.doneNavButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneNavText}>Done</Text>
          </TouchableOpacity>
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
              {/* Week / Module Row with Toggle */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Schedule {scheduleLabel}</Text>
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
                    <Text style={styles.rowSubLabel}>Select {scheduleLabel} Number</Text>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleWeekStep(-1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>

                      <View style={styles.stepperValueBox}>
                        <Text style={styles.stepperValueText}>{scheduleLabel} {weekNumber}</Text>
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
                <Text style={styles.dueDateSimpleText}>{formattedDueDateStr}</Text>
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

            {/* MARK: - Section 2: Instructions & Description */}
            <Text style={styles.sectionHeaderTitle}>Instructions & Description</Text>
            <View style={styles.sectionCard}>
              {instructionParagraphs.length > 0 ? (
                instructionParagraphs.map((para, idx) => {
                  const trimmed = para.trim();
                  // Check if paragraph starts with a section label like "• Deadlines & Scheduling:" or "Purpose:"
                  const inlineLabelMatch = trimmed.match(/^([•▪●]?\s*[A-Za-z0-9\s&/–—-]{2,45}[:\-–—])\s*([\s\S]+)$/);
                  const isStandaloneHeader =
                    /^(?:overview|background|description|directions|instructions|requirements|guidelines|format|formatting|submission|evaluation|evaluation\s+criteria|grading\s+criteria|framing\s+questions?|prompt|objectives|purpose|notes?|part\s+\d+|step\s+\d+|phase\s+\d+)[:\-–—]?$/i.test(trimmed);
                  const isBullet = /^[•\-*▪●]|\b\d+[\.)]\s+/.test(trimmed);

                  if (inlineLabelMatch && !isStandaloneHeader) {
                    const labelPart = inlineLabelMatch[1];
                    const contentPart = inlineLabelMatch[2];
                    return (
                      <Text
                        key={`instruction-para-${idx}`}
                        style={[
                          styles.instructionParagraph,
                          isBullet && styles.instructionBulletParagraph,
                          idx === instructionParagraphs.length - 1 && styles.instructionParagraphLast
                        ]}
                        selectable={true}
                      >
                        <Text style={styles.instructionInlineHeader}>{labelPart} </Text>
                        {contentPart}
                      </Text>
                    );
                  }

                  return (
                    <Text
                      key={`instruction-para-${idx}`}
                      style={[
                        styles.instructionParagraph,
                        isStandaloneHeader && styles.instructionHeaderParagraph,
                        isBullet && styles.instructionBulletParagraph,
                        idx === instructionParagraphs.length - 1 && styles.instructionParagraphLast
                      ]}
                      selectable={true}
                    >
                      {para}
                    </Text>
                  );
                })
              ) : (
                <Text style={styles.emptyInstructionsText}>
                  No instructions or description provided in the course syllabus.
                </Text>
              )}
            </View>

            {/* MARK: - Section 3: Points Breakdown & Rubric */}
            <Text style={styles.sectionHeaderTitle}>Points Breakdown</Text>
            <View style={styles.sectionCard}>
              {/* Grade Weight */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Course Grade Weight</Text>
                <View style={styles.weightBadge}>
                  <Text style={styles.weightBadgeText}>
                    {gradeWeightPercent !== null ? `${gradeWeightPercent}%` : 'Unspecified'}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Total Points Row */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Assignment Points</Text>
                <View style={styles.weightBadge}>
                  <Text style={styles.weightBadgeText}>
                    {pointsPossibleText
                      ? (pointsPossibleText.toLowerCase().includes('point') || pointsPossibleText.toLowerCase().includes('pt')
                          ? pointsPossibleText.replace(/Points/i, 'pts').replace(/Pts/i, 'pts')
                          : `${pointsPossibleText} pts`)
                      : (totalRubricPoints > 0 ? `${totalRubricPoints} pts` : 'N/A')}
                  </Text>
                </View>
              </View>

              {rubricItems.length > 0 ? (
                <>
                  <View style={styles.rowDivider} />

                  {/* Rubric Items List - Clean presentation with criterion % and pts in pills */}
                  <View style={styles.rubricListContainer}>
                    {rubricItems.map((item, idx) => {
                      const cleanName = cleanRubricCriterionName(item.criterionName);
                      const displayTitle = cleanName.length > 0
                        ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
                        : (item.criterionName ? item.criterionName.trim().charAt(0).toUpperCase() + item.criterionName.trim().slice(1) : `Criterion ${idx + 1}`);
                      const resolvedPct = item.percentage != null
                        ? item.percentage
                        : (totalRubricPoints > 0 && item.points != null
                          ? Math.round((Number(item.points) / totalRubricPoints) * 100)
                          : null);

                      return (
                        <View key={`rubric-${idx}`} style={styles.rubricRowCard}>
                          <View style={styles.noteIndexBadge}>
                            <Text style={styles.noteIndexBadgeText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.rubricNameInput} numberOfLines={3}>
                            {displayTitle}
                          </Text>
                          <View style={styles.rubricPillsGroup}>
                            {resolvedPct !== null && (
                              <View style={styles.rubricPctBadge}>
                                <Text style={styles.rubricPctBadgeText}>{resolvedPct}%</Text>
                              </View>
                            )}
                            <View style={styles.rubricPointsPill}>
                              <Text style={styles.rubricNumInput}>
                                {item.points != null ? `${item.points}` : '0'}
                              </Text>
                              <Text style={styles.rubricUnitLabel}>pts</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
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

            {/* MARK: - Section 4: Resource / YouTube Link */}
            <Text style={styles.sectionHeaderTitle}>
              {isYouTube ? 'YouTube Video' : 'Resource Link'}
            </Text>
            <View style={styles.sectionCard}>
              {detectedUrl ? (
                <TouchableOpacity
                  style={[styles.resourceLinkCard, isYouTube && styles.youtubeLinkCard]}
                  onPress={() => {
                    const url = detectedUrl.startsWith('http') ? detectedUrl : `https://${detectedUrl}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.resourceLinkLeft}>
                    {isYouTube && (
                      <View style={[styles.resourceTypeBadge, styles.youtubeTypeBadge]}>
                        <Text style={[styles.resourceTypeBadgeText, styles.youtubeTypeBadgeText]}>
                          YouTube
                        </Text>
                      </View>
                    )}
                    <Text style={styles.resourceCardUrlText} numberOfLines={1}>
                      {detectedUrl}
                    </Text>
                  </View>
                  <View style={[styles.openLinkActionPill, isYouTube && styles.youtubeActionPill]}>
                    <Text style={[styles.openLinkActionText, isYouTube && styles.youtubeActionText]}>
                      {isYouTube ? 'Watch Video' : 'Open'}
                    </Text>
                    <ArrowUpRightIcon size={12} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyResourceContainer}>
                  <Text style={styles.emptyResourceText}>No video or resource link attached</Text>
                </View>
              )}
            </View>

            {/* MARK: - Section 5: Assignment Notes */}
            <Text style={styles.sectionHeaderTitle}>Assignment Notes</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={styles.notesInput}
                value={noteTextState}
                onChangeText={handleUpdateNote}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
                placeholder="Take notes, record requirements, key thoughts, or study plans..."
                placeholderTextColor="#94A3B8"
                multiline={true}
                scrollEnabled={false}
              />
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
    alignItems: 'flex-end'
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
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  coursePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  coursePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center'
  },
  dateBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  gradeBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gradeBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  presentationBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  presentationBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  presentationSchedulePill: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  presentationSchedulePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED'
  },
  presentationCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 14,
    marginBottom: 16
  },
  presentationCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  presentationCardIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center'
  },
  presentationCardIconText: {
    fontSize: 18
  },
  presentationCardHeaderTextCol: {
    flex: 1
  },
  presentationCardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5B21B6',
    letterSpacing: -0.2
  },
  presentationCardHeaderSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#7C3AED',
    marginTop: 1
  },
  presentationWeeksRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8
  },
  presentationWeeksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9'
  },
  presentationWeeksPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  presWeekPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE'
  },
  presWeekPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED'
  },
  presWeekPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED'
  },
  presWeekPillTextActive: {
    color: '#FFFFFF'
  },
  videoBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  videoBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
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
  deliverableFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0'
  },
  deliverableFormatHeaderBadge: {
    backgroundColor: 'rgba(36, 112, 245, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(36, 112, 245, 0.20)',
    maxWidth: 220
  },
  deliverableFormatHeaderBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue,
    letterSpacing: 0.3
  },
  deliverableFormatBadge: {
    backgroundColor: 'rgba(36, 112, 245, 0.10)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  deliverableFormatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue,
    letterSpacing: 0.4
  },
  deliverableFormatValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
  dueDateSimpleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12
  },
  multilineInstructionsInput: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#243048',
    lineHeight: 22,
    minHeight: 80,
    paddingTop: 0
  },
  instructionParagraph: {
    fontSize: 15,
    fontWeight: '400',
    color: '#1E293B',
    lineHeight: 24,
    marginBottom: 16
  },
  instructionInlineHeader: {
    fontWeight: '700',
    color: '#0F172A'
  },
  instructionHeaderParagraph: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 8
  },
  instructionBulletParagraph: {
    paddingLeft: 8,
    lineHeight: 23,
    marginBottom: 12
  },
  instructionParagraphLast: {
    marginBottom: 0
  },
  emptyInstructionsText: {
    fontSize: 13.5,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 20,
    paddingVertical: 4
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
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  rubricPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
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
  deleteRubricBtn: {
    padding: 6,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addSectionPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed'
  },
  addSectionPillButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2470F5'
  },
  addSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10
  },
  addSectionCardHeader: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B'
  },
  newSectionTitleInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B'
  },
  newSectionInputsRow: {
    flexDirection: 'row',
    gap: 10
  },
  newSectionInputWrapper: {
    flex: 1
  },
  newSectionFieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4
  },
  newSectionPointsInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B'
  },
  addSectionActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4
  },
  cancelAddSectionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#E2E8F0'
  },
  cancelAddSectionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  confirmAddSectionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#2470F5'
  },
  confirmAddSectionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
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
    backgroundColor: '#2470F5',
    padding: 8,
    borderRadius: 8,
    marginTop: 6
  },
  openLinkPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF'
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
    backgroundColor: '#2470F5',
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 2
  },
  addNotePillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  emptyRubricContainer: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyRubricText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
    fontStyle: 'normal'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 2
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1
  },
  instructionsFormatPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    maxWidth: '52%'
  },
  instructionsFormatPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.2
  },
  instructionsFormatCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  formatBadgeBubble: {
    backgroundColor: '#475569',
    paddingHorizontal: 6.5,
    paddingVertical: 2.5,
    borderRadius: 5
  },
  formatBadgeBubbleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  instructionsFormatCalloutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1
  },
  sectionHeaderTitleInline: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  notesInput: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0F172A',
    lineHeight: 22,
    minHeight: 90,
    paddingTop: 0
  },
  pointsExplanatoryRow: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6
  },
  pointsExplanatoryText: {
    fontSize: 12.5,
    color: '#1E40AF',
    lineHeight: 18
  },
  pointsExplanatoryBold: {
    fontWeight: '700',
    color: '#1D4ED8'
  },
  rubricPctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 42,
    justifyContent: 'center'
  },
  rubricPctBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#141F38'
  },
  resourceLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8
  },
  youtubeLinkCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3'
  },
  resourceLinkLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  resourceTypeBadge: {
    backgroundColor: '#2470F5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  youtubeTypeBadge: {
    backgroundColor: '#E11D48'
  },
  resourceTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  youtubeTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  resourceCardUrlText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#334155'
  },
  openLinkActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2470F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  youtubeActionPill: {
    backgroundColor: '#E11D48'
  },
  openLinkActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  youtubeActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  emptyResourceContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyResourceText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
    fontStyle: 'normal'
  }
});
