/**
 * CoursePal - Main Application Component
 * 1:1 Parity with SwiftUI MainTabView and native iOS screen hierarchy.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  AppState,
  AppStateStatus,
  Linking
} from 'react-native';

import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoursePalTheme } from './constants/theme';
import { CoursePalProvider, useCoursePal, TabKey } from './context/CoursePalContext';
import {
  MainTabBar,
  ConfettiCelebration,
  FuzzedScrollBottomFade
} from './components';
import {
  ReadingsScreen,
  AssignmentsScreen,
  SyllabusScreen,
  InviteScreen
} from './screens';
import {
  AddNewItemModal,
  AddTaskModal,
  AddCourseModal,
  CourseFilterModal,
  UploadDocumentModal,
  FocusStudyModal,
  WelcomeTermsModal
} from './components/modals';
import { storeReviewService } from './services/StoreReviewService';
import { cleanUploadStatusMessage } from './utils/readingDisplayHelper';

export default function App() {
  return (
    <SafeAreaProvider>
      <CoursePalProvider>
        <MainAppView />
      </CoursePalProvider>
    </SafeAreaProvider>
  );
}

function MainAppView() {
  const {
    selectedTab,
    setSelectedTab,
    showConfetti,
    dismissConfetti,
    isUploading,
    uploadStatusText,
    uploadProgress,
    checkAndResumeInterruptedUpload,
    hasAcceptedTerms,
    hasLoadedTerms,
    acceptTerms
  } = useCoursePal();

  // Modals state
  const [showAddChoiceModal, setShowAddChoiceModal] = useState<boolean>(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [showFocusModal, setShowFocusModal] = useState<boolean>(false);
  const [selectedCourseForAddTask, setSelectedCourseForAddTask] = useState<string | undefined>(undefined);
  const [selectedCategoryForAddTask, setSelectedCategoryForAddTask] = useState<'assignment' | 'reading'>('assignment');

  const insets = useSafeAreaInsets();
  const hasRecordedLaunchRef = useRef<boolean>(false);

  // App launch counting & review prompt lifecycle (strict 15-use threshold & 15-use recurrence)
  // Apple's native StoreKit rating dialog is triggered directly - no custom modal!
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const checkReviewEligibility = async () => {
      if (!hasRecordedLaunchRef.current) {
        hasRecordedLaunchRef.current = true;
        await storeReviewService.recordAppLaunch();
      }

      if (hasAcceptedTerms) {
        const shouldPrompt = await storeReviewService.shouldShowReviewPrompt();
        if (shouldPrompt) {
          timer = setTimeout(async () => {
            // Trigger Apple's official native StoreKit rating popup directly
            await storeReviewService.requestReview();
          }, 2200);
        }
      }
    };

    checkReviewEligibility();

    // Resume any pending upload job if the app was suspended or killed during extraction
    checkAndResumeInterruptedUpload().catch(err => {
      console.warn('Initial checkAndResumeInterruptedUpload error:', err);
    });

    let lastBackgroundTime = 0;
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        lastBackgroundTime = Date.now();
      } else if (nextState === 'active') {
        // Automatically rescue interrupted background uploads upon returning
        checkAndResumeInterruptedUpload().catch(err => {
          console.warn('checkAndResumeInterruptedUpload error on active:', err);
        });

        if (lastBackgroundTime > 0) {
          const timeInBackground = Date.now() - lastBackgroundTime;
          // If app was in background for at least 3 minutes, treat as a distinct app use session
          if (timeInBackground >= 3 * 60 * 1000) {
            await storeReviewService.recordAppLaunch();
            if (hasAcceptedTerms) {
              const shouldPrompt = await storeReviewService.shouldShowReviewPrompt();
              if (shouldPrompt) {
                timer = setTimeout(async () => {
                  await storeReviewService.requestReview();
                }, 2200);
              }
            }
          }
        }
      }
    });

    // Handle incoming deep links (e.g. from WidgetKit taps: coursepal://tab/assignments or coursepal://tab/readings)
    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      try {
        if (url.includes('assignments')) {
          setSelectedTab('assignments');
        } else if (url.includes('readings')) {
          setSelectedTab('readings');
        } else if (url.includes('syllabus')) {
          setSelectedTab('syllabus');
        } else if (url.includes('invite')) {
          setSelectedTab('invite');
        }
      } catch {
        // Safe fallback
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const linkingSub = Linking.addEventListener('url', event => handleDeepLink(event.url));

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
      linkingSub.remove();
    };
  }, [hasAcceptedTerms, setSelectedTab, checkAndResumeInterruptedUpload]);


  const handleOpenAddTask = (courseId?: string, category: 'assignment' | 'reading' = 'assignment') => {
    setSelectedCourseForAddTask(courseId);
    setSelectedCategoryForAddTask(category);
    setShowAddTaskModal(true);
  };

  return (
    <View style={styles.rootContainer}>
      <View style={[styles.mainContainer, { paddingTop: insets.top }]}>
        {/* MARK: - Main Tab Content Area (Kept alive in ZStack for zero-latency instant tab switching) */}
        <View style={styles.contentZStack}>
          {/* Tab 1: Readings */}
          <View
            style={[
              styles.tabScreenWrapper,
              selectedTab === 'readings' ? styles.tabScreenActive : styles.tabScreenHidden
            ]}
            pointerEvents={selectedTab === 'readings' ? 'auto' : 'none'}
          >
            <ReadingsScreen onOpenFilterModal={() => setShowFilterModal(true)} />
          </View>

          {/* Tab 2: Assignments */}
          <View
            style={[
              styles.tabScreenWrapper,
              selectedTab === 'assignments' ? styles.tabScreenActive : styles.tabScreenHidden
            ]}
            pointerEvents={selectedTab === 'assignments' ? 'auto' : 'none'}
          >
            <AssignmentsScreen onOpenFilterModal={() => setShowFilterModal(true)} />
          </View>

          {/* Tab 3: Syllabus */}
          <View
            style={[
              styles.tabScreenWrapper,
              selectedTab === 'syllabus' ? styles.tabScreenActive : styles.tabScreenHidden
            ]}
            pointerEvents={selectedTab === 'syllabus' ? 'auto' : 'none'}
          >
            <SyllabusScreen
              onOpenAddTaskModal={handleOpenAddTask}
              onOpenAddCourseModal={() => setShowAddCourseModal(true)}
            />
          </View>

          {/* Tab 4: Invite */}
          <View
            style={[
              styles.tabScreenWrapper,
              selectedTab === 'invite' ? styles.tabScreenActive : styles.tabScreenHidden
            ]}
            pointerEvents={selectedTab === 'invite' ? 'auto' : 'none'}
          >
            <InviteScreen />
          </View>
        </View>

        {/* Floating Global Loading Bar with Message (Blue, above the program - only shown when browsing other tabs) */}
        {isUploading && selectedTab !== 'syllabus' && (
          <View
            style={[styles.globalUploadPillContainer, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View style={styles.globalUploadPill}>
              <View style={styles.globalUploadContentRow}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.globalUploadTitle} numberOfLines={1}>
                    {cleanUploadStatusMessage(uploadStatusText)}
                  </Text>
                </View>
                <Text style={styles.globalUploadPercentText}>
                  {Math.round(Math.min(100, Math.max(10, (uploadProgress || 0.15) * 100)))}%
                </Text>
              </View>

              {/* Real Blue Loading Bar Track & Fill */}
              <View style={styles.globalUploadBarTrack}>
                <View
                  style={[
                    styles.globalUploadBarFill,
                    {
                      width: `${Math.round(Math.min(100, Math.max(8, (uploadProgress || 0.15) * 100)))}%`
                    }
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* MARK: - Bottom Fuzzed Gradient Scroll Mask (fades scrolling cards into light canvas behind menu pill) */}
        <FuzzedScrollBottomFade
          height={insets.bottom + 125}
          color={CoursePalTheme.bgCanvas}
        />

        {/* MARK: - Custom Floating Bottom Navigation Bar */}
        <MainTabBar
          selectedTab={selectedTab}
          onSelectTab={tab => setSelectedTab(tab)}
          onPressCenterPlus={() => setShowAddChoiceModal(true)}
          style={[
            styles.floatingTabBar,
            { bottom: insets.bottom > 0 ? 25 : 17 }
          ]}
        />

        {/* MARK: - Modals */}
        <AddNewItemModal
          visible={showAddChoiceModal}
          onClose={() => setShowAddChoiceModal(false)}
          onCreateCourse={() => setShowAddCourseModal(true)}
          onAddReadingOrAssignment={() => {
            setSelectedCategoryForAddTask(selectedTab === 'readings' ? 'reading' : 'assignment');
            setShowAddTaskModal(true);
          }}
        />

        <AddTaskModal
          visible={showAddTaskModal}
          initialCourseId={selectedCourseForAddTask}
          initialCategory={selectedCategoryForAddTask}
          onClose={() => {
            setShowAddTaskModal(false);
            setSelectedCourseForAddTask(undefined);
            setSelectedCategoryForAddTask('assignment');
          }}
        />

        <AddCourseModal
          visible={showAddCourseModal}
          onClose={() => setShowAddCourseModal(false)}
          onCourseCreated={() => setSelectedTab('syllabus')}
        />

        <UploadDocumentModal
          visible={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={() => setSelectedTab('syllabus')}
        />

        <CourseFilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
        />

        <FocusStudyModal
          visible={showFocusModal}
          onClose={() => setShowFocusModal(false)}
        />

        {/* First-Launch Legal & Welcome Terms Modal (Shows ONLY on the very first launch after downloading, never again once accepted) */}
        <WelcomeTermsModal
          visible={hasLoadedTerms && !hasAcceptedTerms}
          onAccept={acceptTerms}
        />

        {/* Confetti Celebration Overlay */}
        <ConfettiCelebration
          active={showConfetti}
          particleCount={50}
          onAnimationComplete={dismissConfetti}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: CoursePalTheme.bgCanvas,
    width: '100%'
  },
  mainContainer: {
    flex: 1,
    width: '100%'
  },
  contentZStack: {
    flex: 1,
    width: '100%'
  },
  tabScreenWrapper: {
    ...StyleSheet.absoluteFillObject,
    width: '100%'
  },
  tabScreenActive: {
    opacity: 1,
    zIndex: 1
  },
  tabScreenHidden: {
    display: 'none',
    opacity: 0,
    zIndex: 0
  },
  floatingTabBar: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    zIndex: 50
  },
  globalUploadPillContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center'
  },
  globalUploadPill: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#2563EB', // CoursePal signature vibrant royal blue
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 8
  },
  globalUploadContentRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  globalUploadTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  globalUploadPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    marginLeft: 8
  },
  globalUploadBarTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
    overflow: 'hidden'
  },
  globalUploadBarFill: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF'
  }
});
