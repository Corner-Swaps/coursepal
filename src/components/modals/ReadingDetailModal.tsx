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
  ArrowUpRightIcon,
  BookFillIcon,
  CalendarIcon
} from '../SvgIcons';
import {
  cleanChapterFromRaw,
  formatDisplayTitleWithChapter,
  isReadingWeekEnabled,
  extractReadingWeekNumber,
  discoverReadingTopics,
  parseSafeDate,
  resolveReadingMediaType,
  isGenericPlaceholderTheme
} from '../../utils/readingDisplayHelper';
import { InlineCalendarPicker } from '../InlineCalendarPicker';

export interface ReadingDetailModalProps {
  visible: boolean;
  reading: Reading | null;
  courses: Course[];
  onClose: () => void;
  onSave?: (updated: Reading) => void;
  onToggleComplete?: (id: string) => void;
  onDeleteReading?: (id: string) => void;
  viewMode?: 'weeks' | 'modules';
}

export const ReadingDetailModal: React.FC<ReadingDetailModalProps> = ({
  visible,
  reading,
  courses,
  onClose,
  onSave,
  viewMode
}) => {
  if (!reading) return null;

  const scrollViewRef = useRef<ScrollView>(null);
  const currentReadingIdRef = useRef<string | null>(null);

  const matchedCourse = courses.find(
    c => (c.courseCode || c.courseName).toLowerCase() === (reading.courseCode || '').toLowerCase()
  );

  // Validate course code to exclude generic labels
  const isInvalidCourseCode = (code?: string | null) =>
    !code || /^(new|assignment|reading|crs|gen\s*101|details)/i.test(code.trim());

  const validCourseCode = !isInvalidCourseCode(reading.courseCode)
    ? reading.courseCode
    : matchedCourse && !isInvalidCourseCode(matchedCourse.courseCode)
    ? matchedCourse.courseCode
    : null;

  const deriveInitialTitle = (r: Reading): string => {
    return formatDisplayTitleWithChapter(
      r,
      r.chapterText,
      r.resourceTitle,
      matchedCourse?.courseName,
      r.authorName
    );
  };

  // State
  const [titleText, setTitleText] = useState<string>(() => deriveInitialTitle(reading));

  // Helper to resolve fallback suggested date
  const resolveSuggestedDate = (r: Reading | null): Date | null => {
    if (!r) return null;
    if (r.dueDate) {
      const parsed = parseSafeDate(r.dueDate);
      if (parsed && !isNaN(parsed.getTime())) return parsed;
    }
    if (r.dateRangeStr) {
      const parsed = parseSafeDate(r.dateRangeStr);
      if (parsed && !isNaN(parsed.getTime())) return parsed;
    }
    if (matchedCourse?.weeks && (r.weekNumber || 0) > 0) {
      const w = matchedCourse.weeks.find(wk => wk.weekNumber === r.weekNumber);
      if (w?.startDate) {
        const parsed = parseSafeDate(w.startDate);
        if (parsed && !isNaN(parsed.getTime())) return parsed;
      }
      if (w?.dateRangeStr) {
        const parsed = parseSafeDate(w.dateRangeStr);
        if (parsed && !isNaN(parsed.getTime())) return parsed;
      }
    }
    return null;
  };

  // Schedule Week (always visible stepper; 0 = No Week / Unassigned)
  const [weekNumber, setWeekNumber] = useState<number>(() => {
    const isWeekOn = isReadingWeekEnabled(reading);
    if (!isWeekOn) return 0;
    const extracted = extractReadingWeekNumber(reading);
    return extracted != null ? extracted : 1;
  });

  // Schedule Module (always visible stepper; 0 = No Module / Unassigned)
  const [moduleNumber, setModuleNumber] = useState<number>(() => {
    if (reading?.moduleNumber != null && reading.moduleNumber > 0) return reading.moduleNumber;
    if (reading?.moduleMention) {
      const m = reading.moduleMention.match(/\d+/);
      if (m) return parseInt(m[0], 10);
    }
    return 0;
  });

  const [chapterInput, setChapterInput] = useState<string>(() => reading?.chapterText || '');
  const [pagesInput, setPagesInput] = useState<string>(() => reading?.pagesText || '');
  const [authorInput, setAuthorInput] = useState<string>(() => reading?.authorName || '');
  const [topicInputs, setTopicInputs] = useState<string[]>(() =>
    reading ? discoverReadingTopics(reading, courses) : []
  );
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(() =>
    resolveSuggestedDate(reading)
  );
  const [mediaType, setMediaType] = useState<MediaType>(() => resolveReadingMediaType(reading));
  const [isRequired, setIsRequired] = useState<boolean>(() =>
    reading ? (reading.isRequired !== false && reading.requirementType !== 'optional') : true
  );
  const [requirementType, setRequirementType] = useState<'required' | 'optional'>(() =>
    reading && (reading.isRequired === false || reading.requirementType === 'optional') ? 'optional' : 'required'
  );
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [noteInputs, setNoteInputs] = useState<string[]>(() => {
    return (reading?.summaryText || '')
      .split('\n')
      .map(n => n.replace(/^[•\-\*▪●]\s*/, '').trim())
      .filter(n => n.length > 0)
      .filter(n => !/^Study\s+(?:Chapter|Module|Ch\.)/i.test(n) && !/^Assigned reading for/i.test(n));
  });

  const effectiveViewMode: 'weeks' | 'modules' = useMemo(() => {
    if (viewMode) return viewMode;
    if (reading?.moduleNumber && !reading?.weekNumber) return 'modules';
    return 'weeks';
  }, [viewMode, reading?.moduleNumber, reading?.weekNumber]);

  const resolvedTopic = useMemo(() => {
    if (reading?.relevantTopics && reading.relevantTopics.trim().length > 0 && !isGenericPlaceholderTheme(reading.relevantTopics)) {
      return reading.relevantTopics.trim();
    }
    if (topicInputs && topicInputs.length > 0) {
      const clean = topicInputs.filter(t => t.trim().length > 0 && !isGenericPlaceholderTheme(t));
      if (clean.length > 0) return clean.join(', ');
    }
    const matchedWeek = reading?.weekNumber
      ? matchedCourse?.weeks?.find(w => w.weekNumber === reading.weekNumber)
      : null;
    if (matchedWeek?.theme && !isGenericPlaceholderTheme(matchedWeek.theme)) {
      return matchedWeek.theme;
    }
    return null;
  }, [reading?.relevantTopics, topicInputs, reading?.weekNumber, matchedCourse]);

  // Detected Resource / Video URL
  const detectedUrl = useMemo(() => {
    if (videoUrlInput && videoUrlInput.trim().length > 0) return videoUrlInput.trim();
    if (reading.videoUrl && reading.videoUrl.trim().length > 0) return reading.videoUrl.trim();
    const fromTitle = (reading.title || '').match(/https?:\/\/[^\s)]+/);
    if (fromTitle) return fromTitle[0];
    return null;
  }, [videoUrlInput, reading.videoUrl, reading.title]);

  const isYouTube = useMemo(() => {
    if (!detectedUrl) return false;
    return /youtube\.com|youtu\.be/i.test(detectedUrl);
  }, [detectedUrl]);

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
      setTitleText(deriveInitialTitle(reading));

      // Derive week number: 0 if no week, otherwise 1..52
      const isWeekOn = isReadingWeekEnabled(reading);
      const parsedWeekNum = extractReadingWeekNumber(reading);
      setWeekNumber(isWeekOn && parsedWeekNum != null ? parsedWeekNum : 0);

      const resolvedMod = reading.moduleNumber != null && reading.moduleNumber > 0
        ? reading.moduleNumber
        : (reading.moduleMention ? parseInt(reading.moduleMention.replace(/\D+/g, ''), 10) || 0 : 0);
      setModuleNumber(resolvedMod);

      const chDisplay = reading.chapterText || '';
      setChapterInput(chDisplay);
      setPagesInput(reading.pagesText || '');
      setAuthorInput(reading.authorName || '');

      const realTopics = discoverReadingTopics(reading, courses);
      setTopicInputs(realTopics);

      setSuggestedDate(resolveSuggestedDate(reading));

      setMediaType(resolveReadingMediaType(reading));
      const isReq = reading.isRequired !== false && reading.requirementType !== 'optional';
      setIsRequired(isReq);
      setRequirementType(isReq ? 'required' : 'optional');
      setVideoUrlInput(reading.videoUrl || '');

      const notes = (reading.summaryText || '')
        .split('\n')
        .map(n => n.replace(/^[•\-\*▪●]\s*/, '').trim())
        .filter(n => n.length > 0)
        .filter(n => !/^Study\s+(?:Chapter|Module|Ch\.)/i.test(n) && !/^Assigned reading for/i.test(n));
      setNoteInputs(notes);
    }
  }, [reading?.id, reading?.mediaType, reading?.mediaTypeRaw, reading?.isRequired, reading?.requirementType, visible, courses]);

  // Reset ref when modal is dismissed so reopening always re-syncs
  useEffect(() => {
    if (!visible) {
      currentReadingIdRef.current = null;
    }
  }, [visible]);

  const saveAllChanges = (overrides: Partial<Reading> = {}) => {
    if (!reading) return;
    const cleanedChapter = cleanChapterFromRaw(chapterInput.trim()) || chapterInput.trim() || undefined;
    const cleanPages = pagesInput.trim() || undefined;
    const cleanTopics = topicInputs
      .filter(t => t.trim().length > 0)
      .filter(t => weekNumber > 0 || !/^week\s*\d+$/i.test(t.trim()))
      .join(', ');
    const cleanNotes = noteInputs.filter(n => n.trim().length > 0).join('\n');

    const updated: Reading = {
      ...reading,
      title: titleText.trim() || reading.title,
      chapterText: cleanedChapter,
      pagesText: cleanPages,
      authorName: authorInput.trim() || undefined,
      relevantTopics: cleanTopics || undefined,
      dueDate: suggestedDate,
      dateRangeStr: reading.dateRangeStr,
      mediaType: mediaType,
      mediaTypeRaw: mediaType,
      videoUrl: videoUrlInput.trim() || undefined,
      weekId: weekNumber > 0 ? `w-${weekNumber}` : undefined,
      weekNumber: weekNumber > 0 ? weekNumber : 0,
      moduleNumber: moduleNumber > 0 ? moduleNumber : null,
      moduleMention: moduleNumber > 0 ? `Module ${moduleNumber}` : null,
      summaryText: cleanNotes,
      isRequired: isRequired,
      requirementType: requirementType,
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

  const handleWeekStep = (delta: number) => {
    const next = Math.max(0, Math.min(52, weekNumber + delta));
    setWeekNumber(next);
    let nextDate = suggestedDate;
    if (next > 0 && !suggestedDate && matchedCourse?.weeks) {
      const w = matchedCourse.weeks.find(wk => wk.weekNumber === next);
      if (w?.startDate) {
        nextDate = parseSafeDate(w.startDate);
        setSuggestedDate(nextDate);
      } else if (w?.dateRangeStr) {
        nextDate = parseSafeDate(w.dateRangeStr);
        setSuggestedDate(nextDate);
      }
    }
    saveAllChanges({
      weekId: next > 0 ? `w-${next}` : undefined,
      weekNumber: next,
      ...(nextDate ? { dueDate: nextDate } : {})
    });
  };

  const handleModuleStep = (delta: number) => {
    const next = Math.max(0, Math.min(52, moduleNumber + delta));
    setModuleNumber(next);
    let nextDate = suggestedDate;
    if (next > 0 && !suggestedDate && matchedCourse?.weeks) {
      const w = matchedCourse.weeks.find(wk => wk.weekNumber === next);
      if (w?.startDate) {
        nextDate = parseSafeDate(w.startDate);
        setSuggestedDate(nextDate);
      } else if (w?.dateRangeStr) {
        nextDate = parseSafeDate(w.dateRangeStr);
        setSuggestedDate(nextDate);
      }
    }
    saveAllChanges({
      moduleNumber: next > 0 ? next : null,
      moduleMention: next > 0 ? `Module ${next}` : null,
      ...(nextDate ? { dueDate: nextDate } : {})
    });
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDone}
      onDismiss={() => {
        currentReadingIdRef.current = null;
        onClose();
      }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navPlaceholder} />

          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitle} numberOfLines={1}>Reading Details</Text>
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
              {/* Media Badges */}
              <View style={styles.pillRow}>
                {reading.videoUrl ? (
                  <TouchableOpacity
                    style={styles.videoBadge}
                    onPress={() => {
                      const url = reading.videoUrl!.startsWith('http') ? reading.videoUrl! : `https://${reading.videoUrl}`;
                      Linking.openURL(url).catch(() => {});
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.videoBadgeText}>
                      {/youtube\.com|youtu\.be/i.test(reading.videoUrl) ? 'YouTube' : 'Video'}
                    </Text>
                  </TouchableOpacity>
                ) : mediaType && mediaType !== 'textbook' ? (
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>
                      {mediaType === 'video'
                        ? 'Video'
                        : mediaType === 'podcast'
                        ? 'Podcast'
                        : mediaType === 'article'
                        ? 'Article'
                        : 'Paper'}
                    </Text>
                  </View>
                ) : null}
              </View>

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

            {/* MARK: - Section 1: Schedule Week (Only in Weekly View) */}
            {effectiveViewMode === 'weeks' && (
              <>
                <Text style={styles.sectionHeaderTitle}>Schedule Week</Text>
                <View style={styles.sectionCard}>
                  <View style={styles.formRow}>
                    <Text style={styles.rowLabel}>Week</Text>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleWeekStep(-1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>

                      <View style={styles.stepperValueBox}>
                        <Text style={styles.stepperValueText}>
                          {weekNumber === 0 ? 'No Week' : `Week ${weekNumber}`}
                        </Text>
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
                </View>
              </>
            )}

            {/* MARK: - Section 2: Schedule Module (Only in Modules View) */}
            {effectiveViewMode === 'modules' && (
              <>
                <Text style={styles.sectionHeaderTitle}>Schedule Module</Text>
                <View style={styles.sectionCard}>
                  <View style={styles.formRow}>
                    <Text style={styles.rowLabel}>Module</Text>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleModuleStep(-1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>

                      <View style={styles.stepperValueBox}>
                        <Text style={styles.stepperValueText}>
                          {moduleNumber === 0 ? 'No Module' : `Module ${moduleNumber}`}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleModuleStep(1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* MARK: - Section 3: Chapter & Pages */}
            <Text style={styles.sectionHeaderTitle}>Chapter & Pages</Text>
            <View style={styles.sectionCard}>
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <Text style={styles.fieldMiniLabel}>CHAPTER</Text>
                  <TextInput
                    style={styles.singleFieldInput}
                    value={chapterInput}
                    onChangeText={t => {
                      setChapterInput(t);
                      saveAllChanges({ chapterText: t.trim() || undefined });
                    }}
                    placeholder="e.g. Chapter 4"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.splitVerticalDivider} />

                <View style={styles.splitCol}>
                  <Text style={styles.fieldMiniLabel}>PAGES</Text>
                  <TextInput
                    style={styles.singleFieldInput}
                    value={pagesInput}
                    onChangeText={t => {
                      setPagesInput(t);
                      saveAllChanges({ pagesText: t.trim() || undefined });
                    }}
                    placeholder="e.g. pp. 120–155"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </View>

            {/* MARK: - Topic Section */}
            {resolvedTopic ? (
              <>
                <Text style={styles.sectionHeaderTitle}>Topic</Text>
                <View style={styles.sectionCard}>
                  <Text style={styles.topicDetailText}>{resolvedTopic}</Text>
                </View>
              </>
            ) : null}

            {/* MARK: - Section 4: Author */}
            <Text style={styles.sectionHeaderTitle}>Author</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={styles.singleFieldInput}
                value={authorInput}
                onChangeText={t => {
                  setAuthorInput(t);
                  saveAllChanges({ authorName: t.trim() || undefined });
                }}
                placeholder="e.g. Diane R. Gehart"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* MARK: - Section 4: Suggested Reading */}
            <Text style={styles.sectionHeaderTitle}>Suggested Reading</Text>
            <View style={styles.sectionCard}>
              <View style={styles.formRow}>
                <Text style={styles.rowLabel}>Due Date</Text>
                <View style={styles.dueRightRow}>
                  <View style={styles.selectedDateBanner}>
                    <CalendarIcon size={14} color="#2470F5" />
                    <Text style={styles.selectedDateBannerText}>
                      {suggestedDate
                        ? `Read by ${suggestedDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}`
                        : 'No date set'}
                    </Text>
                  </View>
                  {suggestedDate && (
                    <TouchableOpacity
                      onPress={() => {
                        setSuggestedDate(null);
                        saveAllChanges({ dueDate: null });
                      }}
                      style={styles.clearDateBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clearDateBtnText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Apple-style Inline Calendar Date Picker */}
              <InlineCalendarPicker
                selectedDate={suggestedDate || new Date()}
                onSelectDate={d => {
                  setSuggestedDate(d);
                  saveAllChanges({ dueDate: d });
                }}
                accentColor={CoursePalTheme.accentBlue}
              />
            </View>

            {/* MARK: - Section: Reading Requirement */}
            <Text style={styles.sectionHeaderTitle}>Reading Requirement</Text>
            <View style={styles.requirementPillsRow}>
              <TouchableOpacity
                style={[
                  styles.requirementPill,
                  isRequired && styles.requirementPillActiveRequired
                ]}
                onPress={() => {
                  setIsRequired(true);
                  setRequirementType('required');
                  saveAllChanges({ isRequired: true, requirementType: 'required' });
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.requirementPillText,
                    isRequired && styles.requirementPillTextActive
                  ]}
                >
                  Required
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.requirementPill,
                  !isRequired && styles.requirementPillActiveOptional
                ]}
                onPress={() => {
                  setIsRequired(false);
                  setRequirementType('optional');
                  saveAllChanges({ isRequired: false, requirementType: 'optional' });
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.requirementPillText,
                    !isRequired && styles.requirementPillTextActive
                  ]}
                >
                  Optional
                </Text>
              </TouchableOpacity>
            </View>

            {/* MARK: - Section 4: Media Type */}
            <Text style={styles.sectionHeaderTitle}>Media Type</Text>
            <View style={styles.mediaTypePillsRow}>
              {(['textbook', 'paper', 'article', 'video', 'podcast'] as MediaType[]).map(t => {
                const isSelected = mediaType === t;
                const label =
                  t === 'textbook'
                    ? 'Textbook'
                    : t === 'paper'
                    ? 'Paper'
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
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* MARK: - Section 5: Resource / YouTube Link */}
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
                    <ArrowUpRightIcon size={12} color={isYouTube ? '#FFFFFF' : '#2470F5'} />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyResourceContainer}>
                  <Text style={styles.emptyResourceText}>No video or resource link attached</Text>
                </View>
              )}
            </View>

            {/* MARK: - Section 6: Notes (Keyboard-Aware, No Giant Bottom Gap) */}
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
                    placeholder="Add personal note or key takeaway..."
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
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
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
  moduleBadge: {
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
  moduleBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  headerTopicPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '100%'
  },
  headerTopicPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155'
  },
  topicDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  topicIconBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  topicIconBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.5
  },
  topicDetailText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
    lineHeight: 22
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
    fontSize: 12,
    fontWeight: '700',
    color: '#2470F5'
  },
  titleSection: {
    marginBottom: 4
  },
  readingTitleInput: {
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
    fontSize: 12,
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
  dueRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  selectedDateBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2470F5',
    includeFontPadding: false
  },
  clearDateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearDateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  emptyTopicsBox: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  emptyTopicsText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#8E9BAE',
    fontStyle: 'italic'
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  splitCol: {
    flex: 1
  },
  splitVerticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0'
  },
  fieldMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  singleFieldInput: {
    fontSize: 14.5,
    color: '#141F38',
    paddingVertical: 4
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    minHeight: 46
  },
  topicIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  itemIndexNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#596B85'
  },
  topicInput: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#141F38',
    padding: 0,
    minHeight: 28
  },
  deleteIconBtn: {
    padding: 2,
    marginTop: 2
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingVertical: 3
  },
  addItemBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2470F5'
  },
  requirementPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  requirementPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  requirementPillActiveRequired: {
    backgroundColor: '#2470F5',
    borderColor: '#2470F5'
  },
  requirementPillActiveOptional: {
    backgroundColor: '#475569',
    borderColor: '#475569'
  },
  requirementPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85'
  },
  requirementPillTextActive: {
    color: '#FFFFFF'
  },
  mediaTypePillsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    marginBottom: 12
  },
  mediaTypePill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  mediaTypePillActive: {
    backgroundColor: '#2470F5',
    borderColor: '#2470F5'
  },
  mediaTypePillText: {
    fontSize: 11,
    fontWeight: '700',
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
    padding: 8,
    borderRadius: 8,
    marginTop: 6
  },
  openLinkPillText: {
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 2
  },
  addNotePillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2470F5'
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  youtubeTypeBadge: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FDA4AF'
  },
  resourceTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2470F5'
  },
  youtubeTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48'
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
    backgroundColor: '#EFF6FF',
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
    color: '#2470F5'
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
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic'
  }
});
