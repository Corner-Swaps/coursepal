import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCoursePal } from '../../context/CoursePalContext';
import { CoursePalTheme } from '../../constants/theme';
import { MediaType } from '../../types/models';

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  initialCategory?: 'assignment' | 'reading';
  initialCourseId?: string;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  visible,
  onClose,
  initialCategory = 'assignment',
  initialCourseId
}) => {
  const { courses, addTask } = useCoursePal();

  const [category, setCategory] = useState<'assignment' | 'reading'>(initialCategory);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId || (courses[0]?.id ?? '')
  );
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [points, setPoints] = useState<number>(100);
  const [weight, setWeight] = useState<number>(10);
  const [mediaType, setMediaType] = useState<MediaType>('textbook');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!visible) return null;

  const handleSave = () => {
    if (!taskTitle.trim()) return;

    addTask({
      category,
      title: taskTitle.trim(),
      courseId: selectedCourseId,
      weekNumber,
      dueDate: new Date(Date.now() + weekNumber * 7 * 86400000),
      points,
      weight,
      mediaType,
      videoUrl: videoUrl.trim() || undefined,
      notes: notes.trim() || undefined
    });

    // Reset & close
    setTaskTitle('');
    setNotes('');
    setVideoUrl('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
            disabled={!taskTitle.trim()}
            style={[styles.navButton, styles.actionButton]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text
              style={[
                styles.saveText,
                !taskTitle.trim() && styles.saveTextDisabled
              ]}
            >
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
          {/* Section 1: Item Type Segmented Control */}
          <View style={styles.sectionCard}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  category === 'assignment' && styles.segmentButtonActive
                ]}
                onPress={() => setCategory('assignment')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    category === 'assignment' && styles.segmentTextActive
                  ]}
                >
                  Assignment
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  category === 'reading' && styles.segmentButtonActive
                ]}
                onPress={() => setCategory('reading')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    category === 'reading' && styles.segmentTextActive
                  ]}
                >
                  Reading
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder={
                category === 'reading'
                  ? 'Reading Title (e.g. Chapter 1 Sexuality)'
                  : 'Assignment Title (e.g. Research Study Design)'
              }
              placeholderTextColor="#8E9BAE"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            {/* Course Selector */}
            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>Course</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursePills}>
                {courses.map(c => {
                  const isSelected = c.id === selectedCourseId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.coursePill,
                        isSelected && { backgroundColor: c.hexColor, borderColor: c.hexColor }
                      ]}
                      onPress={() => setSelectedCourseId(c.id)}
                    >
                      <Text
                        style={[
                          styles.coursePillText,
                          isSelected && { color: '#FFFFFF', fontWeight: '700' }
                        ]}
                      >
                        {c.courseCode || c.courseName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Section 2: Schedule (Week Selector) */}
          <Text style={styles.sectionHeader}>SCHEDULE</Text>
          <View style={styles.sectionCard}>
            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>Week</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursePills}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16].map(w => {
                  const isSelected = w === weekNumber;
                  return (
                    <TouchableOpacity
                      key={`week-${w}`}
                      style={[
                        styles.coursePill,
                        isSelected && styles.coursePillSelected
                      ]}
                      onPress={() => setWeekNumber(w)}
                    >
                      <Text
                        style={[
                          styles.coursePillText,
                          isSelected && styles.coursePillTextSelected
                        ]}
                      >
                        Week {w}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Section 3: Points & Grade Weight OR Media & Link */}
          {category === 'assignment' ? (
            <>
              <Text style={styles.sectionHeader}>POINTS & GRADE WEIGHT</Text>
              <View style={styles.sectionCard}>
                <View style={styles.selectorRow}>
                  <Text style={styles.selectorLabel}>Points Possible</Text>
                  <View style={styles.pillOptionsRow}>
                    {[25, 50, 100, 150, 200, 250].map(pts => (
                      <TouchableOpacity
                        key={`pts-${pts}`}
                        style={[
                          styles.miniPill,
                          points === pts && styles.miniPillSelected
                        ]}
                        onPress={() => setPoints(pts)}
                      >
                        <Text
                          style={[
                            styles.miniPillText,
                            points === pts && styles.miniPillTextSelected
                          ]}
                        >
                          {pts} Pts
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.selectorRow, { borderTopWidth: 1, borderTopColor: '#F2F5FA', paddingTop: 10, marginTop: 10 }]}>
                  <Text style={styles.selectorLabel}>Grade Weight</Text>
                  <View style={styles.pillOptionsRow}>
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(pct => (
                      <TouchableOpacity
                        key={`pct-${pct}`}
                        style={[
                          styles.miniPill,
                          weight === pct && styles.miniPillSelected
                        ]}
                        onPress={() => setWeight(pct)}
                      >
                        <Text
                          style={[
                            styles.miniPillText,
                            weight === pct && styles.miniPillTextSelected
                          ]}
                        >
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionHeader}>MEDIA & LINK</Text>
              <View style={styles.sectionCard}>
                <View style={styles.selectorRow}>
                  <Text style={styles.selectorLabel}>Media Type</Text>
                  <View style={styles.pillOptionsRow}>
                    {(['textbook', 'video', 'podcast', 'article'] as MediaType[]).map(m => (
                      <TouchableOpacity
                        key={`media-${m}`}
                        style={[
                          styles.miniPill,
                          mediaType === m && styles.miniPillSelected
                        ]}
                        onPress={() => setMediaType(m)}
                      >
                        <Text
                          style={[
                            styles.miniPillText,
                            mediaType === m && styles.miniPillTextSelected
                          ]}
                        >
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TextInput
                  style={[styles.textInput, { marginTop: 10 }]}
                  placeholder="Paste video or article URL (optional)..."
                  placeholderTextColor="#8E9BAE"
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  autoCapitalize="none"
                />
              </View>
            </>
          )}

          {/* Section 4: Notes */}
          <Text style={styles.sectionHeader}>NOTES</Text>
          <View style={styles.sectionCard}>
            <TextInput
              style={styles.notesInput}
              placeholder="Instructions & Notes..."
              placeholderTextColor="#8E9BAE"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={6}
            />
          </View>
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
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5'
  },
  saveTextDisabled: {
    opacity: 0.35
  },
  scrollContent: {
    flex: 1
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 4
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#EBF0F7',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85'
  },
  segmentTextActive: {
    color: '#141F38',
    fontWeight: '700'
  },
  textInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#141F38',
    backgroundColor: '#F8FAFD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10
  },
  selectorRow: {
    marginTop: 6
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85',
    marginBottom: 8
  },
  coursePills: {
    flexDirection: 'row'
  },
  coursePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F2F5FA',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    marginRight: 6
  },
  coursePillSelected: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderColor: CoursePalTheme.accentBlue
  },
  coursePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#141F38'
  },
  coursePillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  pillOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F2F5FA',
    borderWidth: 1,
    borderColor: '#E3E8F0'
  },
  miniPillSelected: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderColor: CoursePalTheme.accentBlue
  },
  miniPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#596B85'
  },
  miniPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  notesInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#141F38',
    minHeight: 100,
    textAlignVertical: 'top'
  }
});
