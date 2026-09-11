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
  ShieldLockIcon,
  ExclamationTriangleFillIcon,
  GraduationCapFillIcon
} from '../SvgIcons';

interface InfoCreditsModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy' | 'about';
}

export const InfoCreditsModal: React.FC<InfoCreditsModalProps> = ({
  visible,
  onClose,
  initialTab = 'terms'
}) => {
  const [selectedTab, setSelectedTab] = useState<'terms' | 'privacy' | 'about'>(initialTab);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navButtonPlaceholder} />
          <Text style={styles.navTitle}>About & Legal</Text>
          <TouchableOpacity onPress={onClose} style={styles.navButton} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Segmented Tab Selector */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[
              styles.segmentedTab,
              selectedTab === 'terms' && styles.segmentedTabActive
            ]}
            onPress={() => setSelectedTab('terms')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentedText,
                selectedTab === 'terms' && styles.segmentedTextActive
              ]}
            >
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentedTab,
              selectedTab === 'privacy' && styles.segmentedTabActive
            ]}
            onPress={() => setSelectedTab('privacy')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentedText,
                selectedTab === 'privacy' && styles.segmentedTextActive
              ]}
            >
              Privacy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentedTab,
              selectedTab === 'about' && styles.segmentedTabActive
            ]}
            onPress={() => setSelectedTab('about')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentedText,
                selectedTab === 'about' && styles.segmentedTextActive
              ]}
            >
              About
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={true}
        >
          {selectedTab === 'terms' && (
            <>
              {/* Terms Header */}
              <View style={styles.headerBlock}>
                <View style={styles.headerIconCircle}>
                  <ShieldLockIcon size={28} color={CoursePalTheme.accentBlue} />
                </View>
                <Text style={styles.headerTitle}>Terms of Service & Disclaimers</Text>
                <Text style={styles.headerSubtitle}>
                  Last Updated: August 2026 • Please read carefully before using CoursePal.
                </Text>
              </View>

              {/* Warning Banner */}
              <View style={styles.criticalNoticeBox}>
                <View style={styles.noticeIconCircle}>
                  <ExclamationTriangleFillIcon size={18} color="#EA580C" />
                </View>
                <View style={styles.noticeTextCol}>
                  <Text style={styles.noticeTitle}>Critical Academic Disclaimer</Text>
                  <Text style={styles.noticeBody}>
                    CoursePal is an auxiliary study organization tool. Your professor's official syllabus and university LMS (Canvas, Blackboard, Brightspace, Moodle) are the sole authoritative sources for all course requirements.
                  </Text>
                </View>
              </View>

              {/* Section 1: Verification Duty */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>1. ACADEMIC DISCLAIMER & VERIFICATION DUTY</Text>
                <Text style={styles.cardBody}>
                  • CoursePal is an auxiliary study aid designed to assist personal schedule organization.{'\n'}
                  • The official syllabus provided by your institution, official instructor announcements, emails, and your school's Learning Management System (Canvas, Blackboard, Brightspace, Moodle, D2L) remain the sole, final, and authoritative sources for all deadlines, exam schedules, and grading policies.{'\n'}
                  • You are solely, exclusively, and unconditionally responsible for cross-verifying all dates, times, assignment specifications, and milestone schedules generated or imported by CoursePal against your official syllabus.{'\n'}
                  • Optical Character Recognition (OCR) and Artificial Intelligence (AI) parsing may occasionally misread, misinterpret, omit, or inaccurately extract text due to document scan quality, formatting anomalies, or instructor revisions. CoursePal makes NO warranty of 100% automated parsing precision or completeness.
                </Text>
              </View>

              {/* Section 2: Limitation of Liability */}
              <View style={[styles.legalCard, styles.alertBorder]}>
                <Text style={[styles.cardHeader, styles.alertHeader]}>
                  2. COMPLETE LIMITATION OF LIABILITY & WAIVER OF CLAIMS
                </Text>
                <Text style={styles.cardBody}>
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:{'\n'}
                  • In no event shall CoursePal, its creators, developers, owners, contributors, affiliates, or licensors be liable to you or any third party for any direct, indirect, incidental, consequential, special, punitive, or exemplary damages arising from or relating to your use of, or inability to use, the application.{'\n'}
                  • This includes, without limitation: missed assignment deadlines, late submission penalties, missed midterms, quizzes, or exams, grade reductions or deductions, failing grades, loss of scholarship or financial aid, placement on academic probation, academic suspension, expulsion, or any other academic, institutional, disciplinary, professional, reputation, or financial damages.{'\n'}
                  • Your sole and exclusive remedy for dissatisfaction with CoursePal or any data, dates, or schedules parsed by it is to immediately stop using and uninstall the application.
                </Text>
              </View>

              {/* Section 3: Indemnification */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>3. INDEMNIFICATION & HOLD HARMLESS</Text>
                <Text style={styles.cardBody}>
                  You agree to defend, indemnify, and hold harmless CoursePal, its developers, operators, and agents from and against any and all claims, actions, suits, losses, liabilities, damages, penalties, and legal expenses arising out of or related to your use of CoursePal, your reliance on extracted course schedules, or your breach of these Terms.
                </Text>
              </View>

              {/* Section 4: AS-IS Warranty */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>4. "AS IS" AND "AS AVAILABLE" DISCLAIMER</Text>
                <Text style={styles.cardBody}>
                  CoursePal is provided strictly on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express, statutory, or implied, including the implied warranties of merchantability, fitness for a particular academic purpose, and error-free operation.
                </Text>
              </View>

              {/* Section 5: Academic Integrity */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>5. ACADEMIC INTEGRITY & HONOR CODES</Text>
                <Text style={styles.cardBody}>
                  CoursePal is designed solely for personal time-management and schedule tracking. Users must at all times comply with their educational institution's academic honor codes and codes of conduct. CoursePal does not complete assignments or promote academic dishonesty.
                </Text>
              </View>

              {/* Section 6: Intellectual Property & Fair Use */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>6. INTELLECTUAL PROPERTY & FAIR USE</Text>
                <Text style={styles.cardBody}>
                  CoursePal is designed solely for personal, non-commercial academic study and organization. Uploading course documents for personal schedule organization constitutes Fair Dealing and Fair Use (17 U.S.C. § 107). Syllabus documents remain the intellectual property of their respective creators and institutions.
                </Text>
              </View>

              {/* Section 7: Governing Law */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>7. GOVERNING LAW & SEVERABILITY</Text>
                <Text style={styles.cardBody}>
                  These Terms are governed by and construed in accordance with applicable laws. If any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect.
                </Text>
              </View>
            </>
          )}

          {selectedTab === 'privacy' && (
            <>
              {/* Privacy Header */}
              <View style={styles.headerBlock}>
                <View style={[styles.headerIconCircle, { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
                  <ShieldLockIcon size={28} color="#059669" />
                </View>
                <Text style={styles.headerTitle}>Privacy Policy & Data Governance</Text>
                <Text style={styles.headerSubtitle}>
                  Committed to privacy-first, on-device data sovereignty.
                </Text>
              </View>

              {/* Section 1: Local-First Storage */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>1. LOCAL-FIRST ON-DEVICE STORAGE</Text>
                <Text style={styles.cardBody}>
                  CoursePal operates on a Local-First Privacy Model. Your course schedules, syllabus files, assignments, readings, and notes are saved directly on your personal device within Apple's hardware-encrypted application sandbox. We do not operate a centralized database storing your personal academic records.
                </Text>
              </View>

              {/* Section 2: AI Processing */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>2. AI PROCESSING & ZERO MODEL TRAINING</Text>
                <Text style={styles.cardBody}>
                  When you parse a syllabus document:{'\n'}
                  • Transient Processing: Document contents are transmitted securely via encrypted HTTPS (TLS 1.3) solely for real-time extraction into structured schedule items.{'\n'}
                  • Zero Model Training: Your private course syllabi, assignments, and schedules are NEVER used to train public or foundation AI models.{'\n'}
                  • Optional: Automated parsing is optional. You may add and manage all courses and tasks manually offline at any time.
                </Text>
              </View>

              {/* Section 3: Zero Data Selling */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>3. ZERO DATA SELLING & NO AD TRACKING</Text>
                <Text style={styles.cardBody}>
                  CoursePal maintains a strict zero-data-monetization policy:{'\n'}
                  • We do not sell, rent, license, or disclose your personal data to data brokers or third parties.{'\n'}
                  • We do not use third-party advertising SDKs or tracking cookies.
                </Text>
              </View>

              {/* Section 4: Right to Erasure */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>4. DATA PURGE & RIGHT TO ERASURE</Text>
                <Text style={styles.cardBody}>
                  You retain complete ownership over your data at all times:{'\n'}
                  • Deleting any course, assignment, or syllabus permanently removes it from your local storage and cache.{'\n'}
                  • Uninstalling the app permanently purges 100% of stored data from your device.
                </Text>
              </View>

              {/* Section 5: Support */}
              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>5. PRIVACY INQUIRIES & SUPPORT</Text>
                <Text style={styles.cardBody}>
                  For privacy questions, data requests, or support inquiries, contact the team at support@coursepal.app.
                </Text>
              </View>
            </>
          )}

          {selectedTab === 'about' && (
            <>
              {/* About Header */}
              <View style={styles.headerBlock}>
                <View style={styles.headerIconCircle}>
                  <GraduationCapFillIcon size={32} color={CoursePalTheme.accentBlue} />
                </View>
                <Text style={styles.headerTitle}>CoursePal Mobile</Text>
                <Text style={styles.versionBadge}>Version 1.4.0 (Build 42)</Text>
              </View>

              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>APPLICATION OVERVIEW</Text>
                <Text style={styles.cardBody}>
                  CoursePal is a high-performance course companion designed to transform unstructured university syllabi into organized, actionable weekly schedules, reading goals, and assignment milestones.
                </Text>
              </View>

              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>ENGINEERING & ARCHITECTURE</Text>
                <Text style={styles.cardBody}>
                  • Framework: React Native Bare Workflow & TypeScript{'\n'}
                  • Typography & Icons: Apple SF Pro & sub-pixel vector SVG rendering{'\n'}
                  • Document Engine: Hybrid multi-tier neural syllabus parsing with localized fallback{'\n'}
                  • Persistence: Hardware-sandboxed transactional JSON backup and disaster recovery{'\n'}
                  • Background Processing: Native background execution tasks for uninterrupted syllabus analysis
                </Text>
              </View>

              <View style={styles.legalCard}>
                <Text style={styles.cardHeader}>DEVELOPER CONTACT</Text>
                <Text style={styles.cardBody}>
                  For feedback, feature suggestions, or institutional partnerships, reach out to us at support@coursepal.app.
                </Text>
              </View>
            </>
          )}
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
  navButtonPlaceholder: {
    width: 50
  },
  navButton: {
    minWidth: 50,
    alignItems: 'flex-end'
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141F38'
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: CoursePalTheme.accentBlue
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8EDF5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 3
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  segmentedTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2
  },
  segmentedText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#596B85'
  },
  segmentedTextActive: {
    color: '#141F38',
    fontWeight: '700'
  },
  scrollContent: {
    flex: 1
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 40,
    gap: 12
  },
  headerBlock: {
    alignItems: 'center',
    marginVertical: 10
  },
  headerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 4,
    textAlign: 'center'
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#596B85',
    textAlign: 'center',
    paddingHorizontal: 16
  },
  versionBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue,
    backgroundColor: 'rgba(36, 112, 245, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 2
  },
  criticalNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 12,
    alignItems: 'flex-start'
  },
  noticeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  noticeTextCol: {
    flex: 1
  },
  noticeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#C2410C',
    marginBottom: 4
  },
  noticeBody: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9A3412',
    lineHeight: 17
  },
  legalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1
  },
  alertBorder: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB'
  },
  cardHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 8,
    letterSpacing: 0.2
  },
  alertHeader: {
    color: '#B91C1C'
  },
  cardBody: {
    fontSize: 12,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 18
  }
});
