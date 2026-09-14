import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Clipboard
} from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { Course } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import { CopyDocIcon } from '../SvgIcons';
import { CourseSharingService } from '../../services/CourseSharingService';
import { haptics } from '../../services/HapticsService';

interface QRCodeModalProps {
  visible: boolean;
  course: Course | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ visible, course, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!visible || !course) return null;

  const shareLink = CourseSharingService.shared.generateShareLink(course);

  const handleCopyLink = () => {
    Clipboard.setString(shareLink);
    haptics.notifySuccess();
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
    }, 2000);
  };

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
            <Svg width={180} height={180} viewBox="0 0 100 100">
              {/* Outer boundary */}
              <Rect x="0" y="0" width="100" height="100" fill="#FFFFFF" rx="4" />
              
              {/* Top-Left Finder Pattern */}
              <Rect x="6" y="6" width="26" height="26" rx="4" fill="none" stroke={course.hexColor} strokeWidth="4" />
              <Rect x="12" y="12" width="14" height="14" rx="2" fill={course.hexColor} />

              {/* Top-Right Finder Pattern */}
              <Rect x="68" y="6" width="26" height="26" rx="4" fill="none" stroke={course.hexColor} strokeWidth="4" />
              <Rect x="74" y="12" width="14" height="14" rx="2" fill={course.hexColor} />

              {/* Bottom-Left Finder Pattern */}
              <Rect x="6" y="68" width="26" height="26" rx="4" fill="none" stroke={course.hexColor} strokeWidth="4" />
              <Rect x="12" y="74" width="14" height="14" rx="2" fill={course.hexColor} />

              {/* Alignment and Timing grid modules */}
              <Path
                d="M38 10h6v6h-6z M50 10h6v6h-6z M38 20h4v4h-4z M48 20h8v4h-8z M10 38h6v6h-6z M20 38h4v4h-4z M10 50h4v4h-4z M20 50h6v6h-6z M38 38h8v8h-8z M52 38h6v6h-6z M64 38h8v4h-8z M80 38h6v6h-6z M38 52h4v6h-4z M48 48h10v6h-10z M64 48h6v6h-6z M76 48h10v6h-10z M38 64h8v4h-8z M50 64h6v6h-6z M62 60h6v8h-6z M74 62h12v4h-12z M38 74h4v6h-4z M46 72h6v8h-6z M58 74h8v6h-8z M72 74h6v6h-6z M82 72h6v8h-6z M38 86h8v4h-8z M52 84h8v6h-8z M66 86h6v4h-6z M78 84h8v6h-8z"
                fill={course.hexColor}
              />
            </Svg>
          </View>

          <Text style={styles.instructionText}>
            Classmates can scan this QR code or use the link below to enroll and load all {course.weeks?.reduce((acc, w) => acc + (w.readings?.length || 0), 0) || 0} readings & {course.assignments?.length || 0} assignments instantly.
          </Text>

          {/* Action Button: Copy Link */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: CoursePalTheme.accentBlue }]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              <CopyDocIcon size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {copiedLink ? 'Link Copied to Clipboard!' : 'Copy Invite Link'}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 20,
    marginBottom: 20
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
    paddingHorizontal: 12
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: CoursePalTheme.accentBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
