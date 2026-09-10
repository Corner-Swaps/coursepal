import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView
} from 'react-native';
import { Course } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import { QRCodeIcon } from '../SvgIcons';

interface QRCodeModalProps {
  visible: boolean;
  course: Course | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ visible, course, onClose }) => {
  if (!visible || !course) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navButton} />
          <Text style={styles.navTitle}>Course QR Code</Text>
          <TouchableOpacity onPress={onClose} style={styles.navButton} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.courseName}>{course.courseName}</Text>
          <View style={styles.shareCodeRow}>
            <Text style={styles.shareCodeLabel}>Share Code:</Text>
            <Text style={[styles.shareCodeValue, { color: course.hexColor }]}>
              {course.sharingCode}
            </Text>
          </View>

          {/* QR Code Presentation Box */}
          <View style={styles.qrCodeBox}>
            <QRCodeIcon size={160} color={course.hexColor} />
          </View>

          <Text style={styles.instructionText}>
            Classmates can scan this QR code with their iPhone camera to open CoursePal and enroll instantly.
          </Text>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E3E8F0',
    backgroundColor: '#F2F5FA'
  },
  navButton: {
    minWidth: 50
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141F38'
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue,
    textAlign: 'right'
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 16
  },
  courseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#141F38',
    textAlign: 'center',
    marginBottom: 8
  },
  shareCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  shareCodeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85',
    marginRight: 6
  },
  shareCodeValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1
  },
  qrCodeBox: {
    width: 200,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 24
  },
  instructionText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#596B85',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20
  }
});
