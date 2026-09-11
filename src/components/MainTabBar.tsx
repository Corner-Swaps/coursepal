/**
 * MainTabBar
 * Floating bottom navigation pill with elevated central (+) floating button.
 * 1:1 match with Swift MainTabView floating navigation pill
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp
} from 'react-native';
import { CoursePalTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import {
  ClearBookIcon,
  CalendarIcon,
  GraduationCapFillIcon,
  PersonFillIcon,
  PlusIcon
} from './SvgIcons';

export type TabKey = 'readings' | 'assignments' | 'syllabus' | 'invite';

export interface MainTabBarProps {
  selectedTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onPressCenterPlus?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const MainTabBar: React.FC<MainTabBarProps> = ({
  selectedTab,
  onSelectTab,
  onPressCenterPlus,
  style
}) => {
  return (
    <View style={[styles.wrapper, style]} testID="main-tab-bar-container" pointerEvents="box-none">
      <View style={styles.pillContainer}>
        {/* Tab 1: Readings */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onSelectTab('readings')}
          activeOpacity={0.7}
          testID="tab-readings"
        >
          <View style={styles.tabIconWrapper}>
            <ClearBookIcon
              size={23.5}
              color={selectedTab === 'readings' ? CoursePalTheme.accentBlue : '#73859E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              selectedTab === 'readings' ? styles.tabLabelActive : styles.tabLabelInactive
            ]}
          >
            Readings
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Assignments */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onSelectTab('assignments')}
          activeOpacity={0.7}
          testID="tab-assignments"
        >
          <View style={styles.tabIconWrapper}>
            <CalendarIcon
              size={23.5}
              color={selectedTab === 'assignments' ? CoursePalTheme.accentBlue : '#73859E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              selectedTab === 'assignments' ? styles.tabLabelActive : styles.tabLabelInactive
            ]}
          >
            Assignments
          </Text>
        </TouchableOpacity>

        {/* Slot 3: Spacer for Elevated Plus Button */}
        <View style={styles.centerSpacer} pointerEvents="none" />

        {/* Tab 4: Syllabus */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onSelectTab('syllabus')}
          activeOpacity={0.7}
          testID="tab-syllabus"
        >
          <View style={styles.tabIconWrapper}>
            <GraduationCapFillIcon
              size={23.5}
              color={selectedTab === 'syllabus' ? CoursePalTheme.accentBlue : '#73859E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              selectedTab === 'syllabus' ? styles.tabLabelActive : styles.tabLabelInactive
            ]}
          >
            Syllabus
          </Text>
        </TouchableOpacity>

        {/* Tab 5: Invite */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onSelectTab('invite')}
          activeOpacity={0.7}
          testID="tab-invite"
        >
          <View style={styles.tabIconWrapper}>
            <PersonFillIcon
              size={23.5}
              color={selectedTab === 'invite' ? CoursePalTheme.accentBlue : '#73859E'}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              selectedTab === 'invite' ? styles.tabLabelActive : styles.tabLabelInactive
            ]}
          >
            Invite
          </Text>
        </TouchableOpacity>
      </View>

      {/* Elevated Central Floating (+) Button */}
      <TouchableOpacity
        style={styles.floatingPlusOuterRing}
        onPress={onPressCenterPlus}
        activeOpacity={0.8}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        testID="tab-center-plus"
      >
        <View style={styles.floatingPlusInnerCircle}>
          <PlusIcon size={23.5} color="#FFFFFF" strokeWidth={2.8} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 74,
    paddingTop: 18,
    marginHorizontal: 16,
    marginBottom: 0
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 2
  },
  tabIconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerSpacer: {
    width: 56
  },
  tabLabel: {
    ...Typography.tabLabel,
    marginTop: 2
  },
  tabLabelActive: {
    color: CoursePalTheme.accentBlue,
    fontWeight: '700'
  },
  tabLabelInactive: {
    color: '#73859E',
    fontWeight: '500'
  },
  floatingPlusOuterRing: {
    position: 'absolute',
    top: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 10
  },
  floatingPlusInnerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: CoursePalTheme.accentBlue,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
