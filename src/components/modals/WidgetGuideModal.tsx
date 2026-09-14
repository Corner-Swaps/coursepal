import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView
} from 'react-native';
import {
  RectangleInsetTopLeftFilledIcon,
  CheckmarkCircleFillIcon
} from '../SvgIcons';

interface WidgetGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WidgetGuideModal: React.FC<WidgetGuideModalProps> = ({
  visible,
  onClose
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.navButtonPlaceholder} />
          <Text style={styles.navTitle}>Home Screen Widget</Text>
          <TouchableOpacity onPress={onClose} style={styles.navButton} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <View style={styles.iconCircle}>
              <RectangleInsetTopLeftFilledIcon size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.bannerTitle}>ClassPal at a Glance</Text>
            <Text style={styles.bannerSubtitle}>
              Keep your upcoming deadlines, readings, and weekly course progress right on your iPhone home screen with an edge-to-edge widget.
            </Text>
          </View>

          {/* Step-by-Step Guide */}
          <Text style={styles.sectionHeader}>HOW TO ADD TO HOME SCREEN</Text>

          <View style={styles.stepsCard}>
            {/* Step 1 */}
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Enter Jiggle Mode</Text>
                <Text style={styles.stepDesc}>
                  Go to your iPhone Home Screen. Touch and hold any empty area or app icon until the apps start to jiggle.
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            {/* Step 2 */}
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Tap the Plus Button (+)</Text>
                <Text style={styles.stepDesc}>
                  Tap the <Text style={styles.boldText}>+</Text> (Add) button in the upper-left corner to open the Widget Gallery.
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            {/* Step 3 */}
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Search "CoursePal"</Text>
                <Text style={styles.stepDesc}>
                  Scroll or search for <Text style={styles.boldText}>CoursePal</Text> (or ClassPal Deadlines) in the list of widgets.
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            {/* Step 4 */}
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Choose Size & Add</Text>
                <Text style={styles.stepDesc}>
                  Swipe to choose between <Text style={styles.boldText}>Small</Text> (priority deadline) or <Text style={styles.boldText}>Medium</Text> (upcoming deadlines overview), then tap <Text style={styles.boldText}>Add Widget</Text>.
                </Text>

              </View>
            </View>
          </View>

          {/* Features highlight */}
          <Text style={styles.sectionHeader}>WIDGET HIGHLIGHTS</Text>

          <View style={styles.highlightsCard}>
            <View style={styles.highlightItem}>
              <CheckmarkCircleFillIcon size={18} color="#2EB866" />
              <Text style={styles.highlightText}>
                <Text style={styles.boldText}>Edge-to-Edge Pure White:</Text> Clean, minimalist look on any wallpaper.
              </Text>
            </View>

            <View style={styles.highlightItem}>
              <CheckmarkCircleFillIcon size={18} color="#2EB866" />
              <Text style={styles.highlightText}>
                <Text style={styles.boldText}>Instant Sync:</Text> Automatically updates whenever you check off assignments or import new syllabi.
              </Text>
            </View>

            <View style={styles.highlightItem}>
              <CheckmarkCircleFillIcon size={18} color="#2EB866" />
              <Text style={styles.highlightText}>
                <Text style={styles.boldText}>100% Private:</Text> Runs locally on your device without transmitting schedule data.
              </Text>
            </View>
          </View>

          {/* Close Action */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>Got It</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  navBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  navButton: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  navButtonPlaceholder: {
    width: 48
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2470F5'
  },
  scrollArea: {
    flex: 1
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  headerBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#2470F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2470F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.4
  },
  bannerSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4
  },
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 6
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2470F5'
  },
  stepContent: {
    flex: 1
  },
  stepTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3
  },
  stepDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18.5
  },
  boldText: {
    fontWeight: '700',
    color: '#1E293B'
  },
  stepDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
    marginLeft: 42
  },
  highlightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  highlightText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    flex: 1
  },
  actionButton: {
    backgroundColor: '#2470F5',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2470F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700'
  }
});
