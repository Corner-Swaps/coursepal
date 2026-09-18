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
import { AppIconLogo } from '../AppIconLogo';
import {
  DocTextViewfinderIcon,
  ShieldLockIcon,
  ExclamationTriangleFillIcon,
  DocFillIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  XMarkIcon
} from '../SvgIcons';
import { haptics } from '../../services/HapticsService';

interface WelcomeTermsModalProps {
  visible: boolean;
  onAccept: () => void;
}

export const WelcomeTermsModal: React.FC<WelcomeTermsModalProps> = ({ visible, onAccept }) => {
  const [showingLegalSheet, setShowingLegalSheet] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'disclaimer'>('privacy');

  if (!visible) return null;

  const handleAgreeAndContinue = async () => {
    await haptics.notifySuccess();
    onAccept();
  };

  const handleOpenLegal = async (tab: 'terms' | 'privacy' | 'disclaimer') => {
    await haptics.impactLight();
    setLegalTab(tab);
    setShowingLegalSheet(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            {/* Header: App Icon, Title & Subtitle */}
            <View style={styles.headerContainer}>
              <View style={styles.logoWrapper}>
                <AppIconLogo size={68} />
              </View>
              <Text style={styles.mainTitle}>Welcome to CoursePal</Text>
              <Text style={styles.mainSubtitle}>
                Private, intelligent syllabus & course schedule companion
              </Text>
            </View>

            {/* Structured Privacy & Feature Pillars */}
            <View style={styles.pillarsContainer}>
              {/* Pillar 1: 100% On-Device Privacy */}
              <View style={styles.pillarRow}>
                <View style={[styles.pillarIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <ShieldLockIcon size={20} color="#059669" />
                </View>
                <View style={styles.pillarTextCol}>
                  <Text style={styles.pillarTitle}>100% On-Device Privacy</Text>
                  <Text style={styles.pillarDescription}>
                    Your syllabi, notes, and schedules stay securely on your device. Zero tracking, zero ads, and zero selling of personal student data.
                  </Text>
                </View>
              </View>

              {/* Pillar 2: Intelligent Ingestion */}
              <View style={styles.pillarRow}>
                <View style={[styles.pillarIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <DocTextViewfinderIcon size={20} color="#2470F5" />
                </View>
                <View style={styles.pillarTextCol}>
                  <Text style={styles.pillarTitle}>Smart Syllabus Ingestion</Text>
                  <Text style={styles.pillarDescription}>
                    Transforms complex course PDFs into an organized timeline with readings, assignments, rubrics, and deadlines.
                  </Text>
                </View>
              </View>

              {/* Pillar 3: Academic Diligence */}
              <View style={styles.pillarRow}>
                <View style={[styles.pillarIconBox, { backgroundColor: '#FFFBEB' }]}>
                  <ExclamationTriangleFillIcon size={20} color="#D97706" />
                </View>
                <View style={styles.pillarTextCol}>
                  <Text style={styles.pillarTitle}>Academic Due Diligence</Text>
                  <Text style={styles.pillarDescription}>
                    CoursePal is an auxiliary study aid. Always verify deadlines with your institution&apos;s official syllabus and LMS (Canvas, Blackboard).
                  </Text>
                </View>
              </View>

              {/* Pillar 4: Terms & Privacy Policies (Same section style as the others, NO pill) */}
              <TouchableOpacity
                style={styles.pillarRowClickable}
                onPress={() => handleOpenLegal('privacy')}
                activeOpacity={0.7}
              >
                <View style={[styles.pillarIconBox, { backgroundColor: '#F5F3FF' }]}>
                  <DocFillIcon size={20} color="#7C3AED" />
                </View>
                <View style={styles.pillarTextCol}>
                  <View style={styles.pillarTitleWithChevron}>
                    <Text style={styles.pillarTitle}>Terms, Privacy & Disclaimer</Text>
                    <ChevronRightIcon size={14} color="#94A3B8" />
                  </View>
                  <Text style={styles.pillarDescription}>
                    Clear student data ownership, honor code integrity, and institutional boundaries. Tap to read our complete policy reader.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Apple HIG Solid Slate/Black Agree & Continue Button (Not Blue) */}
            <TouchableOpacity
              style={styles.agreeButtonPill}
              onPress={handleAgreeAndContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.agreeButtonText}>Agree & Continue</Text>
              <ArrowRightIcon size={16} color="#FFFFFF" strokeWidth={2.8} />
            </TouchableOpacity>

            {/* Micro Legal Caption */}
            <Text style={styles.microLegalCaption}>
              By tapping Agree & Continue, you confirm you are at least 13 years old and agree to our Terms of Service & Privacy Policy.
            </Text>

            {/* Full Terms & Privacy Reader In-Modal Sheet */}
            {showingLegalSheet && (
              <View style={styles.legalOverlay}>
                <View style={styles.legalHeaderRow}>
                  <Text style={styles.legalSheetTitle}>Terms & Privacy Policies</Text>
                  <TouchableOpacity
                    onPress={() => setShowingLegalSheet(false)}
                    style={styles.closeCircleBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <XMarkIcon size={18} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Clean Segmented Tab Control */}
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segBtn, legalTab === 'privacy' && styles.segBtnActive]}
                    onPress={() => {
                      haptics.selection();
                      setLegalTab('privacy');
                    }}
                  >
                    <Text style={[styles.segBtnText, legalTab === 'privacy' && styles.segBtnTextActive]}>
                      Privacy Policy
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.segBtn, legalTab === 'terms' && styles.segBtnActive]}
                    onPress={() => {
                      haptics.selection();
                      setLegalTab('terms');
                    }}
                  >
                    <Text style={[styles.segBtnText, legalTab === 'terms' && styles.segBtnTextActive]}>
                      Terms of Service
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.segBtn, legalTab === 'disclaimer' && styles.segBtnActive]}
                    onPress={() => {
                      haptics.selection();
                      setLegalTab('disclaimer');
                    }}
                  >
                    <Text style={[styles.segBtnText, legalTab === 'disclaimer' && styles.segBtnTextActive]}>
                      Disclaimer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Reader ScrollView */}
                <ScrollView style={styles.legalScrollView} showsVerticalScrollIndicator={true}>
                  {legalTab === 'privacy' && (
                    <View style={styles.policyContent}>
                      <View style={styles.policyHeaderBadge}>
                        <ShieldLockIcon size={18} color="#059669" />
                        <Text style={styles.policyBadgeText}>Student Privacy Guarantee</Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>1. 100% On-Device Sandboxed Storage</Text>
                        <Text style={styles.policyBodyText}>
                          All course syllabi, assignments, personal notes, study milestones, and grades reside exclusively inside your device&apos;s sandboxed local filesystem. We never transmit your personal documents to unauthorized third parties.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>2. Zero Data Selling & Zero Tracking</Text>
                        <Text style={styles.policyBodyText}>
                          We do not sell, rent, monetize, or broker personal student information. CoursePal contains zero third-party advertising SDKs, cross-app tracking beacons, or behavioral tracking identifiers.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>3. Secure Visual AI Processing</Text>
                        <Text style={styles.policyBodyText}>
                          When parsing syllabus documents with multimodal AI, page visuals are sent solely to secure endpoint APIs for direct document structure parsing and are never retained to train public commercial AI models.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>4. Complete User Data Sovereignty</Text>
                        <Text style={styles.policyBodyText}>
                          You have absolute control over your academic data. You may export backup archives, clear individual courses, or purge all local records instantly from within the application settings.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>5. Age Requirement & Canadian PIPEDA Compliance</Text>
                        <Text style={styles.policyBodyText}>
                          CoursePal is designed for high school and university students. You must be at least 13 years of age to use this app. If you are under the age of majority in your province or state (e.g., 19 in British Columbia, 18 in Ontario/Alberta), you confirm you have parental or legal guardian consent. We operate in full compliance with Canada&apos;s PIPEDA, provincial privacy laws, and U.S. COPPA standards.
                        </Text>
                      </View>
                    </View>
                  )}

                  {legalTab === 'terms' && (
                    <View style={styles.policyContent}>
                      <View style={styles.policyHeaderBadge}>
                        <DocFillIcon size={18} color="#7C3AED" />
                        <Text style={[styles.policyBadgeText, { color: '#7C3AED' }]}>Terms of Service</Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>1. Auxiliary Study Companion</Text>
                        <Text style={styles.policyBodyText}>
                          CoursePal is an independent productivity assistant designed to help college and university students structure course schedules, monitor reading lists, and organize assignment deliverables.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>2. Academic Honor Code & Integrity</Text>
                        <Text style={styles.policyBodyText}>
                          You agree to use CoursePal in strict compliance with your university&apos;s student code of conduct and academic integrity standards. CoursePal must not be used to bypass institutional deadlines or policies.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>3. Verification Due Diligence</Text>
                        <Text style={styles.policyBodyText}>
                          Students remain solely responsible for confirming all dates, assignment instructions, textbook editions, and grading criteria against the official syllabus provided directly by course faculty.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>4. &quot;As-Is&quot; Software Warranty & Liability</Text>
                        <Text style={styles.policyBodyText}>
                          CoursePal is provided &quot;AS IS&quot; without express or implied warranties. CoursePal and its developers assume zero legal or academic liability for missed deadlines, late submissions, or parsing discrepancies.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>5. Canadian Law, Educational Fair Dealing & DMCA</Text>
                        <Text style={styles.policyBodyText}>
                          These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada. Uploading and organizing course schedules constitutes Fair Dealing for Education under Section 29 of the Copyright Act of Canada (R.S.C., 1985, c. C-42) and U.S. Fair Use (17 U.S.C. § 107). For copyright notices or legal inquiries: legal@coursepal.app.
                        </Text>
                      </View>
                    </View>
                  )}

                  {legalTab === 'disclaimer' && (
                    <View style={styles.policyContent}>
                      <View style={styles.policyHeaderBadge}>
                        <ExclamationTriangleFillIcon size={18} color="#D97706" />
                        <Text style={[styles.policyBadgeText, { color: '#D97706' }]}>Academic Disclaimer</Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>1. Official LMS is the Authoritative Truth</Text>
                        <Text style={styles.policyBodyText}>
                          Your university&apos;s Learning Management System (Canvas, Blackboard, Brightspace, Moodle) and your professors&apos; direct verbal/written notices are the single authoritative sources of truth for course requirements.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>2. AI & OCR Verification Notice</Text>
                        <Text style={styles.policyBodyText}>
                          Computer vision and Large Language Models interpret complex multi-column documents. While highly accurate, users must inspect extracted assignments, due dates, and readings to ensure complete alignment with official course schedules.
                        </Text>
                      </View>

                      <View style={styles.policySectionCard}>
                        <Text style={styles.policySectionHeading}>3. Non-Affiliation Statement</Text>
                        <Text style={styles.policyBodyText}>
                          CoursePal is an independent application and is not endorsed by, sponsored by, or officially affiliated with any university, college, or third-party learning management system.
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Back to Welcome Button (Clean subtle button, not blue) */}
                <TouchableOpacity
                  style={styles.backToWelcomeBtn}
                  onPress={() => setShowingLegalSheet(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backToWelcomeText}>Back to Welcome</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  card: {
    width: '100%',
    maxWidth: 425,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoWrapper: {
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4
  },
  mainTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: -0.4
  },
  mainSubtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10
  },
  pillarsContainer: {
    width: '100%',
    gap: 15,
    marginBottom: 22
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14
  },
  pillarRowClickable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14
  },
  pillarTitleWithChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  pillarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  pillarTextCol: {
    flex: 1
  },
  pillarTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.2
  },
  pillarDescription: {
    fontSize: 12.5,
    fontWeight: '400',
    color: '#64748B',
    lineHeight: 17
  },
  agreeButtonPill: {
    width: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 26,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 4
  },
  agreeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  microLegalCaption: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 10,
    paddingHorizontal: 12
  },
  legalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    zIndex: 20,
    justifyContent: 'space-between'
  },
  legalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  legalSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  closeCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  segBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  segBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700'
  },
  legalScrollView: {
    flex: 1,
    marginBottom: 14
  },
  policyContent: {
    paddingVertical: 4
  },
  policyHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12
  },
  policyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669'
  },
  policySectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  policySectionHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4
  },
  policyBodyText: {
    fontSize: 12.5,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 18
  },
  backToWelcomeBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  backToWelcomeText: {
    color: '#0284C7',
    fontSize: 14.5,
    fontWeight: '700'
  }
});


