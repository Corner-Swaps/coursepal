/**
 * ReadingDetailModal
 * 1:1 Parity with native Swift EditReadingSheet in WeeklyDashboardView.swift
 * Visual layout matching media_1788659537240.png
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
  Keyboard,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Reading, Course, MediaType } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  XMarkCircleFillIcon,
  PlusCircleFillIcon
} from '../SvgIcons';
import { cleanChapterFromRaw, parseSafeDate, formatDisplayTitleWithChapter } from '../../utils/readingDisplayHelper';
import { InlineCalendarPicker } from '../InlineCalendarPicker';

export interface ReadingDetailModalProps {
  visible: boolean;
  reading: Reading | null;
  courses: Course[];
  onClose: () => void;
  onSave?: (updated: Reading) => void;
  onToggleComplete?: (id: string) => void;
  onDeleteReading?: (id: string) => void;
}

export const ReadingDetailModal: React.FC<ReadingDetailModalProps> = ({
  visible,
  reading,
  courses,
  onClose,
  onSave,
  onToggleComplete,
  onDeleteReading
}) => {
  if (!reading) return null;

  const [courseNameInput, setCourseNameInput] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [moduleInput, setModuleInput] = useState<string>('');
  const [hasDueDate, setHasDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [chapterInput, setChapterInput] = useState<string>('');
  const [topicInputs, setTopicInputs] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>('textbook');
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [noteInputs, setNoteInputs] = useState<string[]>([]);

  const matchedCourse = courses.find(
    c => (c.courseCode || c.courseName).toLowerCase() === (reading.courseCode || '').toLowerCase()
  );

  useEffect(() => {
    if (reading) {
      setCourseNameInput(matchedCourse?.courseName || reading.courseCode || 'New');

      // Derive week number
      let derivedW = 1;
      if (reading.weekId) {
        const m = reading.weekId.match(/\d+/);
        if (m) derivedW = parseInt(m[0], 10);
      } else if (reading.relevantTopics) {
        const m = reading.relevantTopics.match(/Week\s*(\d+)/i);
        if (m) derivedW = parseInt(m[1], 10);
      }
      setWeekNumber(derivedW);

      setModuleInput(reading.relevantTopics && reading.relevantTopics.toLowerCase().includes('module') ? reading.relevantTopics : '');
      setHasDueDate(reading.dueDate != null);
      setDueDate(parseSafeDate(reading.dueDate) || new Date());

      const chDisplay = reading.chapterText || '';
      setChapterInput(chDisplay);

      const topics = (reading.relevantTopics || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && !t.toLowerCase().startsWith('week') && !t.toLowerCase().startsWith('mod'));
      setTopicInputs(topics.length > 0 ? topics : [reading.title]);

      setMediaType(reading.mediaType || 'textbook');
      setVideoUrlInput(reading.videoUrl || '');

      const notes = (reading.summaryText || '')
        .split('\n')
        .map(n => n.replace(/^[•\-\*▪●]\s*/, '').trim())
        .filter(n => n.length > 0);
      setNoteInputs(notes);
    }
  }, [reading, courses]);

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
    const cleanedChapter = cleanChapterFromRaw(chapterInput.trim()) || chapterInput.trim() || undefined;
    const updated: Reading = {
      ...reading,
      chapterText: cleanedChapter,
      relevantTopics: topicInputs.filter(t => t.trim().length > 0).join(', ') || undefined,
      mediaType: mediaType,
      videoUrl: videoUrlInput.trim() || undefined,
      dueDate: hasDueDate ? dueDate : null,
      summaryText: noteInputs.filter(n => n.trim().length > 0).join('\n')
    };
    if (onSave) {
      onSave(updated);
    }
    onClose();
  };

  const formattedDate = dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* MARK: - Top Navigation Bar Matching iOS Details Sheet */}
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
          keyboardDismissMode="on-drag"
          nestedScrollEnabled={true}
          alwaysBounceVertical={true}
          bounces={true}
          showsVerticalScrollIndicator={true}
        >
            {/* MARK: - Section 1: Course Name */}
            <View style={styles.sectionCard}>
              <Text style={styles.captionLabel}>Course Name</Text>
              <TextInput
                style={styles.courseNameInput}
                value={courseNameInput}
                onChangeText={setCourseNameInput}
                placeholder="Enter course name..."
                placeholderTextColor="#8E9BAE"
              />
            </View>

            {/* MARK: - Section 2: Schedule */}
            <Text style={styles.sectionHeaderTitle}>Schedule</Text>
            <View style={styles.sectionCard}>
              {/* Week Row with Toggle / Stepper */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Week</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setWeekNumber(prev => Math.max(1, prev - 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>

                  <View style={styles.stepperValueBox}>
                    <Text style={styles.stepperValueText}>Week {weekNumber}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setWeekNumber(prev => Math.min(52, prev + 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Module Row */}
              <View style={styles.formRow}>
                <TextInput
                  style={styles.rowFullInput}
                  value={moduleInput}
                  onChangeText={setModuleInput}
                  placeholder="Module"
                  placeholderTextColor="#B0BAC9"
                />
              </View>

              <View style={styles.rowDivider} />

              {/* Due Date Row with Switch */}
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Due Date</Text>
                <Switch
                  value={hasDueDate}
                  onValueChange={v => {
                    setHasDueDate(v);
                    if (!v) setShowCalendar(false);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Select Date Row (if Due Date is on) */}
              {hasDueDate && (
                <>
                  <View style={styles.rowDivider} />
                  <TouchableOpacity
                    style={styles.formRow}
                    onPress={() => setShowCalendar(prev => !prev)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rowLabel}>Select Date</Text>
                    <View style={styles.dateCapsuleInteractive}>
                      <Text style={styles.dateCapsuleText}>{formattedDate}</Text>
                      <Text style={styles.dateCapsuleAction}>{showCalendar ? 'Done' : 'Change'}</Text>
                    </View>
                  </TouchableOpacity>

                  {showCalendar && (
                    <InlineCalendarPicker
                      selectedDate={dueDate}
                      onSelectDate={d => {
                        setDueDate(d);
                      }}
                    />
                  )}
                </>
              )}
            </View>

            {/* MARK: - Section 3: Chapter & Pages */}
            <Text style={styles.sectionHeaderTitle}>Chapter & Pages</Text>
            <View style={styles.sectionCardSingle}>
              <TextInput
                style={styles.singleFieldInput}
                value={chapterInput}
                onChangeText={setChapterInput}
                placeholder="e.g. Chapter 4, pp. 120-155"
                placeholderTextColor="#8E9BAE"
              />
            </View>

            {/* MARK: - Section 4: Topics */}
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
                    multiline
                  />
                  {topic.length > 0 && (
                    <TouchableOpacity onPress={() => handleRemoveTopic(idx)} style={styles.removeTopicButton}>
                      <XMarkCircleFillIcon size={16} color="#B0BAC9" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity onPress={handleAddTopic} style={styles.addItemButton} activeOpacity={0.7}>
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemButtonText}>Add Topic</Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - Section 5: Media Type (Compact Pills) */}
            <Text style={styles.sectionHeaderTitle}>Media Type</Text>
            <View style={styles.mediaTypeRow}>
              {(['textbook', 'article', 'video', 'podcast'] as MediaType[]).map(t => {
                const isSelected = mediaType === t;
                const label =
                  t === 'textbook'
                    ? 'Textbook'
                    : t === 'article'
                    ? 'Article'
                    : t === 'video'
                    ? 'Video'
                    : 'Podcast';
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.mediaTypePill, isSelected && styles.mediaTypePillActive]}
                    onPress={() => setMediaType(t)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.mediaTypePillText,
                        isSelected && styles.mediaTypePillTextActive
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* MARK: - Section 6: Resource Link */}
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

            {/* MARK: - Section 7: Notes */}
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
                      <XMarkCircleFillIcon size={16} color="#B0BAC9" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity onPress={handleAddNote} style={styles.addItemButton} activeOpacity={0.7}>
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
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
  captionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    marginBottom: 6,
    letterSpacing: 0.5
  },
  courseNameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#081324',
    paddingVertical: 4
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
    fontWeight: '600',
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
  rowValueInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#081324',
    textAlign: 'right',
    minWidth: 40,
    paddingVertical: 0
  },
  rowFullInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#081324',
    paddingVertical: 4
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4
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
  topicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 10
  },
  topicPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#596B85',
    marginTop: 2
  },
  topicInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#081324',
    paddingVertical: 2
  },
  removeTopicButton: {
    padding: 6,
    marginTop: 2
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 6
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  stepperBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue,
    lineHeight: 19
  },
  stepperValueBox: {
    paddingHorizontal: 12
  },
  stepperValueText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#081324'
  },
  dateCapsuleInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  dateCapsuleAction: {
    fontSize: 12,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  mediaTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2
  },
  mediaTypePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  mediaTypePillActive: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderColor: CoursePalTheme.accentBlue
  },
  mediaTypePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85'
  },
  mediaTypePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  noteItemCard: {
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginVertical: 6,
    minHeight: 88
  },
  noteItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  noteTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#081324',
    lineHeight: 22,
    paddingVertical: 0
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 6
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
