import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView
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
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'about'>('terms');

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
                onPress={() => {
                  setSelectedFeature(item);
                }}
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

          {/* Feature Detail In-Modal Overlay (NO nested Modal) */}
          {selectedFeature && (
            <View style={styles.detailOverlay}>
              <View style={styles.detailInnerCard}>
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
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          )}

          {/* Full Legal In-Modal Overlay (NO nested Modal) */}
          {showingLegalSheet && (
            <View style={styles.legalOverlay}>
              <View style={styles.legalInnerCard}>
                <View style={styles.legalHeaderRow}>
                  <Text style={styles.legalTitle}>Legal Policies & Terms</Text>
                  <TouchableOpacity
                    onPress={() => setShowingLegalSheet(false)}
                    style={styles.closeButton}
                    activeOpacity={0.7}
                  >
                    <XMarkIcon size={18} color="#596B85" />
                  </TouchableOpacity>
                </View>

                {/* Segmented Switcher */}
                <View style={styles.segmentedRow}>
                  <TouchableOpacity
                    style={[styles.segBtn, legalTab === 'terms' && styles.segBtnActive]}
                    onPress={() => setLegalTab('terms')}
                  >
                    <Text style={[styles.segBtnText, legalTab === 'terms' && styles.segBtnTextActive]}>Terms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segBtn, legalTab === 'privacy' && styles.segBtnActive]}
                    onPress={() => setLegalTab('privacy')}
                  >
                    <Text style={[styles.segBtnText, legalTab === 'privacy' && styles.segBtnTextActive]}>Privacy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segBtn, legalTab === 'about' && styles.segBtnActive]}
                    onPress={() => setLegalTab('about')}
                  >
                    <Text style={[styles.segBtnText, legalTab === 'about' && styles.segBtnTextActive]}>Disclaimer</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={true}>
                  {legalTab === 'terms' && (
                    <Text style={styles.legalBody}>
                      By using CoursePal, you agree that you are solely responsible for verifying all course deliverables, assignment deadlines, reading schedules, and exam dates against the official syllabus provided by your educational institution and course instructors.{'\n\n'}
                      CoursePal is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. CoursePal and its creators assume zero liability for academic consequences, missed deadlines, late penalties, or parsing inaccuracies.
                    </Text>
                  )}
                  {legalTab === 'privacy' && (
                    <Text style={styles.legalBody}>
                      CoursePal is engineered with a strict local-first architecture. All syllabus documents, course notes, and schedules are stored securely in local device storage on your iOS device.{'\n\n'}
                      We do not sell, rent, monetize, or track your personal academic data. We do not use third-party behavioral analytics or advertising tracking SDKs.
                    </Text>
                  )}
                  {legalTab === 'about' && (
                    <Text style={styles.legalBody}>
                      CoursePal leverages artificial intelligence for optical character recognition and document structure analysis. AI models can make errors, misread dates, or skip sections.{'\n\n'}
                      Always cross-reference your generated timeline with Canvas, Blackboard, Brightspace, Moodle, or your professor&apos;s direct instructions.
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.legalDoneBtn}
                  onPress={() => setShowingLegalSheet(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.legalDoneBtnText}>Back to Welcome</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    elevation: 10,
    overflow: 'hidden'
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
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    justifyContent: 'space-between',
    zIndex: 10
  },
  detailInnerCard: {
    flex: 1,
    justifyContent: 'space-between'
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
    padding: 6
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 8
  },
  detailDescription: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 20,
    marginBottom: 20
  },
  gotItButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto'
  },
  gotItText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  legalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    zIndex: 10
  },
  legalInnerCard: {
    flex: 1
  },
  legalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  legalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141F38'
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12
  },
  segBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  segBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  segBtnTextActive: {
    color: '#141F38',
    fontWeight: '700'
  },
  legalScroll: {
    flex: 1,
    marginBottom: 12
  },
  legalBody: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18
  },
  legalDoneBtn: {
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  legalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700'
  }
});


