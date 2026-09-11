import React, { useState } from 'react';
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
import {
  GraduationCapFillIcon,
  DocTextViewfinderIcon,
  ShieldLockIcon,
  ExclamationTriangleFillIcon,
  DocFillIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  XMarkIcon
} from '../SvgIcons';
import { InfoCreditsModal } from './InfoCreditsModal';

interface FeatureDetailItem {
  id: string;
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
}

interface WelcomeTermsModalProps {
  visible: boolean;
  onAccept: () => void;
}

export const WelcomeTermsModal: React.FC<WelcomeTermsModalProps> = ({ visible, onAccept }) => {
  const [selectedFeature, setSelectedFeature] = useState<FeatureDetailItem | null>(null);
  const [showingLegalSheet, setShowingLegalSheet] = useState<boolean>(false);

  if (!visible) return null;

  const featureItems: FeatureDetailItem[] = [
    {
      id: 'parser',
      icon: <DocTextViewfinderIcon size={16} color="#2470F5" />,
      iconColor: '#2470F5',
      title: 'Smart Syllabus Parser',
      shortDescription: 'Auto-extract readings, deadlines & exams from PDF',
      fullDescription:
        'Upload any course syllabus document. CoursePal uses artificial intelligence to automatically identify weekly reading chapters, assignment deadlines, point weights, and exam schedules to keep your semester structured.'
    },
    {
      id: 'privacy',
      icon: <ShieldLockIcon size={16} color="#059669" />,
      iconColor: '#059669',
      title: 'Private & Local-First',
      shortDescription: '100% on-device storage with zero data selling',
      fullDescription:
        'Your academic files, coursework schedules, and personal records are stored locally on your device within hardware-encrypted sandboxing. Zero data tracking, zero ads, and zero selling of personal student records.'
    },
    {
      id: 'disclaimer',
      icon: <ExclamationTriangleFillIcon size={16} color="#EA580C" />,
      iconColor: '#EA580C',
      title: 'Academic Duty & AI Disclaimer',
      shortDescription: 'AI may make mistakes • Always verify with LMS',
      fullDescription:
        'CoursePal is an auxiliary study aid. AI parsing may make errors or omit items. Your institution\'s official syllabus and LMS (Canvas, Blackboard, Brightspace, Moodle) remain the sole authoritative sources for all deadlines. CoursePal and its creators are not liable for missed deadlines, late penalties, or academic consequences.'
    }
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* App Logo Badge */}
          <View style={styles.iconCircle}>
            <GraduationCapFillIcon size={30} color="#FFFFFF" />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Welcome to CoursePal</Text>
          <Text style={styles.subtitle}>
            Your smart syllabus & course schedule companion
          </Text>

          {/* 4 Interactive Feature / Legal Pills */}
          <View style={styles.pillsContainer}>
            {featureItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.pillRow}
                onPress={() => setSelectedFeature(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.pillIconBox,
                    { backgroundColor: `${item.iconColor}15` }
                  ]}
                >
                  {item.icon}
                </View>

                <View style={styles.pillTextCol}>
                  <Text style={styles.pillTitle}>{item.title}</Text>
                  <Text style={styles.pillDesc} numberOfLines={1}>
                    {item.shortDescription}
                  </Text>
                </View>

                <ChevronRightIcon size={12} color="#8E9BAE" />
              </TouchableOpacity>
            ))}

            {/* Pill 4: Terms of Service & Privacy Policy */}
            <TouchableOpacity
              style={styles.pillRow}
              onPress={() => setShowingLegalSheet(true)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.pillIconBox,
                  { backgroundColor: 'rgba(89, 107, 133, 0.12)' }
                ]}
              >
                <DocFillIcon size={16} color="#596B85" />
              </View>

              <View style={styles.pillTextCol}>
                <Text style={styles.pillTitle}>Terms of Service & Privacy Policy</Text>
                <Text style={styles.pillDesc} numberOfLines={1}>
                  By continuing you agree to our legal policies
                </Text>
              </View>

              <ChevronRightIcon size={12} color="#8E9BAE" />
            </TouchableOpacity>
          </View>

          {/* Big Agree & Continue Button */}
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptButtonText}>Agree & Continue</Text>
            <ArrowRightIcon size={14} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feature Detail Modal Sheet */}
      {selectedFeature && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.detailBackdrop}>
            <View style={styles.detailCard}>
              <View style={styles.detailTopRow}>
                <View
                  style={[
                    styles.detailIconCircle,
                    { backgroundColor: `${selectedFeature.iconColor}15` }
                  ]}
                >
                  {selectedFeature.icon}
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedFeature(null)}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <XMarkIcon size={18} color="#596B85" />
                </TouchableOpacity>
              </View>

              <Text style={styles.detailTitle}>{selectedFeature.title}</Text>
              <Text style={styles.detailDescription}>
                {selectedFeature.fullDescription}
              </Text>

              <TouchableOpacity
                style={[
                  styles.gotItButton,
                  { backgroundColor: selectedFeature.iconColor }
                ]}
                onPress={() => setSelectedFeature(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.gotItText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Full Legal Modal */}
      <InfoCreditsModal
        visible={showingLegalSheet}
        onClose={() => setShowingLegalSheet(false)}
        initialTab="terms"
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: CoursePalTheme.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: CoursePalTheme.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 4,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#596B85',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 8
  },
  pillsContainer: {
    width: '100%',
    gap: 8,
    marginBottom: 18
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10
  },
  pillIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillTextCol: {
    flex: 1
  },
  pillTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 2
  },
  pillDesc: {
    fontSize: 11,
    fontWeight: '400',
    color: '#596B85'
  },
  acceptButton: {
    width: '100%',
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: CoursePalTheme.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  detailCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  detailIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButton: {
    padding: 4
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 8
  },
  detailDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 19,
    marginBottom: 20
  },
  gotItButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gotItText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});

