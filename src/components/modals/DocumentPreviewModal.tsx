import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VaultDocument } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import { DocFillIcon } from '../SvgIcons';

interface DocumentPreviewModalProps {
  visible: boolean;
  document: VaultDocument | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  visible,
  document,
  onClose
}) => {
  if (!visible || !document) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.navButton, styles.cancelButton]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitle} numberOfLines={1}>
              {document.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.navButton, styles.actionButton]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          alwaysBounceHorizontal={false}
          showsHorizontalScrollIndicator={false}
          bounces={true}
          overScrollMode="never"
        >
          <View style={styles.headerCard}>
            <View style={styles.docIconCircle}>
              <DocFillIcon size={32} color={document.docColorHex || CoursePalTheme.accentBlue} />
            </View>
            <Text style={styles.docTitle}>{document.title}</Text>
            <Text style={styles.docMeta}>
              {document.courseCode || 'General'} • {document.fileSize} • {document.fileType}
            </Text>
          </View>

          <View style={styles.documentBodyCard}>
            <Text style={styles.contentHeader}>DOCUMENT PREVIEW</Text>
            <Text style={styles.contentText}>
              {document.fileContent ||
                'This document contains course syllabus outlines, required reading assignments, grading weight breakdown, and weekly seminar schedules.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA',
    overflow: 'hidden',
    width: '100%'
  },
  navBar: {
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D9E6',
    backgroundColor: '#F2F5FA'
  },
  navButton: {
    minWidth: 70,
    height: 44,
    justifyContent: 'center'
  },
  cancelButton: {
    alignItems: 'flex-start'
  },
  actionButton: {
    alignItems: 'flex-end'
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5'
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#121C33',
    textAlign: 'center'
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5',
    textAlign: 'right'
  },
  scrollContent: {
    flex: 1,
    width: '100%'
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64,
    gap: 18
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  docIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(36, 112, 245, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141F38',
    textAlign: 'center',
    marginBottom: 4
  },
  docMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#596B85'
  },
  documentBodyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    minHeight: 250
  },
  contentHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  contentText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#141F38',
    lineHeight: 22
  }
});
