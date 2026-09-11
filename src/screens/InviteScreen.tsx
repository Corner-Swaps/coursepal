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

  const [selectedCategory, setSelectedCategory] = useState<'share' | 'join'>('share');
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

      {/* MARK: - Category Filter Bar (Share Codes vs Join Course) */}
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
            size={22}
            color={selectedCategory === 'share' ? CoursePalTheme.accentBlue : '#596B85'}
          />
          <Text
            style={[
              styles.filterTileText,
              selectedCategory === 'share' && styles.filterTileTextActive
            ]}
          >
            Share Codes ({activeCourses.length})
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
            size={22}
            color={selectedCategory === 'join' ? '#8C45F5' : '#596B85'}
          />
          <Text
            style={[
              styles.filterTileText,
              selectedCategory === 'join' && styles.filterTileTextActive
            ]}
          >
            Join Course
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

          {/* MARK: - About & Legal Card (Exclusively in Share Codes) */}
          <View style={styles.aboutCardContainer}>
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={() => setShowInfoSheet(true)}
              activeOpacity={0.8}
            >
              <View style={styles.aboutIconCircle}>
                <ShieldLockIcon size={18} color={CoursePalTheme.accentBlue} />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>About & Legal</Text>
                <Text style={styles.aboutDesc}>Privacy policy, terms of service & support</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
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
  }
});
