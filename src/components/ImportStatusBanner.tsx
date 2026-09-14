/**
 * ImportStatusBanner
 * Floating global status banner for document import diagnostics.
 * Displays truthful provenance: AI extraction completed, partial extraction, local fallback, or errors.
 */

import React, { useEffect } from 'react';
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
import { ImportBannerState } from '../context/CoursePalContext';

export interface ImportStatusBannerProps {
  banner: ImportBannerState | null;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ImportStatusBanner: React.FC<ImportStatusBannerProps> = ({
  banner,
  onDismiss,
  style
}) => {
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [banner, onDismiss]);

  if (!banner) return null;

  const getThemeColor = () => {
    switch (banner.type) {
      case 'success':
        return '#34C759'; // Apple HIG Green
      case 'warning':
        return '#FF9500'; // Apple HIG Amber/Orange
      case 'error':
        return '#FF3B30'; // Apple HIG Red
      case 'info':
      default:
        return CoursePalTheme.accentBlue; // #007AFF
    }
  };

  const getIconGlyph = () => {
    switch (banner.type) {
      case 'success':
        return '✓';
      case 'warning':
        return '!';
      case 'error':
        return '✕';
      case 'info':
      default:
        return 'i';
    }
  };

  const themeColor = getThemeColor();
  const diag = banner.diagnosticRecord;

  return (
    <View style={[styles.container, style]} testID="import-status-banner">
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: themeColor }]}>
          <Text style={styles.iconText}>{getIconGlyph()}</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {banner.title}
          </Text>
          {Boolean(banner.message) && (
            <Text style={styles.message} numberOfLines={3}>
              {banner.message}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Dismiss banner"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Diagnostic provenance badge footer */}
      {Boolean(diag) && (
        <View style={styles.provenanceFooter}>
          <View style={[styles.provenancePill, { borderColor: themeColor + '40' }]}>
            <Text style={[styles.provenancePillText, { color: themeColor }]}>
              {diag?.parserSource === 'PROVIDER_AI'
                ? `AI: ${diag.providerModel || 'Remote'}`
                : diag?.parserSource === 'BACKEND_FALLBACK'
                ? 'Server Heuristic Fallback'
                : 'Local Device Fallback'}
            </Text>
          </View>
          {Boolean(diag?.documentHash && diag.documentHash !== '00000000') && (
            <Text style={styles.hashText}>
              SHA: {diag?.documentHash.substring(0, 8)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F0F0F2'
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    marginRight: 10
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  textContainer: {
    flex: 1,
    paddingRight: 8
  },
  title: {
    ...Typography.cpItemTitle,
    fontSize: 14,
    color: CoursePalTheme.textDark,
    marginBottom: 2
  },
  message: {
    ...Typography.cpDescription,
    fontSize: 12.5,
    color: CoursePalTheme.textMuted,
    lineHeight: 16
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F2F2F7'
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93'
  },
  provenanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7'
  },
  provenancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F9F9FB',
    borderWidth: 1
  },
  provenancePillText: {
    ...Typography.badgeCaps,
    fontSize: 9.5
  },
  hashText: {
    ...Typography.badgeCaps,
    fontSize: 9.5,
    color: '#8E8E93'
  }
});
