import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCoursePal } from '../../context/CoursePalContext';
import { Course } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import { XMarkCircleFillIcon } from '../SvgIcons';

interface CourseFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CourseFilterModal: React.FC<CourseFilterModalProps> = ({ visible, onClose }) => {
  const { courses, selectedCourseFilter, setSelectedCourseFilter } = useCoursePal();

  if (!visible) return null;

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
            <Text style={styles.navTitle} numberOfLines={1}>Filter by Course</Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.navButton, styles.actionButton]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.saveText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
          {/* Option: Show All Courses */}
          <TouchableOpacity
            style={[
              styles.courseOptionCard,
              selectedCourseFilter === null && styles.courseOptionCardActive
            ]}
            onPress={() => {
              setSelectedCourseFilter(null);
              onClose();
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.colorDot, { backgroundColor: CoursePalTheme.accentBlue }]} />
            <Text style={styles.courseNameText}>All Courses</Text>
            {selectedCourseFilter === null && (
              <Text style={styles.checkmarkText}>✓</Text>
            )}
          </TouchableOpacity>

          {/* Options for each active course */}
          {courses.map(course => {
            const isSelected = selectedCourseFilter?.id === course.id;
            return (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseOptionCard,
                  isSelected && styles.courseOptionCardActive
                ]}
                onPress={() => {
                  setSelectedCourseFilter(course);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.colorDot, { backgroundColor: course.hexColor }]} />
                <View style={styles.courseInfoCol}>
                  <Text style={styles.courseCodeText}>
                    {course.courseCode || course.courseName}
                  </Text>
                  <Text style={styles.courseTitleText}>{course.courseName}</Text>
                </View>
                {isSelected && <Text style={styles.checkmarkText}>✓</Text>}
              </TouchableOpacity>
            );
          })}
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
  scrollContent: {
    flex: 1
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64,
    gap: 12
  },
  courseOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1
  },
  courseOptionCardActive: {
    borderColor: CoursePalTheme.accentBlue,
    backgroundColor: '#F0F5FF'
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12
  },
  courseInfoCol: {
    flex: 1
  },
  courseCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141F38'
  },
  courseTitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#596B85'
  },
  courseNameText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38'
  },
  checkmarkText: {
    fontSize: 16,
    fontWeight: '800',
    color: CoursePalTheme.accentBlue
  }
});
