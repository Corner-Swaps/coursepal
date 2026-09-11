/**
 * ReadingDetailModal
 * In-place editable Reading Details with reliable Schedule toggles,
 * chapter/pages, media type, resource link, and clean keyboard-aware notes.
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
import { Reading, Course, MediaType } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  XMarkCircleFillIcon,
  PlusCircleFillIcon,
  CalendarIcon,
  ArrowUpRightIcon,
  BookFillIcon
} from '../SvgIcons';
import { cleanChapterFromRaw, parseSafeDate } from '../../utils/readingDisplayHelper';
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
  onSave
}) => {
  if (!reading) return null;

  const scrollViewRef = useRef<ScrollView>(null);
  const currentReadingIdRef = useRef<string | null>(null);

  const matchedCourse = courses.find(
    c => (c.courseCode || c.courseName).toLowerCase() === (reading.courseCode || '').toLowerCase()
  );

  const courseColor = matchedCourse ? matchedCourse.hexColor : CoursePalTheme.accentBlue;

  // Validate course code to exclude generic labels
  const isInvalidCourseCode = (code?: string | null) =>
    !code || /^(new|assignment|reading|crs|gen\s*101|details)/i.test(code.trim());

  const validCourseCode = !isInvalidCourseCode(reading.courseCode)
    ? reading.courseCode
    : matchedCourse && !isInvalidCourseCode(matchedCourse.courseCode)
    ? matchedCourse.courseCode
    : null;

  // State
  const [titleText, setTitleText] = useState<string>(reading.title || '');

  // Schedule Toggles
  const [isWeekEnabled, setIsWeekEnabled] = useState<boolean>(true);
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [isModuleEnabled, setIsModuleEnabled] = useState<boolean>(false);
  const [moduleInput, setModuleInput] = useState<string>('');
  const [hasDueDate, setHasDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<Date>(new Date());

  const [chapterInput, setChapterInput] = useState<string>('');
  const [topicInputs, setTopicInputs] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>('textbook');
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [noteInputs, setNoteInputs] = useState<string[]>([]);

  // Derive chapter text for pill (e.g. "Chapter 4" or "Ch. 3")
  const derivedChapter = useMemo(() => {
    if (chapterInput.trim().length > 0) {
      return chapterInput.trim();
    }
    if (reading.chapterText && reading.chapterText.trim().length > 0) {
      return cleanChapterFromRaw(reading.chapterText) || reading.chapterText.trim();
    }
    const cleanFromTitle = cleanChapterFromRaw(reading.title);
    if (cleanFromTitle) return cleanFromTitle;
    return null;
  }, [chapterInput, reading.chapterText, reading.title]);

  // Re-sync ONLY when switching reading IDs or when modal opens
  useEffect(() => {
    if (!reading || !visible) return;

    if (currentReadingIdRef.current !== reading.id) {
      currentReadingIdRef.current = reading.id;
      setTitleText(reading.title || '');

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
      setIsWeekEnabled(derivedW > 0);

      const modText = reading.relevantTopics && reading.relevantTopics.toLowerCase().includes('module')
        ? reading.relevantTopics
        : '';
      setModuleInput(modText);
      setIsModuleEnabled(modText.trim().length > 0);

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
  }, [reading?.id, visible]);

  const saveAllChanges = (overrides: Partial<Reading> = {}) => {
    if (!reading) return;
    const cleanedChapter = cleanChapterFromRaw(chapterInput.trim()) || chapterInput.trim() || undefined;
    const cleanTopics = topicInputs.filter(t => t.trim().length > 0).join(', ');
    const cleanNotes = noteInputs.filter(n => n.trim().length > 0).join('\n');

    const updated: Reading = {
      ...reading,
      title: titleText.trim() || reading.title,
      chapterText: cleanedChapter,
      relevantTopics: isModuleEnabled && moduleInput.trim().length > 0
        ? moduleInput.trim()
        : cleanTopics || undefined,
      mediaType: mediaType,
      mediaTypeRaw: mediaType,
      videoUrl: videoUrlInput.trim() || undefined,
      dueDate: hasDueDate ? dueDate : undefined,
      weekId: isWeekEnabled ? `w-${weekNumber}` : undefined,
      summaryText: cleanNotes,
      ...overrides
    };

    if (onSave) {
      onSave(updated);
    }
  };

  const handleDone = () => {
    saveAllChanges();
    currentReadingIdRef.current = null;
    onClose();
  };

  // Toggle Handlers
  const handleToggleWeek = (enabled: boolean) => {
    setIsWeekEnabled(enabled);
    saveAllChanges({ weekId: enabled ? `w-${weekNumber}` : undefined });
  };

  const handleToggleModule = (enabled: boolean) => {
    setIsModuleEnabled(enabled);
    saveAllChanges({ relevantTopics: enabled ? (moduleInput.trim() || 'Module 1') : undefined });
  };

  const handleToggleDueDate = (enabled: boolean) => {
    setHasDueDate(enabled);
    saveAllChanges({ dueDate: enabled ? dueDate : undefined });
  };

  const handleWeekStep = (delta: number) => {
    const next = Math.max(1, Math.min(52, weekNumber + delta));
    setWeekNumber(next);
    saveAllChanges({ weekId: `w-${next}` });
  };

  // Topics Handlers
  const handleAddTopic = () => {
    setTopicInputs(prev => [...prev, '']);
  };

  const handleRemoveTopic = (idx: number) => {
    const updated = topicInputs.filter((_, i) => i !== idx);
    setTopicInputs(updated);
    saveAllChanges({ relevantTopics: updated.join(', ') });
  };

  const handleUpdateTopic = (idx: number, text: string) => {
    const updated = topicInputs.map((t, i) => (i === idx ? text : t));
    setTopicInputs(updated);
    saveAllChanges({ relevantTopics: updated.join(', ') });
  };

  // Notes Handlers
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
    saveAllChanges({ summaryText: updated.join('\n') });
  };

  const handleUpdateNote = (idx: number, text: string) => {
    const updated = noteInputs.map((n, i) => (i === idx ? text : n));
    setNoteInputs(updated);
    saveAllChanges({ summaryText: updated.join('\n') });
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
            <Text style={styles.navTitle} numberOfLines={1}>Reading Details</Text>
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
                  style={styles.readingTitleInput}
                  value={titleText}
                  onChangeText={t => {
                    setTitleText(t);
                    saveAllChanges({ title: t });
                  }}
                  placeholder="Reading Title"
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
                <Text style={styles.rowLabel}>Module / Topic</Text>
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
                      value={moduleInput}
                      onChangeText={t => {
                        setModuleInput(t);
                        saveAllChanges({ relevantTopics: t.trim() || undefined });
                      }}
                      placeholder="e.g. Module 1: Foundations"
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

            {/* MARK: - Section 2: Chapter & Pages */}
            <Text style={styles.sectionHeaderTitle}>Chapter & Pages</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={styles.singleFieldInput}
                value={chapterInput}
                onChangeText={t => {
                  setChapterInput(t);
                  saveAllChanges({ chapterText: t.trim() || undefined });
                }}
                placeholder="e.g. Chapter 4, pp. 120-155"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* MARK: - Section 3: Topics */}
            <Text style={styles.sectionHeaderTitle}>Topics</Text>
            <View style={styles.sectionCard}>
              {topicInputs.map((topic, idx) => (
                <View key={`topic-${idx}`} style={styles.topicRow}>
                  <Text style={styles.itemIndexNumber}>{idx + 1} -</Text>
                  <TextInput
                    style={styles.topicInput}
                    value={topic}
                    onChangeText={t => handleUpdateTopic(idx, t)}
                    placeholder="Topic description..."
                    placeholderTextColor="#94A3B8"
                    multiline={true}
                  />
                  {topicInputs.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveTopic(idx)}
                      style={styles.deleteIconBtn}
                      activeOpacity={0.7}
                    >
                      <XMarkCircleFillIcon size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={handleAddTopic}
                style={styles.addItemBtn}
                activeOpacity={0.7}
              >
                <PlusCircleFillIcon size={16} color={CoursePalTheme.accentBlue} />
                <Text style={styles.addItemBtnText}>Add Topic</Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - Section 4: Media Type */}
            <Text style={styles.sectionHeaderTitle}>Media Type</Text>
            <View style={styles.mediaTypePillsRow}>
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
                    onPress={() => {
                      setMediaType(t);
                      saveAllChanges({ mediaType: t, mediaTypeRaw: t });
                    }}
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

            {/* MARK: - Section 5: Resource Link */}
            <Text style={styles.sectionHeaderTitle}>Resource Link</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={styles.singleFieldInput}
                value={videoUrlInput}
                onChangeText={t => {
                  setVideoUrlInput(t);
                  saveAllChanges({ videoUrl: t.trim() || undefined });
                }}
                placeholder="Paste reference link or video URL..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="url"
              />

              {videoUrlInput.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.openLinkPill}
                  onPress={() => {
                    const url = videoUrlInput.startsWith('http') ? videoUrlInput : `https://${videoUrlInput}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <ArrowUpRightIcon size={13} color="#2470F5" />
                  <Text style={styles.openLinkPillText} numberOfLines={1}>
                    Open {videoUrlInput}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* MARK: - Section 6: Notes (Keyboard-Aware, No Giant Bottom Gap) */}
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
                    placeholder="Add personal note or key takeaway..."
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
  mediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4
  },
  mediaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2470F5'
  },
  titleSection: {
    marginBottom: 4
  },
  readingTitleInput: {
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
  singleFieldInput: {
    fontSize: 14.5,
    color: '#141F38',
    paddingVertical: 4
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  itemIndexNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85'
  },
  topicInput: {
    flex: 1,
    fontSize: 14,
    color: '#141F38',
    padding: 0
  },
  deleteIconBtn: {
    padding: 2
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 4
  },
  addItemBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2470F5'
  },
  mediaTypePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  mediaTypePill: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  mediaTypePillActive: {
    backgroundColor: '#2470F5',
    borderColor: '#2470F5'
  },
  mediaTypePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85'
  },
  mediaTypePillTextActive: {
    color: '#FFFFFF'
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
