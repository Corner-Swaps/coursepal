/**
 * AppReviewPromptModal
 * Authentic Apple HIG In-App Review & Rating Modal.
 * Appears strictly after 15 app opens, recurs every 15 opens if skipped,
 * and directly connects to Apple StoreKit SKStoreReviewController and the App Store.
 */

import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform
} from 'react-native';
import { CoursePalTheme } from '../../constants/theme';
import { AppIconLogo } from '../AppIconLogo';
import { storeReviewService } from '../../services/StoreReviewService';
import { haptics } from '../../services/HapticsService';

export interface AppReviewPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onRated?: () => void;
  onSkipped?: () => void;
}

export const AppReviewPromptModal: React.FC<AppReviewPromptModalProps> = ({
  visible,
  onClose,
  onRated,
  onSkipped
}) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 220,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        })
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  const handleRateOnAppStore = async () => {
    await haptics.notifySuccess();
    await storeReviewService.markReviewCompleted();
    await storeReviewService.requestReview();
    if (onRated) onRated();
    onClose();
  };

  const handleSkip = async () => {
    await haptics.impactLight();
    await storeReviewService.markPromptSkipped();
    if (onSkipped) onSkipped();
    onClose();
  };

  const handleWriteDetailedReview = async () => {
    await haptics.impactMedium();
    await storeReviewService.markReviewCompleted();
    await storeReviewService.openAppStoreReviewPage();
    if (onRated) onRated();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <View style={styles.backdropOverlay}>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* App Logo Squircle */}
          <View style={styles.logoWrapper}>
            <AppIconLogo size={76} />
          </View>

          {/* 5 Golden Stars Header */}
          <View style={styles.starsRow}>
            {['★', '★', '★', '★', '★'].map((star, idx) => (
              <Text key={idx} style={styles.starGlyph}>
                {star}
              </Text>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.titleText}>Enjoying CoursePal?</Text>

          {/* Subtitle */}
          <Text style={styles.bodyText}>
            Your ratings and reviews directly help fellow university students organize their semester.
            Tap below to leave your rating on the Apple App Store.
          </Text>

          {/* Primary Button: Rate on App Store (Native StoreKit) */}
          <TouchableOpacity
            style={styles.primaryRateButton}
            onPress={handleRateOnAppStore}
            activeOpacity={0.82}
            testID="rate-on-appstore-button"
          >
            <Text style={styles.primaryRateButtonText}>Rate on the App Store</Text>
          </TouchableOpacity>

          {/* Secondary Link: Write Detailed Review */}
          <TouchableOpacity
            style={styles.detailedReviewLink}
            onPress={handleWriteDetailedReview}
            activeOpacity={0.7}
          >
            <Text style={styles.detailedReviewLinkText}>Write a Detailed Review</Text>
          </TouchableOpacity>

          {/* Skip / Not Now Button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            testID="skip-review-button"
          >
            <Text style={styles.skipButtonText}>Not Now</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 38, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  cardContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12
  },
  logoWrapper: {
    marginBottom: 12,
    shadowColor: '#2470F5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10
  },
  starGlyph: {
    fontSize: 22,
    color: '#FFB800',
    textShadowColor: 'rgba(255, 184, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  titleText: {
    fontSize: 21,
    fontWeight: '700',
    color: CoursePalTheme.textDark,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8
  },
  bodyText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: CoursePalTheme.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 6
  },
  primaryRateButton: {
    width: '100%',
    height: 50,
    backgroundColor: CoursePalTheme.accentBlue,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CoursePalTheme.accentBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 10
  },
  primaryRateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  detailedReviewLink: {
    paddingVertical: 8,
    marginBottom: 4
  },
  detailedReviewLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20
  },
  skipButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: CoursePalTheme.textMuted
  }
});
