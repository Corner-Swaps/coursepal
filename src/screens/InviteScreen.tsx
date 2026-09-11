import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Clipboard
} from 'react-native';
import { useCoursePal } from '../context/CoursePalContext';
import { CoursePalTheme } from '../constants/theme';
import {
  QRCodeIcon,
  JoinArrowDownIcon,
  CopyDocIcon,
  ShieldLockIcon,
  ChevronRightIcon
} from '../components/SvgIcons';
import { Course } from '../types/models';
import { QRCodeModal } from '../components/modals/QRCodeModal';
import { InfoCreditsModal } from '../components/modals/InfoCreditsModal';

export const InviteScreen: React.FC = () => {
  const { courses, importShareCode } = useCoursePal();

  const [selectedCategory, setSelectedCategory] = useState<'share' | 'join' | 'legal'>('share');
  const [inputCode, setInputCode] = useState<string>('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSuccessNotice, setIsSuccessNotice] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrCodeCourse, setQrCodeCourse] = useState<Course | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState<boolean>(false);

  const activeCourses = courses.filter(c => !c.isDeleted);

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 1800);
  };

  const handleJoinCourse = () => {
    const res = importShareCode(inputCode);
    setIsSuccessNotice(res.success);
    setNoticeMessage(res.message);
    if (res.success) {
      setInputCode('');
    }
    setTimeout(() => {
      setNoticeMessage(null);
    }, 3500);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      alwaysBounceHorizontal={false}
      alwaysBounceVertical={true}
      bounces={true}
      overScrollMode="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      testID="invite-screen-scroll"
    >
      {/* MARK: - Page Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftCol}>
          <Text style={styles.pageTitle}>Invite</Text>
          <Text style={styles.pageSubtitle}>
            Share your courses or join someone else's
          </Text>
        </View>
      </View>

      {/* Toast Notice */}
      {noticeMessage && (
        <View
          style={[
            styles.noticeBanner,
            isSuccessNotice ? styles.noticeBannerSuccess : styles.noticeBannerError
          ]}
        >
          <Text style={styles.noticeText}>{noticeMessage}</Text>
        </View>
      )}

      {/* MARK: - Category Filter Bar (Share Codes vs Join Course vs About & Legal) */}
      <View style={styles.filterBarContainer}>
        {/* Tile 1: Share Codes */}
        <TouchableOpacity
          style={[
            styles.filterTile,
            selectedCategory === 'share' && styles.filterTileActive
          ]}
          onPress={() => setSelectedCategory('share')}
          activeOpacity={0.8}
          testID="invite-share-tab"
        >
          <QRCodeIcon
            size={18}
            color={selectedCategory === 'share' ? CoursePalTheme.accentBlue : '#596B85'}
          />
          <Text
            style={[
              styles.filterTileText,
              selectedCategory === 'share' && styles.filterTileTextActive
            ]}
            numberOfLines={1}
          >
            Share ({activeCourses.length})
          </Text>
        </TouchableOpacity>

        {/* Tile 2: Join Course */}
        <TouchableOpacity
          style={[
            styles.filterTile,
            selectedCategory === 'join' && styles.filterTileActive
          ]}
          onPress={() => setSelectedCategory('join')}
          activeOpacity={0.8}
          testID="invite-join-tab"
        >
          <JoinArrowDownIcon
            size={18}
            color={selectedCategory === 'join' ? '#8C45F5' : '#596B85'}
          />
          <Text
            style={[
              styles.filterTileText,
              selectedCategory === 'join' && styles.filterTileTextActive
            ]}
            numberOfLines={1}
          >
            Join Course
          </Text>
        </TouchableOpacity>

        {/* Tile 3: About & Legal */}
        <TouchableOpacity
          style={[
            styles.filterTile,
            selectedCategory === 'legal' && styles.filterTileActive
          ]}
          onPress={() => setSelectedCategory('legal')}
          activeOpacity={0.8}
          testID="invite-legal-tab"
        >
          <ShieldLockIcon
            size={18}
            color={selectedCategory === 'legal' ? '#059669' : '#596B85'}
          />
          <Text
            style={[
              styles.filterTileText,
              selectedCategory === 'legal' && styles.filterTileTextActive
            ]}
            numberOfLines={1}
          >
            About & Legal
          </Text>
        </TouchableOpacity>
      </View>

      {/* MARK: - Main Content Area */}
      {selectedCategory === 'share' ? (
        // Share Codes List
        <View style={styles.listContainer}>
          {activeCourses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Courses Available</Text>
              <Text style={styles.emptyDesc}>
                Upload a syllabus to get started — your course codes will appear here.
              </Text>
            </View>
          ) : (
            activeCourses.map(course => (
              <View key={course.id} style={styles.shareCodeCard}>
                {/* Left Accent Stripe */}
                <View style={[styles.leftAccentStripe, { backgroundColor: course.hexColor }]} />

                <View style={styles.courseInfoCol}>
                  <Text style={styles.courseCode}>{course.courseCode || course.courseName}</Text>
                  <Text style={styles.courseName}>{course.courseName}</Text>
                </View>

                {/* Sharing code pill + QR button */}
                <View style={styles.actionsGroup}>
                  <TouchableOpacity
                    style={[styles.codePill, { backgroundColor: `${course.hexColor}15` }]}
                    onPress={() => handleCopyCode(course.sharingCode)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.codePillText, { color: course.hexColor }]}>
                      {course.sharingCode}
                    </Text>
                    {copiedCode === course.sharingCode ? (
                      <Text style={styles.copiedBadgeText}>Copied</Text>
                    ) : (
                      <CopyDocIcon size={12} color={course.hexColor} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.qrButton, { backgroundColor: `${course.hexColor}18` }]}
                    onPress={() => setQrCodeCourse(course)}
                    activeOpacity={0.7}
                  >
                    <QRCodeIcon size={14} color={course.hexColor} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      ) : selectedCategory === 'join' ? (
        // Join Course Section
        <View style={styles.joinContainer}>
          <Text style={styles.joinSectionHeader}>JOIN A COURSE</Text>
          <View style={styles.joinCard}>
            <Text style={styles.joinCardTitle}>Got a code or link from a classmate?</Text>
            <Text style={styles.joinCardDesc}>
              Paste the link or enter the course code shared with you. CoursePal will load their course schedule, readings, and assignments.
            </Text>

            <View style={styles.joinInputBox}>
              <TextInput
                style={styles.joinInput}
                placeholder="Enter course code or paste link..."
                placeholderTextColor="#8E9BAE"
                value={inputCode}
                onChangeText={setInputCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={styles.joinSubmitButton}
              onPress={handleJoinCourse}
              activeOpacity={0.85}
            >
              <Text style={styles.joinSubmitButtonText}>Join Course</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // About & Legal Section
        <View style={styles.legalSectionContainer}>
          <View style={styles.aboutHeaderBanner}>
            <View style={styles.aboutShieldBadge}>
              <ShieldLockIcon size={24} color={CoursePalTheme.accentBlue} />
            </View>
            <Text style={styles.aboutHeaderTitle}>CoursePal Legal & Privacy</Text>
            <Text style={styles.aboutHeaderDesc}>
              Designed with private on-device storage. Review our academic disclaimer, complete limitation of liability, and privacy terms.
            </Text>
          </View>

          {/* Action Cards */}
          <TouchableOpacity
            style={styles.legalOptionCard}
            onPress={() => setShowInfoSheet(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.legalIconCircle, { backgroundColor: 'rgba(36, 112, 245, 0.12)' }]}>
              <ShieldLockIcon size={18} color="#2470F5" />
            </View>
            <View style={styles.legalTextCol}>
              <Text style={styles.legalTitle}>Terms of Service & Disclaimer</Text>
              <Text style={styles.legalDesc}>Academic disclaimer, verification duty & hold harmless</Text>
            </View>
            <ChevronRightIcon size={13} color="#73859E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalOptionCard}
            onPress={() => setShowInfoSheet(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.legalIconCircle, { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
              <ShieldLockIcon size={18} color="#059669" />
            </View>
            <View style={styles.legalTextCol}>
              <Text style={styles.legalTitle}>Privacy Policy</Text>
              <Text style={styles.legalDesc}>100% on-device sandbox, zero selling & zero AI training</Text>
            </View>
            <ChevronRightIcon size={13} color="#73859E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalOptionCard}
            onPress={() => setShowInfoSheet(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.legalIconCircle, { backgroundColor: 'rgba(140, 69, 245, 0.12)' }]}>
              <ShieldLockIcon size={18} color="#8C45F5" />
            </View>
            <View style={styles.legalTextCol}>
              <Text style={styles.legalTitle}>About CoursePal & Support</Text>
              <Text style={styles.legalDesc}>Version 1.4.0, contact & engineering architecture</Text>
            </View>
            <ChevronRightIcon size={13} color="#73859E" />
          </TouchableOpacity>

          {/* Academic Duty Note Pill */}
          <View style={styles.academicWarningCard}>
            <Text style={styles.academicWarningTitle}>Official Syllabus Primacy Notice</Text>
            <Text style={styles.academicWarningBody}>
              CoursePal is an auxiliary student aid. Your university syllabus, instructor communications, and LMS (Canvas, Blackboard, Brightspace, Moodle) remain the sole authoritative records. Always cross-verify deliverables with your official syllabus.
            </Text>
          </View>
        </View>
      )}

      {/* Modals */}
      <QRCodeModal
        visible={qrCodeCourse !== null}
        course={qrCodeCourse}
        onClose={() => setQrCodeCourse(null)}
      />

      <InfoCreditsModal
        visible={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA',
    width: '100%'
  },
  scrollContent: {
    paddingBottom: 140
  },
  headerRow: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12
  },
  headerLeftCol: {},
  pageTitle: {
    fontSize: 21.5,
    fontWeight: '700',
    color: '#141F38',
    letterSpacing: -0.4
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 2
  },
  noticeBanner: {
    marginHorizontal: 18,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12
  },
  noticeBannerSuccess: {
    backgroundColor: 'rgba(46, 184, 102, 0.15)'
  },
  noticeBannerError: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)'
  },
  noticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141F38'
  },
  filterBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    marginHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10
  },
  filterTile: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10.5,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    gap: 5
  },
  filterTileActive: {
    backgroundColor: '#EDF0F5',
    borderColor: '#D1D9E6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2
  },
  filterTileText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  filterTileTextActive: {
    fontWeight: '700',
    color: '#141F38'
  },
  listContainer: {
    marginHorizontal: 18,
    marginTop: 16,
    gap: 10
  },
  shareCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 10
  },
  leftAccentStripe: {
    width: 4,
    height: 36,
    borderRadius: 2
  },
  courseInfoCol: {
    flex: 1
  },
  courseCode: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38'
  },
  courseName: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#596B85',
    marginTop: 1
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5
  },
  codePillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  copiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2EB866'
  },
  qrButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8
  },
  joinContainer: {
    marginHorizontal: 18,
    marginTop: 16
  },
  joinSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#596B85',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  joinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12
  },
  joinCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38'
  },
  joinCardDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    lineHeight: 18
  },
  joinInputBox: {
    backgroundColor: '#F8FAFD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  joinInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#141F38'
  },
  joinSubmitButton: {
    backgroundColor: '#8C45F5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  joinSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700'
  },
  aboutCardContainer: {
    marginHorizontal: 18,
    marginTop: 16
  },
  aboutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 12
  },
  aboutIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  aboutTextCol: {
    flex: 1
  },
  aboutTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38'
  },
  aboutDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: '#596B85',
    marginTop: 1
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 6
  },
  emptyDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    textAlign: 'center',
    maxWidth: 240
  },
  legalSectionContainer: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 12
  },
  aboutHeaderBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
    marginBottom: 4
  },
  aboutShieldBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  aboutHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#141F38',
    marginBottom: 6,
    textAlign: 'center'
  },
  aboutHeaderDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: '#596B85',
    textAlign: 'center',
    lineHeight: 19
  },
  legalOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 12
  },
  legalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  legalTextCol: {
    flex: 1
  },
  legalTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#141F38'
  },
  legalDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: '#596B85',
    marginTop: 2,
    lineHeight: 16
  },
  academicWarningCard: {
    backgroundColor: 'rgba(36, 112, 245, 0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(36, 112, 245, 0.15)',
    marginTop: 6
  },
  academicWarningTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2470F5',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  academicWarningBody: {
    fontSize: 12,
    fontWeight: '400',
    color: '#3B4B68',
    lineHeight: 18
  }
});
