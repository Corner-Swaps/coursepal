import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal
} from 'react-native';
import { CoursePalTheme } from '../../constants/theme';
import { ShieldLockIcon } from '../SvgIcons';

interface WelcomeTermsModalProps {
  visible: boolean;
  onAccept: () => void;
}

export const WelcomeTermsModal: React.FC<WelcomeTermsModalProps> = ({ visible, onAccept }) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldLockIcon size={36} color={CoursePalTheme.accentBlue} />
          </View>

          <Text style={styles.title}>Welcome to CoursePal</Text>
          <Text style={styles.description}>
            By continuing, you agree to our Terms of Service and acknowledge our Privacy Policy. CoursePal organizes course syllabi and helps keep you on track with assignments and readings.
          </Text>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptButtonText}>I Agree & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 10,
    textAlign: 'center'
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24
  },
  acceptButton: {
    width: '100%',
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  }
});
