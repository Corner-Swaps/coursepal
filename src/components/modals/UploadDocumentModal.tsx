/**
 * UploadDocumentModal
 * Full-featured syllabus & course material upload modal.
 * Supports:
 *  1. Native iOS Document Picker (Files / iCloud Drive) for PDF, DOCX, TXT
 *  2. Pre-bundled academic syllabi catalog for instant 1-tap test & import
 *  3. Raw text paste for LMS / Canvas / Brightspace course outlines
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { CoursePalTheme } from '../../constants/theme';
import { useCoursePal } from '../../context/CoursePalContext';
import { BundledSyllabiCatalog, BundledSyllabusItem } from '../../utils/syllabusCatalog';
import {
  DocFillIcon,
  DocBadgePlusIcon,
  BookFillIcon,
  ChevronRightIcon,
  FolderFillIcon
} from '../SvgIcons';

interface UploadDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  targetCourseId?: string;
  onUploadSuccess?: (courseName: string) => void;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  visible,
  onClose,
  targetCourseId,
  onUploadSuccess
}) => {
  const { importSyllabusDocument, isUploading } = useCoursePal();
  const [showCatalog, setShowCatalog] = useState<boolean>(false);
  const [showPasteSection, setShowPasteSection] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
  const [isPickingFile, setIsPickingFile] = useState<boolean>(false);

  if (!visible) return null;

  // MARK: - Native iOS Document Picker
  const handlePickDocument = async () => {
    try {
      setIsPickingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '*/*'
        ],
        copyToCacheDirectory: true
      });

      setIsPickingFile(false);

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const fileSizeStr = asset.size
        ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB`
        : '1.2 MB';

      onClose();

      await importSyllabusDocument({
        fileName: asset.name,
        fileUri: asset.uri,
        fileSize: fileSizeStr,
        targetCourseId
      });

      onUploadSuccess?.(asset.name);
    } catch (err: any) {
      setIsPickingFile(false);
      Alert.alert('File Selection Failed', err.message || 'Unable to open file picker.');
    }
  };

  // MARK: - Instant Catalog Syllabus Import
  const handleImportCatalogItem = async (item: BundledSyllabusItem) => {
    onClose();
    await importSyllabusDocument({
      fileName: item.fileName,
      rawText: item.rawText,
      fileSize: item.fileSize,
      preferredHexColor: item.hexColor,
      targetCourseId
    });
    onUploadSuccess?.(item.courseName);
  };

  // MARK: - Raw Syllabus Text Paste Import
  const handleImportPastedText = async () => {
    const trimmed = pastedText.trim();
    if (trimmed.length < 30) {
      Alert.alert(
        'Insufficient Text',
        'Please paste more of your course syllabus text (at least course title, schedule, or reading list).'
      );
      return;
    }

    onClose();
    await importSyllabusDocument({
      fileName: 'Pasted_Course_Syllabus.txt',
      rawText: trimmed,
      fileSize: `${(trimmed.length / 1024).toFixed(1)} KB`,
      targetCourseId
    });
    setPastedText('');
    setShowPasteSection(false);
    onUploadSuccess?.('Pasted Syllabus');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.cancelButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cancelText}>Done</Text>
          </TouchableOpacity>

          <View style={styles.navTitleCenter}>
            <Text style={styles.navTitle}>Upload Syllabus</Text>
          </View>

          <View style={styles.navBarRightPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Banner */}
          <View style={styles.heroBanner}>
            <View style={styles.heroIconCircle}>
              <DocBadgePlusIcon size={26} color="#2563EB" />
            </View>
            <Text style={styles.heroTitle}>Import Course Materials</Text>
            <Text style={styles.heroSubtitle}>
              Select a PDF syllabus, pick a verified academic course, or paste your course schedule to extract readings & assignments.
            </Text>
          </View>

          {/* Option 1: Native Files / iCloud Drive */}
          <TouchableOpacity
            style={styles.primaryActionCard}
            onPress={handlePickDocument}
            disabled={isPickingFile || isUploading}
            activeOpacity={0.8}
            testID="upload-modal-browse-files"
          >
            <View style={styles.primaryActionIconSquare}>
              {isPickingFile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FolderFillIcon size={22} color="#FFFFFF" />
              )}
            </View>

            <View style={styles.primaryActionTextCol}>
              <Text style={styles.primaryActionTitle}>Browse Files & iCloud</Text>
              <Text style={styles.primaryActionSubtitle}>
                Select PDF, Word (.docx), or text document
              </Text>
            </View>

            <ChevronRightIcon size={14} color="#94A3B8" />
          </TouchableOpacity>

          {/* Option 2: Pre-bundled Sample Syllabi Catalog */}
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={styles.sectionHeaderButton}
              onPress={() => setShowCatalog(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.miniIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <BookFillIcon size={14} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Sample Academic Syllabi</Text>
                  <Text style={styles.sectionHeaderSubtitle}>
                    {BundledSyllabiCatalog.length} instant courses available
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionToggleAction}>
                {showCatalog ? 'Hide' : 'Browse'}
              </Text>
            </TouchableOpacity>

            {showCatalog && (
              <View style={styles.catalogListContainer}>
                {BundledSyllabiCatalog.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.catalogItemRow}
                    onPress={() => handleImportCatalogItem(item)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.courseBadgeSquare,
                        { backgroundColor: item.hexColor }
                      ]}
                    >
                      <Text style={styles.courseBadgeText}>{item.courseCode.split(' ')[0]}</Text>
                    </View>

                    <View style={styles.catalogItemInfo}>
                      <View style={styles.catalogItemTitleRow}>
                        <Text style={styles.catalogCourseCode}>{item.courseCode}</Text>
                        <Text style={styles.catalogFileSize}>{item.fileSize}</Text>
                      </View>
                      <Text style={styles.catalogCourseName} numberOfLines={1}>
                        {item.courseName}
                      </Text>
                      <Text style={styles.catalogInstructor} numberOfLines={1}>
                        {item.instructorName}
                      </Text>
                    </View>

                    <View style={styles.importPillButton}>
                      <Text style={styles.importPillText}>Import</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Option 3: Paste Syllabus Text */}
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={styles.sectionHeaderButton}
              onPress={() => setShowPasteSection(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.miniIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <DocFillIcon size={14} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Paste Syllabus Text</Text>
                  <Text style={styles.sectionHeaderSubtitle}>
                    From Canvas, Brightspace, or Blackboard
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionToggleAction}>
                {showPasteSection ? 'Collapse' : 'Paste'}
              </Text>
            </TouchableOpacity>

            {showPasteSection && (
              <View style={styles.pasteContainer}>
                <TextInput
                  style={styles.pasteInput}
                  multiline
                  placeholder="Paste your course syllabus, schedule, or reading list text here..."
                  placeholderTextColor="#94A3B8"
                  value={pastedText}
                  onChangeText={setPastedText}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[
                    styles.parseButton,
                    pastedText.trim().length < 30 && styles.parseButtonDisabled
                  ]}
                  onPress={handleImportPastedText}
                  disabled={pastedText.trim().length < 30 || isUploading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.parseButtonText}>Parse & Import Schedule</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  navBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: CoursePalTheme.accentBlue
  },
  navTitleCenter: {
    alignItems: 'center'
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2
  },
  navBarRightPlaceholder: {
    width: 50
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  heroBanner: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6
  },
  heroSubtitle: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10
  },
  primaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  primaryActionIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  primaryActionTextCol: {
    flex: 1
  },
  primaryActionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2
  },
  primaryActionSubtitle: {
    fontSize: 12.5,
    fontWeight: '400',
    color: '#64748B'
  },
  sectionBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sectionHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  miniIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  sectionHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 1
  },
  sectionToggleAction: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 8
  },
  catalogListContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 8
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  courseBadgeSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  courseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  catalogItemInfo: {
    flex: 1,
    marginRight: 8
  },
  catalogItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  catalogCourseCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  catalogFileSize: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8'
  },
  catalogCourseName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 1
  },
  catalogInstructor: {
    fontSize: 11,
    fontWeight: '400',
    color: '#64748B'
  },
  importPillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#2563EB'
  },
  importPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  pasteContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12
  },
  pasteInput: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    marginBottom: 12
  },
  parseButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  parseButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7
  },
  parseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
