/**
 * AssignmentDetailModal
 * 1:1 Parity with native Swift AssignmentDetailView.swift
 * Visual layout matching legacy Swift AssignmentDetailView
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Assignment, Course, RubricCriterion } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  CalendarIcon,
  CheckmarkCircleFillIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  SparklesIcon,
  WandAndStarsIcon,
  NumberIcon,
  DocTextFillIcon,
  DocRichtextFillIcon,
  PlayTvFillIcon,
  WaveformPathEcgIcon,
  Person3FillIcon,
  RectangleInsetTopLeftFilledIcon,
  DocFillIcon,
  LinkCircleFillIcon,
  PlayCircleFillIcon,
  ArrowUpRightIcon,
  CheckmarkIcon,
  ChartPieFillIcon
} from '../SvgIcons';
import { parseSafeDate, formatAssignmentDueDate } from '../../utils/readingDisplayHelper';
import { APIService } from '../../services/APIService';

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
  const courseCodeStr = matchedCourse?.courseCode || assignment.courseCode || 'CRS';
  const courseTitleStr = matchedCourse?.courseName || assignment.courseCode || 'Assignment';

  const [notes, setNotes] = useState<string>(assignment.noteText || '');
  const [completedMilestones, setCompletedMilestones] = useState<Set<number>>(new Set());
  const [isGeneratingMilestones, setIsGeneratingMilestones] = useState<boolean>(false);
  const [weekTextState, setWeekTextState] = useState<string>(String(assignment.weekNumber || 1));
  const [moduleTextState, setModuleTextState] = useState<string>(assignment.moduleMention || assignment.relevantTopics || '');

  useEffect(() => {
    setNotes(assignment.noteText || '');
    setWeekTextState(String(assignment.weekNumber || 1));
    setModuleTextState(assignment.moduleMention || assignment.relevantTopics || '');
  }, [assignment]);

  // Parse milestones from relevantTopics ("|||" delimited)
  const milestones = useMemo(() => {
    if (!assignment.relevantTopics) return [];
    if (assignment.relevantTopics.includes('|||')) {
      return assignment.relevantTopics
        .split('|||')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
    return [];
  }, [assignment.relevantTopics]);

  // Rubric items breakdown
  const rubricItems = useMemo((): Array<{ title: string; points: string; percentage: string }> => {
    if (assignment.rubricCriteria && assignment.rubricCriteria.length > 0) {
      return assignment.rubricCriteria.map(c => ({
        title: c.criterionName,
        points: c.points != null ? `${c.points} pts` : '',
        percentage: c.percentage != null ? `${c.percentage}%` : ''
      }));
    }

    if (assignment.pointsBreakdown && assignment.pointsBreakdown.trim()) {
      const segments = assignment.pointsBreakdown
        .split(/[\n|;,]/)
        .map(s => s.replace(/^[•\-\*▪●]\s*/, '').trim())
        .filter(s => s.length > 0);

      return segments.map(seg => {
        let pctStr = '';
        const pctMatch = seg.match(/\b\d+(?:\.\d+)?\s*%/);
        if (pctMatch) {
          pctStr = pctMatch[0].replace(/\s+/g, '');
        }

        let ptsStr = '';
        const ptsMatch = seg.match(/\b\d+(?:\.\d+)?\s*(?:pts|points|pt)\b/i);
        if (ptsMatch) {
          ptsStr = ptsMatch[0];
        }

        let cleanTitle = seg
          .replace(/\b\d+(?:\.\d+)?\s*%/g, '')
          .replace(/\b\d+(?:\.\d+)?\s*(?:pts|points|pt)\b/gi, '')
          .replace(/^[\d\s\-\:\.\)]+/, '')
          .replace(/[\:\-\–\(\)]+/g, ' ')
          .trim();

        if (!cleanTitle) cleanTitle = 'Evaluation Criterion';
        return { title: cleanTitle, points: ptsStr, percentage: pctStr };
      });
    }

    // Default academic rubric distribution if points are available
    return [
      { title: 'Depth of Analysis & Insight', points: '30 pts', percentage: '30%' },
      { title: 'Academic Evidence & Citations', points: '30 pts', percentage: '30%' },
      { title: 'Structural Coherence & Organization', points: '20 pts', percentage: '20%' },
      { title: 'Formatting & Mechanics', points: '20 pts', percentage: '20%' }
    ];
  }, [assignment.rubricCriteria, assignment.pointsBreakdown]);

  // SubType icon helper matching Swift Models.swift
  const renderSubTypeIcon = () => {
    const raw = (assignment.subTypeRaw || '').toUpperCase();
    switch (raw) {
      case 'TEXTBOOK':
        return <DocTextFillIcon size={12} color="#2470F5" />;
      case 'ARTICLE':
        return <DocTextFillIcon size={12} color="#2470F5" />;
      case 'VIDEO':
        return <PlayTvFillIcon size={12} color="#2470F5" />;
      case 'PODCAST':
        return <WaveformPathEcgIcon size={12} color="#2470F5" />;
      case 'IN_CLASS':
        return <Person3FillIcon size={12} color="#2470F5" />;
      case 'PAPER':
        return <DocRichtextFillIcon size={12} color="#2470F5" />;
      case 'PRESENTATION':
        return <RectangleInsetTopLeftFilledIcon size={12} color="#2470F5" />;
      case 'EXAM':
      case 'QUIZ':
        return <PencilSquareIcon size={12} color="#2470F5" />;
      default:
        return <DocFillIcon size={12} color="#2470F5" />;
    }
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    onUpdateAssignment({
      ...assignment,
      noteText: text
    });
  };

  const handleWeekChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setWeekTextState(digits);
    const num = parseInt(digits, 10);
    if (!isNaN(num) && num > 0) {
      onUpdateAssignment({
        ...assignment,
        weekNumber: num
      });
    }
  };

  const handleModuleChange = (text: string) => {
    setModuleTextState(text);
    onUpdateAssignment({
      ...assignment,
      moduleMention: text.trim() || undefined
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

  const generateRoadmap = async () => {
    if (isGeneratingMilestones) return;
    setIsGeneratingMilestones(true);
    try {
      const rubrics = rubricItems.map(
        r => `${r.title}: ${[r.points, r.percentage].filter(Boolean).join(', ')}`
      );
      const steps = await APIService.shared.generateAssignmentMilestones(
        assignment.title,
        assignment.fullInstructions,
        assignment.weightPercentage,
        assignment.pointsPossible,
        rubrics
      );
      const joined = steps.join('|||');
      onUpdateAssignment({
        ...assignment,
        relevantTopics: joined
      });
      setCompletedMilestones(new Set());
    } catch {
      // Fallback default roadmap steps
      const fallbackSteps = [
        `Review instructions and syllabus rubric for ${assignment.title}`,
        'Draft outline and identify key scholarly sources',
        'Complete initial working draft of core sections',
        'Review against criteria and finalize deliverable'
      ];
      onUpdateAssignment({
        ...assignment,
        relevantTopics: fallbackSteps.join('|||')
      });
    } finally {
      setIsGeneratingMilestones(false);
    }
  };

  const formattedDueDateStr = useMemo(() => {
    if (assignment.dueDate) {
      const d = parseSafeDate(assignment.dueDate);
      if (d) {
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return `Week ${assignment.weekNumber || 1}`;
  }, [assignment.dueDate, assignment.weekNumber]);

  const cleanWeightStr = useMemo(() => {
    if (!assignment.weightPercentage) return null;
    return assignment.weightPercentage.includes('%')
      ? assignment.weightPercentage
      : `${assignment.weightPercentage}%`;
  }, [assignment.weightPercentage]);

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
              <Text style={styles.doneText}>Done</Text>
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

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* MARK: - Header Banner (1:1 with Swift headerBannerView) */}
            <View style={styles.headerBannerCard}>
              {/* Top Row: Course Code Pill & Subtype Badge */}
              <View style={styles.headerPillsRow}>
                <View style={[styles.courseCodePill, { backgroundColor: `${courseColor}26` }]}>
                  <Text style={[styles.courseCodePillText, { color: courseColor }]}>{courseCodeStr}</Text>
                </View>

                <View style={styles.subTypeBadge}>
                  {renderSubTypeIcon()}
                  <Text style={styles.subTypeBadgeText}>
                    {(assignment.subTypeRaw || 'ASSIGNMENT').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Assignment Title & Badges */}
              <View style={styles.titleSection}>
                <Text style={styles.assignmentTitleText}>{assignment.title}</Text>

                <View style={styles.capsuleBadgesRow}>
                  {cleanWeightStr && (
                    <View style={styles.weightCapsule}>
                      <Text style={styles.weightCapsuleText}>{cleanWeightStr}</Text>
                    </View>
                  )}

                  {assignment.weekNumber > 0 && (
                    <View style={styles.weekCapsule}>
                      <Text style={styles.weekCapsuleText}>Week {assignment.weekNumber}</Text>
                    </View>
                  )}

                  {assignment.moduleMention ? (
                    <View style={styles.moduleCapsule}>
                      <Text style={styles.moduleCapsuleText}>{assignment.moduleMention}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Bottom Row: Course Name & Due Date */}
              <View style={styles.headerBottomRow}>
                {courseTitleStr !== courseCodeStr && (
                  <Text style={styles.courseSubtitleText} numberOfLines={1}>
                    {courseTitleStr}
                  </Text>
                )}

                <View style={styles.dueDateBadge}>
                  <CalendarIcon size={12} color="#D94033" />
                  <Text style={styles.dueDateBadgeText}>
                    {formatAssignmentDueDate(assignment.dueDate) || `Week ${assignment.weekNumber || 1}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* MARK: - Schedule & Due Date Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <CalendarIcon size={14} color="#2470F5" />
                </View>
                <Text style={styles.sectionCardTitle}>Schedule & Due Date</Text>
              </View>

              <View style={styles.scheduleInputsRow}>
                {/* Week Box */}
                <View style={styles.scheduleInputCol}>
                  <Text style={styles.inputFieldLabel}>Week</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInputBold}
                      value={weekTextState}
                      keyboardType="number-pad"
                      onChangeText={handleWeekChange}
                      placeholder="1"
                      placeholderTextColor="#8E9BAE"
                    />
                  </View>
                </View>

                {/* Module Box */}
                <View style={styles.scheduleInputCol}>
                  <Text style={styles.inputFieldLabel}>Module</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInputBold}
                      value={moduleTextState}
                      onChangeText={handleModuleChange}
                      placeholder="Module"
                      placeholderTextColor="#8E9BAE"
                    />
                  </View>
                </View>
              </View>

              {/* Due Date Display */}
              <View style={styles.dueDateDisplayBox}>
                <Text style={styles.inputFieldLabel}>Due Date</Text>
                <View style={styles.dueDateRow}>
                  <CalendarIcon size={15} color="#596B85" />
                  <Text style={styles.dueDateValueText}>{formattedDueDateStr}</Text>
                </View>
              </View>
            </View>

            {/* MARK: - Instructions Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <DocTextFillIcon size={14} color="#2470F5" />
                </View>
                <Text style={styles.sectionCardTitle}>Instructions</Text>
              </View>
              <Text style={styles.instructionsBodyText}>
                {assignment.fullInstructions || 'Follow course syllabus guidelines and rubric specifications.'}
              </Text>
            </View>

            {/* MARK: - Points Breakdown & Rubric */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <ChartPieFillIcon size={14} color="#2470F5" />
                </View>
                <Text style={styles.sectionCardTitle}>Points Breakdown</Text>
              </View>

              {/* Total Points Pill */}
              <View style={styles.totalPointsPill}>
                <View style={styles.numberIconCircle}>
                  <NumberIcon size={12} color="#596B85" />
                </View>
                <View style={styles.totalPointsTextCol}>
                  <Text style={styles.totalPointsLabel}>Total Points</Text>
                  <Text style={styles.totalPointsValue}>
                    {assignment.pointsPossible || '100 Points'}
                  </Text>
                </View>
              </View>

              {/* Dedicated Rubric Items */}
              <View style={styles.rubricListContainer}>
                {rubricItems.map((item, idx) => (
                  <View key={`rubric-${idx}`} style={styles.rubricItemPill}>
                    <Text style={styles.rubricItemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <View style={styles.rubricPointsRow}>
                      {item.percentage ? (
                        <View style={styles.rubricPctBadge}>
                          <Text style={styles.rubricPctBadgeText}>{item.percentage}</Text>
                        </View>
                      ) : null}

                      {item.points ? (
                        <View style={styles.ptsGroup}>
                          <Text style={styles.ptsLabel}>pts</Text>
                          <Text style={styles.ptsValue}>
                            {item.points.replace(/pts|points|pt/gi, '').trim() || item.points}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* MARK: - AI Study Roadmap & Milestones */}
            <View style={styles.sectionCard}>
              <View style={styles.roadmapHeaderRow}>
                <View style={styles.roadmapHeaderLeft}>
                  <SparklesIcon size={16} color="#8C45F5" />
                  <Text style={styles.sectionCardTitle}>AI Study Roadmap & Milestones</Text>
                </View>

                {isGeneratingMilestones ? (
                  <ActivityIndicator size="small" color="#8C45F5" />
                ) : (
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={generateRoadmap}
                    activeOpacity={0.7}
                  >
                    <WandAndStarsIcon size={12} color="#8C45F5" />
                    <Text style={styles.generateButtonText}>
                      {milestones.length === 0 ? 'Generate' : 'Regenerate'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {milestones.length === 0 ? (
                <View style={styles.milestonesEmptyContainer}>
                  <Text style={styles.milestonesEmptyDesc}>
                    Let AI break down this assignment into actionable, step-by-step milestones to help you stay on track.
                  </Text>
                  <TouchableOpacity
                    style={styles.generateActionButton}
                    onPress={generateRoadmap}
                    activeOpacity={0.8}
                  >
                    <SparklesIcon size={16} color="#FFFFFF" />
                    <Text style={styles.generateActionButtonText}>Generate Actionable Milestones</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.milestonesList}>
                  {milestones.map((step, idx) => {
                    const isDone = completedMilestones.has(idx);
                    return (
                      <TouchableOpacity
                        key={`step-${idx}`}
                        style={styles.milestoneRow}
                        onPress={() => toggleMilestone(idx)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.milestoneCheckbox, isDone && styles.milestoneCheckboxDone]}>
                          {isDone && <CheckmarkIcon size={11} color="#FFFFFF" strokeWidth={2.6} />}
                        </View>
                        <Text style={[styles.milestoneText, isDone && styles.milestoneTextDone]}>
                          {step}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* MARK: - Personal Notes */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <PencilSquareIcon size={14} color="#2470F5" />
                </View>
                <Text style={styles.sectionCardTitle}>Personal Notes</Text>
              </View>
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

            {/* MARK: - Attached Media / Resource Link */}
            {assignment.mediaUrl && assignment.mediaUrl.trim().length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <LinkCircleFillIcon size={18} color="#2470F5" />
                  <Text style={styles.sectionCardTitle}>Attached Media / Resource Link</Text>
                </View>
                <TouchableOpacity
                  style={styles.attachedMediaPill}
                  onPress={() => {
                    if (assignment.mediaUrl) {
                      Linking.openURL(assignment.mediaUrl).catch(() => {});
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <PlayCircleFillIcon size={18} color="#2470F5" />
                  <Text style={styles.attachedMediaUrl} numberOfLines={1}>
                    {assignment.mediaUrl}
                  </Text>
                  <ArrowUpRightIcon size={13} color="#2470F5" />
                </TouchableOpacity>
              </View>
            )}

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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D9E6',
    backgroundColor: '#F2F5FA'
  },
  navButton: {
    minWidth: 60,
    height: 40,
    justifyContent: 'center'
  },
  cancelButton: {
    alignItems: 'flex-start'
  },
  actionButton: {
    alignItems: 'flex-end'
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2470F5'
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#121C33',
    textAlign: 'center'
  },
  editText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2470F5'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 64
  },
  headerBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
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
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    borderRadius: 8
  },
  subTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2470F5'
  },
  titleSection: {
    marginBottom: 14
  },
  assignmentTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#121C33',
    lineHeight: 28,
    marginBottom: 8
  },
  capsuleBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  weightCapsule: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: '#2470F5',
    borderRadius: 12
  },
  weightCapsuleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  weekCapsule: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: '#738094',
    borderRadius: 12
  },
  weekCapsuleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  moduleCapsule: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: '#738094',
    borderRadius: 12
  },
  moduleCapsuleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9'
  },
  courseSubtitleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginRight: 8
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(217, 64, 51, 0.1)',
    borderRadius: 8
  },
  dueDateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D94033'
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#121C33'
  },
  scheduleInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  scheduleInputCol: {
    flex: 1
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#596B85',
    marginBottom: 6
  },
  inputWrapper: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  textInputBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#121C33',
    paddingVertical: 0
  },
  dueDateDisplayBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2
  },
  dueDateValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#121C33'
  },
  instructionsBodyText: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#354252',
    lineHeight: 23
  },
  totalPointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0'
  },
  numberIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E9F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  totalPointsTextCol: {
    flex: 1
  },
  totalPointsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#73859E'
  },
  totalPointsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#121C33'
  },
  rubricListContainer: {
    gap: 8
  },
  rubricItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E5E9F0'
  },
  rubricItemTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#121C33',
    marginRight: 12
  },
  rubricPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  rubricPctBadge: {
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  rubricPctBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2470F5'
  },
  ptsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ptsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73859E'
  },
  ptsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141F38',
    minWidth: 20,
    textAlign: 'right'
  },
  roadmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  roadmapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(140, 69, 245, 0.12)',
    borderRadius: 8
  },
  generateButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8C45F5'
  },
  milestonesEmptyContainer: {
    gap: 12
  },
  milestonesEmptyDesc: {
    fontSize: 13,
    color: '#596B85',
    lineHeight: 18
  },
  generateActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8C45F5',
    borderRadius: 12,
    paddingVertical: 12
  },
  generateActionButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  milestonesList: {
    gap: 10
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4
  },
  milestoneCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  milestoneCheckboxDone: {
    backgroundColor: '#2470F5',
    borderColor: '#2470F5'
  },
  milestoneText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '400',
    color: '#121C33',
    lineHeight: 19
  },
  milestoneTextDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8'
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 13.5,
    color: '#121C33',
    minHeight: 85,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA'
  },
  attachedMediaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(36, 112, 245, 0.1)',
    borderRadius: 12
  },
  attachedMediaUrl: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#2470F5'
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2470F5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 8
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
    borderRadius: 14,
    paddingVertical: 14,
    marginVertical: 8
  },
  restoreDetailButtonText: {
    color: CoursePalTheme.accentBlue,
    fontSize: 14,
    fontWeight: '700'
  }
});
