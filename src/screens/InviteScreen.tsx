import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Clipboard,
  Share
} from 'react-native';
import { useCoursePal } from '../context/CoursePalContext';
import { CoursePalTheme } from '../constants/theme';
import { CourseSharingService } from '../services/CourseSharingService';
import {
  QRCodeIcon,
  JoinArrowDownIcon,
  CopyDocIcon,
  ShieldCheckmarkIcon,
  GraduationCapFillIcon,
  StarFillIcon,
  RectangleInsetTopLeftFilledIcon,
  ChevronRightIcon
} from '../components/SvgIcons';
import { Course } from '../types/models';
import { QRCodeModal } from '../components/modals/QRCodeModal';
import { InfoCreditsModal } from '../components/modals/InfoCreditsModal';
import { WidgetGuideModal } from '../components/modals/WidgetGuideModal';
import { storeReviewService } from '../services/StoreReviewService';
import { NotificationService } from '../services/NotificationService';
import { haptics } from '../services/HapticsService';


export const InviteScreen: React.FC = () => {
  const { courses, importShareCode } = useCoursePal();

  const [selectedCategory, setSelectedCategory] = useState<'share' | 'join'>('share');
  const [inputCode, setInputCode] = useState<string>('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSuccessNotice, setIsSuccessNotice] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrCodeCourse, setQrCodeCourse] = useState<Course | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState<boolean>(false);
  const [infoSheetInitialTab, setInfoSheetInitialTab] = useState<'terms' | 'privacy' | 'about'>('terms');
  const [showWidgetGuide, setShowWidgetGuide] = useState<boolean>(false);


  const activeCourses = courses.filter(c => !c.isDeleted);

  const handleCopyCode = (course: Course) => {
    const shareLink = CourseSharingService.shared.generateShareLink(course);
    Clipboard.setString(shareLink);
    setCopiedCode(course.sharingCode);
    haptics.notifySuccess();
    setNoticeMessage(`Copied full invite link for ${course.courseName}!`);
    setIsSuccessNotice(true);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
    setTimeout(() => {
      setNoticeMessage(null);
    }, 3500);
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
            size={22}
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
      </View>

      {/* MARK: - Main Content Area */}
      {selectedCategory === 'share' ? (
        // Share Codes List
        <View style={styles.listContainer}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Course Sharing Codes</Text>
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
                      onPress={() => handleCopyCode(course)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.codePillText, { color: course.hexColor }]}>
                        {course.sharingCode}
                      </Text>
                      {copiedCode === course.sharingCode ? (
                        <Text style={styles.copiedBadgeText}>Copied Link</Text>
                      ) : (
                        <CopyDocIcon size={12} color={course.hexColor} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.qrButton}
                      onPress={() => setQrCodeCourse(course)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={`View QR code for ${course.courseName}`}
                    >
                      <QRCodeIcon size={16} color={course.hexColor} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Section: About & Legal */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>About & Legal</Text>

            {/* About CoursePal Card (White Hat Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={() => {
                setInfoSheetInitialTab('about');
                setShowInfoSheet(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#2470F5' }]}>
                <GraduationCapFillIcon size={19} color="#FFFFFF" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>About CoursePal</Text>
                <Text style={styles.aboutDesc}>100% on-device syllabus companion & version 1.4.2</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>

            {/* Terms of Service & Privacy Policy Card (White Shield Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={() => {
                setInfoSheetInitialTab('terms');
                setShowInfoSheet(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#4F46E5' }]}>
                <ShieldCheckmarkIcon size={18} color="#FFFFFF" innerColor="#4F46E5" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>Terms of Service & Privacy Policy</Text>
                <Text style={styles.aboutDesc}>Academic disclaimers, data sovereignty & legal policies</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>

            {/* Rate App Store Card (White Star Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={async () => {
                await haptics.notifySuccess();
                await storeReviewService.markReviewCompleted();
                await storeReviewService.requestReview();
              }}
              activeOpacity={0.8}
              testID="invite-rate-app-store"
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#FF9500' }]}>
                <StarFillIcon size={18} color="#FFFFFF" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>Rate CoursePal on App Store</Text>
                <Text style={styles.aboutDesc}>Leave 5 stars & help fellow university students discover CoursePal</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>

            {/* Add Home Screen Widget Card (Widget Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={async () => {
                await haptics.selection();
                await NotificationService.shared.reloadWidgetTimelines();
                setShowWidgetGuide(true);
              }}
              activeOpacity={0.8}
              testID="invite-add-widget"
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#0284C7' }]}>
                <RectangleInsetTopLeftFilledIcon size={18} color="#FFFFFF" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>Add Home Screen Widget</Text>
                <Text style={styles.aboutDesc}>Place upcoming deadlines & weekly progress on your iPhone screen</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Join Course Section
        <View style={styles.listContainer}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Join a Course</Text>
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

          {/* Section: About & Legal */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>About & Legal</Text>

            {/* About CoursePal Card (White Hat Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={() => {
                setInfoSheetInitialTab('about');
                setShowInfoSheet(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#2470F5' }]}>
                <GraduationCapFillIcon size={19} color="#FFFFFF" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>About CoursePal</Text>
                <Text style={styles.aboutDesc}>100% on-device syllabus companion & version 1.4.2</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>

            {/* Terms of Service & Privacy Policy Card (White Shield Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={() => {
                setInfoSheetInitialTab('terms');
                setShowInfoSheet(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#4F46E5' }]}>
                <ShieldCheckmarkIcon size={18} color="#FFFFFF" innerColor="#4F46E5" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>Terms of Service & Privacy Policy</Text>
                <Text style={styles.aboutDesc}>Academic disclaimers, data sovereignty & legal policies</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>

            {/* Rate App Store Card (White Star Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={async () => {
                await haptics.notifySuccess();
                await storeReviewService.markReviewCompleted();
                await storeReviewService.requestReview();
              }}
              activeOpacity={0.8}
              testID="invite-rate-app-store"
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#FF9500' }]}>
                <StarFillIcon size={18} color="#FFFFFF" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>Rate CoursePal on App Store</Text>
                <Text style={styles.aboutDesc}>Leave 5 stars & help fellow university students discover CoursePal</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
            </TouchableOpacity>

            {/* Add Home Screen Widget Card (Widget Icon) */}
            <TouchableOpacity
              style={styles.aboutCard}
              onPress={async () => {
                await haptics.selection();
                await NotificationService.shared.reloadWidgetTimelines();
                setShowWidgetGuide(true);
              }}
              activeOpacity={0.8}
              testID="invite-add-widget-join"
            >
              <View style={[styles.aboutIconCircle, { backgroundColor: '#0284C7' }]}>
                <RectangleInsetTopLeftFilledIcon size={18} color="#FFFFFF" />
              </View>

              <View style={styles.aboutTextCol}>
                <Text style={styles.aboutTitle}>Add Home Screen Widget</Text>
                <Text style={styles.aboutDesc}>Place upcoming deadlines & weekly progress on your iPhone screen</Text>
              </View>

              <ChevronRightIcon size={13} color="#73859E" />
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
        initialTab={infoSheetInitialTab}
        onClose={() => setShowInfoSheet(false)}
      />

      <WidgetGuideModal
        visible={showWidgetGuide}
        onClose={() => setShowWidgetGuide(false)}
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
    marginTop: 18,
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
    gap: 16
  },
  sectionContainer: {
    gap: 8
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#596B85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginLeft: 2
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
    color: '#141F38',
    lineHeight: 19,
    letterSpacing: -0.2
  },
  courseName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 17,
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
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: '#F2F5FA',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    alignItems: 'center',
    justifyContent: 'center'
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
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 18
  },
  joinInputBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 52,
    justifyContent: 'center'
  },
  joinInput: {
    fontSize: 15,
    fontWeight: '500',
    color: '#141F38',
    padding: 0
  },
  joinSubmitButton: {
    backgroundColor: '#8C45F5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  joinSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700'
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
