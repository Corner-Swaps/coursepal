import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { CoursePalTheme } from '../../constants/theme';
import { ShieldLockIcon } from '../SvgIcons';

interface InfoCreditsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InfoCreditsModal: React.FC<InfoCreditsModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navButton} />
          <Text style={styles.navTitle}>About & Legal</Text>
          <TouchableOpacity onPress={onClose} style={styles.navButton} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
          <View style={styles.heroSection}>
            <View style={styles.shieldCircle}>
              <ShieldLockIcon size={32} color={CoursePalTheme.accentBlue} />
            </View>
            <Text style={styles.appTitle}>CoursePal Mobile</Text>
            <Text style={styles.versionText}>Version 1.4.0 (Build 42)</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Privacy & Security</Text>
            <Text style={styles.bodyText}>
              CoursePal processes your course syllabi and assignments using on-device parsing and secure, sandboxed cloud intelligence. We do not sell or monetize personal academic records.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Terms of Service</Text>
            <Text style={styles.bodyText}>
              Course schedules, readings, and assignment dates extracted from uploaded PDFs are automatically organized for personal academic tracking. Please verify deadlines with your institution's official learning management system.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Credits & Engineering</Text>
            <Text style={styles.bodyText}>
              Built with React Native Bare Workflow & TypeScript. Featuring sub-pixel vector rendering, continuous progress rings, and deterministic neural document parsing.
            </Text>
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
  scrollContent: {
    flex: 1
  },
  scrollInner: {
    padding: 20,
    gap: 16
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 10
  },
  shieldCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 2
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#596B85'
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 6
  },
  bodyText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    lineHeight: 18
  }
});
