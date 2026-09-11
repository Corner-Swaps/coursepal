import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  GraduationCapFillIcon,
  ChevronRightIcon,
  ClearBookIcon
} from '../SvgIcons';
import { SlideUpModal } from '../SlideUpModal';

interface AddNewItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAddReading?: () => void;
  onAddAssignment?: () => void;
  onAddReadingOrAssignment?: () => void;
  onCreateCourse: () => void;
}

export const AddNewItemModal: React.FC<AddNewItemModalProps> = ({
  visible,
  onClose,
  onAddReading,
  onAddAssignment,
  onAddReadingOrAssignment,
  onCreateCourse
}) => {
  const handleAddReadingOrAssignment = () => {
    onClose();
    if (onAddReadingOrAssignment) {
      onAddReadingOrAssignment();
    } else if (onAddAssignment) {
      onAddAssignment();
    } else if (onAddReading) {
      onAddReading();
    }
  };

  return (
    <SlideUpModal
      visible={visible}
      onClose={onClose}
      testID="add-new-item-modal"
    >
      {/* Header Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Add New Item</Text>
        <Text style={styles.subtitle}>Select what you would like to add</Text>
      </View>

      {/* Action Cards: 1. Create New Course, 2. Add Reading or Assignment */}
      <View style={styles.optionsContainer}>
        {/* Card 1: Create New Course (First item) */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => {
            onClose();
            onCreateCourse();
          }}
          activeOpacity={0.8}
          testID="modal-choice-create-course"
        >
          <View style={styles.purpleIconSquare}>
            <GraduationCapFillIcon size={20} color="#FFFFFF" />
          </View>

          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle}>Create New Course</Text>
            <Text style={styles.optionDesc}>
              Set up course with custom brand color & syllabus
            </Text>
          </View>

          <ChevronRightIcon size={13} color="#73859E" />
        </TouchableOpacity>

        {/* Card 2: Add Reading or Assignment (Unified Single Pill) */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleAddReadingOrAssignment}
          activeOpacity={0.8}
          testID="modal-choice-add-task"
        >
          <View style={styles.blueIconSquare}>
            <ClearBookIcon size={20} color="#FFFFFF" />
          </View>

          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle}>Add Reading or Assignment</Text>
            <Text style={styles.optionDesc}>
              Add textbook reading, homework, quiz, or project
            </Text>
          </View>

          <ChevronRightIcon size={13} color="#73859E" />
        </TouchableOpacity>
      </View>
    </SlideUpModal>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.3,
    marginBottom: 3
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  optionsContainer: {
    gap: 12
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  blueIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2470F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  amberIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  purpleIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#8C45F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  optionTextCol: {
    flex: 1
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 2
  },
  optionDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: '#596B85'
  }
});
