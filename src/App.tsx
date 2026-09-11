/**
 * CoursePal - Main Application Component
 * 1:1 Parity with SwiftUI MainTabView and native iOS screen hierarchy.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoursePalTheme } from './constants/theme';
import { CoursePalProvider, useCoursePal, TabKey } from './context/CoursePalContext';
import {
  MainTabBar,
  ConfettiCelebration,
  FuzzedScrollBottomFade,
  UploadProgressBanner
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
  UploadDocumentModal
} from './components/modals';

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
    uploadStatusText
  } = useCoursePal();

  // Modals state
  const [showAddChoiceModal, setShowAddChoiceModal] = useState<boolean>(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [selectedCourseForAddTask, setSelectedCourseForAddTask] = useState<string | undefined>(undefined);

  const insets = useSafeAreaInsets();

  const handleOpenAddTask = (courseId?: string) => {
    setSelectedCourseForAddTask(courseId);
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

        {/* MARK: - Bottom Fuzzed Gradient Scroll Mask (fades scrolling cards into light canvas behind menu pill) */}
        <FuzzedScrollBottomFade
          height={insets.bottom + 105}
          color={CoursePalTheme.bgCanvas}
        />

        {/* MARK: - Custom Floating Bottom Navigation Bar */}
        <MainTabBar
          selectedTab={selectedTab}
          onSelectTab={tab => setSelectedTab(tab)}
          onPressCenterPlus={() => setShowAddChoiceModal(true)}
          style={[
            styles.floatingTabBar,
            { bottom: insets.bottom > 0 ? 18 : 10 }
          ]}
        />

        {/* Floating Upload Status Banner */}
        {isUploading && (
          <View style={[styles.floatingUploadBannerContainer, { top: insets.top + 8 }]}>
            <UploadProgressBanner
              title={uploadStatusText || 'Analyzing syllabus document...'}
              visible={isUploading}
            />
          </View>
        )}

        {/* MARK: - Modals */}
        <AddNewItemModal
          visible={showAddChoiceModal}
          onClose={() => setShowAddChoiceModal(false)}
          onCreateCourse={() => setShowAddCourseModal(true)}
          onAddTask={() => setShowAddTaskModal(true)}
          onUploadDocument={() => setShowUploadModal(true)}
        />

        <AddTaskModal
          visible={showAddTaskModal}
          initialCourseId={selectedCourseForAddTask}
          onClose={() => {
            setShowAddTaskModal(false);
            setSelectedCourseForAddTask(undefined);
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
        />

        <CourseFilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
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
  floatingUploadBannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center'
  }
});
