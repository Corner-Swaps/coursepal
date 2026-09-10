import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GraduationCapFillIcon, ChevronRightIcon } from '../SvgIcons';
import { SlideUpModal } from '../SlideUpModal';

interface AddNewItemModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateCourse: () => void;
  onAddTask: () => void;
}

export const AddNewItemModal: React.FC<AddNewItemModalProps> = ({
  visible,
  onClose,
  onCreateCourse,
  onAddTask
}) => {
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

      {/* Action Cards */}
      <View style={styles.optionsContainer}>
        {/* Card 1: Create New Course */}
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
              Create course with brand color & syllabus
            </Text>
          </View>

          <ChevronRightIcon size={13} color="#73859E" />
        </TouchableOpacity>

        {/* Card 2: Add Reading or Assignment */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => {
            onClose();
            onAddTask();
          }}
          activeOpacity={0.8}
          testID="modal-choice-add-task"
        >
          <View style={styles.blueIconSquare}>
            <Text style={styles.plusIconText}>+</Text>
          </View>

          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle}>Add Reading or Assignment</Text>
            <Text style={styles.optionDesc}>
              Add homework, reading, or lab item
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
  purpleIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#8C45F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
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
  plusIconText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24
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
