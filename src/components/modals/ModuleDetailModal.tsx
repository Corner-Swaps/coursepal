/**
 * ModuleDetailModal
 * Dedicated Apple HIG modal for Course Modules.
 * Displays curriculum module details, themes, scheduled date ranges,
 * full readings list, module deliverables, and one-tap Google Calendar syncing.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Course, Reading, Assignment } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  AppleCalendarIcon,
  GoogleCalendarIcon,
  ArrowUpRightIcon,
  CheckmarkCircleFillIcon,
  CircleIcon,
  ChevronRightIcon,
  CalendarIcon,
  BookFillIcon
} from '../SvgIcons';
import { GoogleCalendarService } from '../../services/GoogleCalendarService';
import {
  formatDisplayTitleWithChapter,
  cleanChapterFromRaw,
  cleanAssignmentTitle,
  cleanAcademicWeekTheme,
  cleanDateRangeDisplay,
  parseSafeDate
} from '../../utils/readingDisplayHelper';
import { resolveFullAuthorName } from '../../utils/authorResolver';

export interface ModuleDetailModalProps {
  visible: boolean;
  course: Course | null;
  moduleNumber: number;
  moduleLabel?: string | null;
  theme?: string | null;
  readings: Reading[];
  assignments?: Assignment[];
  dateRangeStr?: string | null;
  onClose: () => void;

  onSelectReading?: (reading: Reading) => void;
  onSelectAssignment?: (assignment: Assignment) => void;
  onToggleCompleteReading?: (id: string) => void;
  onToggleCompleteAssignment?: (id: string) => void;
}

export const ModuleDetailModal: React.FC<ModuleDetailModalProps> = ({
  visible,
  course,
  moduleNumber,
  moduleLabel,
  theme,
  readings,
  assignments = [],
  dateRangeStr,
  onClose,
  onSelectReading,
  onSelectAssignment,
  onToggleCompleteReading,
  onToggleCompleteAssignment
}) => {
  const courseColor = course?.hexColor || CoursePalTheme.accentBlue;
  const courseCode = course?.courseCode || course?.courseName || 'Course';
  const cleanModLabel = moduleLabel || `Module ${moduleNumber}`;
  const cleanModTheme = cleanAcademicWeekTheme(theme);

  // Filter assignments relevant to this module
  const moduleAssignments = useMemo(() => {
    return assignments.filter(
      a => !a.isDeleted && (
        a.moduleNumber === moduleNumber ||
        (a.moduleMention && a.moduleMention.toLowerCase().includes(`module ${moduleNumber}`)) ||
        (a.moduleMention && a.moduleMention.toLowerCase().includes(`mod ${moduleNumber}`))
      )
    );
  }, [assignments, moduleNumber]);

  const handleSyncToGoogleCalendar = async () => {
    await GoogleCalendarService.syncModule({
      moduleNumber,
      moduleLabel: cleanModLabel,
      theme: cleanModTheme || undefined,
      readings,
      assignments: moduleAssignments,
      course,
      dateRangeStr
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navPlaceholder} />
          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitle} numberOfLines={1}>{cleanModLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.doneNavButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneNavText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Header Banner Card */}
          <View style={styles.headerBannerCard}>
            <View style={styles.pillRow}>
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{courseCode}</Text>
              </View>
              <View style={styles.moduleTagBadge}>
                <Text style={styles.moduleTagBadgeText}>{cleanModLabel}</Text>
              </View>
              {dateRangeStr ? (
                <View style={styles.dateBadge}>
                  <CalendarIcon size={12} color="#FFFFFF" />
                  <Text style={styles.dateBadgeText}>{cleanDateRangeDisplay(dateRangeStr)}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.moduleThemeTitle}>
              {cleanModTheme || cleanModLabel}
            </Text>

            {course?.courseName ? (
              <Text style={styles.courseSubtitle}>{course.courseName}</Text>
            ) : null}
          </View>

          {/* Sync to Google Calendar Action Card */}
          <TouchableOpacity
            style={styles.syncCard}
            onPress={handleSyncToGoogleCalendar}
            activeOpacity={0.8}
          >
            <View style={styles.syncCardLeft}>
              <View style={styles.googleIconCircle}>
                <GoogleCalendarIcon size={22} />
              </View>
              <View style={styles.syncCardTextCol}>
                <Text style={styles.syncCardTitle}>Sync Module to Google Calendar</Text>
                <Text style={styles.syncCardSubtitle}>
                  Includes overview, {readings.length} reading{readings.length === 1 ? '' : 's'}
                  {moduleAssignments.length > 0 ? ` & ${moduleAssignments.length} deliverable${moduleAssignments.length === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.arrowIconBubble}>
              <ArrowUpRightIcon size={14} color="#64748B" />
            </View>
          </TouchableOpacity>

          {/* Module Readings Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Curriculum Readings ({readings.length})
            </Text>
          </View>

          {readings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No specific readings assigned to this module.</Text>
            </View>
          ) : (
            <View style={styles.itemsListContainer}>
              {readings.map((r, idx) => {
                const rawAuth = r.authorName?.trim() || '';
                const resolvedAuth = resolveFullAuthorName(rawAuth) || rawAuth;
                const dispTitle = formatDisplayTitleWithChapter(
                  r,
                  r.chapterText,
                  r.resourceTitle,
                  course?.courseName,
                  resolvedAuth
                );
                const cleanCh = r.chapterText ? cleanChapterFromRaw(r.chapterText) : null;
                const isOpt = r.isRequired === false || r.requirementType === 'optional';

                return (
                  <TouchableOpacity
                    key={r.id || `mod-reading-${idx}`}
                    style={styles.itemCard}
                    onPress={() => onSelectReading?.(r)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      style={styles.checkBtn}
                      onPress={() => onToggleCompleteReading?.(r.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      {r.isCompleted ? (
                        <CheckmarkCircleFillIcon size={20} color="#10B981" />
                      ) : (
                        <CircleIcon size={20} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>

                    <View style={styles.itemTextCol}>
                      <Text
                        style={[
                          styles.itemTitle,
                          r.isCompleted && styles.itemTitleCompleted
                        ]}
                        numberOfLines={2}
                      >
                        {dispTitle}
                      </Text>

                      <View style={styles.itemMetaRow}>
                        {cleanCh ? (
                          <View style={styles.itemSubBadge}>
                            <Text style={styles.itemSubBadgeText}>{cleanCh}</Text>
                          </View>
                        ) : null}

                        {resolvedAuth ? (
                          <Text style={styles.itemAuthorText} numberOfLines={1}>
                            {resolvedAuth}
                          </Text>
                        ) : null}

                        {isOpt ? (
                          <View style={styles.optionalBadge}>
                            <Text style={styles.optionalBadgeText}>Optional</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <ChevronRightIcon size={14} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Module Deliverables / Assignments Section */}
          {moduleAssignments.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
                <Text style={styles.sectionTitle}>
                  Deliverables & Assignments ({moduleAssignments.length})
                </Text>
              </View>

              <View style={styles.itemsListContainer}>
                {moduleAssignments.map((a, idx) => {
                  const cleanTitle = cleanAssignmentTitle(a.title);
                  return (
                    <TouchableOpacity
                      key={a.id || `mod-assign-${idx}`}
                      style={styles.itemCard}
                      onPress={() => onSelectAssignment?.(a)}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        style={styles.checkBtn}
                        onPress={() => onToggleCompleteAssignment?.(a.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        {a.isCompleted ? (
                          <CheckmarkCircleFillIcon size={20} color="#10B981" />
                        ) : (
                          <CircleIcon size={20} color="#CBD5E1" />
                        )}
                      </TouchableOpacity>

                      <View style={styles.itemTextCol}>
                        <Text
                          style={[
                            styles.itemTitle,
                            a.isCompleted && styles.itemTitleCompleted
                          ]}
                          numberOfLines={2}
                        >
                          {cleanTitle}
                        </Text>

                        <View style={styles.itemMetaRow}>
                          {a.weightPercentage ? (
                            <View style={styles.itemSubBadge}>
                              <Text style={styles.itemSubBadgeText}>{a.weightPercentage}</Text>
                            </View>
                          ) : null}

                          {a.pointsPossible ? (
                            <View style={styles.pointsBadge}>
                              <Text style={styles.pointsBadgeText}>{a.pointsPossible}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <ChevronRightIcon size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA'
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  navPlaceholder: {
    width: 60
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center'
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.2
  },
  doneNavButton: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4
  },
  doneNavText: {
    fontSize: 16,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40
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
  moduleTagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  moduleTagBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155'
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
  moduleThemeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 4
  },
  courseSubtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2
  },
  syncCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  syncCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12
  },
  googleIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  syncCardTextCol: {
    flex: 1
  },
  syncCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2
  },
  syncCardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2
  },
  arrowIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10
  },
  sectionHeaderRow: {
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  emptyCardText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic'
  },
  itemsListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden'
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
    gap: 12
  },
  checkBtn: {
    padding: 2
  },
  itemTextCol: {
    flex: 1
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: -0.2,
    lineHeight: 20
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8'
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  itemSubBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5
  },
  itemSubBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  itemAuthorText: {
    fontSize: 11.5,
    color: '#64748B'
  },
  optionalBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5
  },
  optionalBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#B45309'
  },
  pointsBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5
  },
  pointsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6D28D9'
  }
});
