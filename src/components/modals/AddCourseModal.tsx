import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCoursePal } from '../../context/CoursePalContext';
import { CoursePalTheme } from '../../constants/theme';
import {
  DocBadgePlusIcon,
  XMarkCircleFillIcon,
  DocTextViewfinderIcon,
  CheckmarkShieldFillIcon,
  ArchiveBoxFillIcon,
  TrashIcon,
  CheckmarkCircleFillIcon
} from '../SvgIcons';

interface AddCourseModalProps {
  visible: boolean;
  onClose: () => void;
  onCourseCreated?: () => void;
}

import * as DocumentPicker from 'expo-document-picker';

const availableColorOptions = [
  { name: 'Vibrant Blue', hex: '#2563EB' },
  { name: 'Royal Purple', hex: '#7C3AED' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Deep Orange', hex: '#EA580C' },
  { name: 'Vibrant Pink', hex: '#DB2777' },
  { name: 'Teal Cyan', hex: '#0D9488' },
  { name: 'Amber Gold', hex: '#D97706' },
  { name: 'Deep Indigo', hex: '#4F46E5' },
  { name: 'Crimson Red', hex: '#DC2626' },
  { name: 'Coral Rose', hex: '#E11D48' },
  { name: 'Aqua Turquoise', hex: '#06B6D4' },
  { name: 'Grape Purple', hex: '#9333EA' }
];

interface AddCourseModalProps {
  visible: boolean;
  onClose: () => void;
  onCourseCreated?: () => void;
}

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  visible,
  onClose,
  onCourseCreated
}) => {
  const { addCourse, importSyllabusDocument, vaultDocs } = useCoursePal();
  const scrollRef = useRef<ScrollView>(null);

  const [courseName, setCourseName] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');
  const [selectedColorHex, setSelectedColorHex] = useState<string>('#DC2626');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileUri, setAttachedFileUri] = useState<string | undefined>(undefined);
  const [attachedFileSize, setAttachedFileSize] = useState<string | undefined>(undefined);
  const [showValidationHighlight, setShowValidationHighlight] = useState<boolean>(false);
  const [showingVaultSelector, setShowingVaultSelector] = useState<boolean>(false);
  const [selectedVaultDocIds, setSelectedVaultDocIds] = useState<string[]>([]);

  if (!visible) return null;

  const hasSyllabusSource = !!(attachedFileName && attachedFileName.length > 0);
  const canSave = courseName.trim().length > 0 && hasSyllabusSource;
  const isNameMissing = showValidationHighlight && !courseName.trim();
  const isDocMissing = showValidationHighlight && !hasSyllabusSource;

  const chooseBadgeText = vaultDocs.length === 0 ? 'UPLOAD PDF' : 'CHOOSE 1 OF 2';

  const handleAttachRealDoc = async () => {
    try {
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setAttachedFileName(asset.name);
      setAttachedFileUri(asset.uri);
      setAttachedFileSize(
        asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB'
      );
      setShowValidationHighlight(false);
    } catch (err) {
      console.warn('Document picker cancelled or failed:', err);
    }
  };

  const handleSave = () => {
    const trimmedName = courseName.trim();

    if (!trimmedName || !hasSyllabusSource) {
      setShowValidationHighlight(true);
      if (!trimmedName) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
      Alert.alert(
        'Required Information Missing',
        'Please enter a course name and upload a syllabus document before saving.'
      );
      return;
    }

    const newCourse = addCourse({
      courseName: trimmedName,
      courseCode: trimmedName.slice(0, 7).toUpperCase(),
      courseDescription: courseDescription.trim(),
      hexColor: selectedColorHex
    });

    if (attachedFileName) {
      importSyllabusDocument({
        fileName: attachedFileName,
        fileUri: attachedFileUri,
        fileSize: attachedFileSize,
        targetCourseId: newCourse.id,
        preferredHexColor: selectedColorHex,
        preserveCourseTitle: trimmedName,
        preserveCourseSubtitle: courseDescription.trim(),
        preserveCourseCode: newCourse.courseCode || undefined
      });
    }

    setCourseName('');
    setCourseDescription('');
    setAttachedFileName(null);
    setAttachedFileUri(undefined);
    setAttachedFileSize(undefined);
    setSelectedVaultDocIds([]);
    setShowValidationHighlight(false);
    onCourseCreated?.();
    onClose();
  };

  const toggleVaultDocSelection = (docId: string) => {
    if (selectedVaultDocIds.includes(docId)) {
      setSelectedVaultDocIds(selectedVaultDocIds.filter(id => id !== docId));
    } else {
      setSelectedVaultDocIds([...selectedVaultDocIds, docId]);
    }
  };

  const handleDoneVaultSelection = () => {
    const chosen = vaultDocs.filter(d => selectedVaultDocIds.includes(d.id));
    if (chosen.length > 0) {
      setAttachedFileName(chosen.map(d => d.title).join(', '));
      setShowValidationHighlight(false);
    }
    setShowingVaultSelector(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar matching SwiftUI NavigationStack */}
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
            <Text style={styles.navTitle} numberOfLines={1}>Create New Course</Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.navButton, styles.actionButton]}
            activeOpacity={canSave ? 0.7 : 0.4}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={true}
          bounces={true}
          overScrollMode="never"
        >
          {/* Section 1: Course Name */}
          <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
            <Text style={styles.sectionHeader}>Course Name</Text>
            {isNameMissing && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredBadgeText}>Required</Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.inputCapsule,
              isNameMissing && styles.inputCapsuleError
            ]}
          >
            <TextInput
              style={styles.textInput}
              placeholder="Course Name (e.g., CPC 527)"
              placeholderTextColor="#8E9BAE"
              value={courseName}
              onChangeText={text => {
                setCourseName(text);
                if (text.trim()) setShowValidationHighlight(false);
              }}
              returnKeyType="done"
            />
            {courseName.length > 0 && (
              <TouchableOpacity onPress={() => setCourseName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <XMarkCircleFillIcon size={16} color="#B3BFD1" />
              </TouchableOpacity>
            )}
          </View>

          {/* Section 2: Course Description */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Course Description</Text>
          </View>
          <View style={styles.inputCapsule}>
            <TextInput
              style={styles.textInput}
              placeholder="Course Description"
              placeholderTextColor="#8E9BAE"
              value={courseDescription}
              onChangeText={setCourseDescription}
              returnKeyType="done"
            />
            {courseDescription.length > 0 && (
              <TouchableOpacity onPress={() => setCourseDescription('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <XMarkCircleFillIcon size={16} color="#B3BFD1" />
              </TouchableOpacity>
            )}
          </View>

          {/* Section 3: Course Brand Color (12 Options Grid) */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Course Brand Color (12 Options)</Text>
          </View>
          <View style={styles.colorGridCard}>
            <View style={styles.colorGrid}>
              {availableColorOptions.map(c => {
                const isSelected = selectedColorHex.toUpperCase() === c.hex.toUpperCase();
                return (
                  <TouchableOpacity
                    key={c.hex}
                    style={styles.colorButtonWrapper}
                    onPress={() => setSelectedColorHex(c.hex)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.hex },
                        isSelected ? styles.colorCircleSelected : styles.colorCircleUnselected
                      ]}
                    >
                      {isSelected && <Text style={styles.checkmarkText}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 4: Educational Notice Pills */}
          <View style={styles.noticeContainer}>
            {/* Pill 1: Single Course Upload Notice */}
            <View style={styles.noticePillBlue}>
              <View style={styles.noticeIconWrap}>
                <DocTextViewfinderIcon size={14} color="#2470F5" />
              </View>
              <View style={styles.noticeTextCol}>
                <Text style={styles.noticeTitle}>Upload One Course at a Time</Text>
                <Text style={styles.noticeDesc}>
                  Document processing takes 1–2 minutes. You can safely exit or minimize the app while it runs in the background.
                </Text>
              </View>
            </View>

            {/* Pill 2: Schedule Verification Notice */}
            <View style={styles.noticePillOrange}>
              <View style={styles.noticeIconWrap}>
                <CheckmarkShieldFillIcon size={14} color="#E07314" />
              </View>
              <View style={styles.noticeTextCol}>
                <Text style={styles.noticeTitle}>Double-Check Your Syllabus</Text>
                <Text style={styles.noticeDesc}>
                  Please check your original PDF to verify all dates, readings, and assignments imported accurately.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 5: Upload Class Material */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Upload Class Material</Text>
            {hasSyllabusSource ? (
              <View style={styles.attachedBadge}>
                <Text style={styles.badgeTextWhite}>ATTACHED</Text>
              </View>
            ) : isDocMissing ? (
              <View style={styles.requiredStatusBadge}>
                <Text style={styles.badgeTextWhite}>REQUIRED</Text>
              </View>
            ) : (
              <View style={styles.chooseBadge}>
                <Text style={styles.chooseBadgeText}>{chooseBadgeText}</Text>
              </View>
            )}
          </View>

          <View style={styles.uploadCard}>
            <TouchableOpacity
              style={styles.uploadMainButton}
              onPress={handleAttachRealDoc}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.uploadIconCircle,
                  hasSyllabusSource ? styles.uploadIconCircleGreen : styles.uploadIconCircleBlue
                ]}
              >
                {hasSyllabusSource ? (
                  <Text style={styles.uploadCheckmarkText}>✓</Text>
                ) : (
                  <DocBadgePlusIcon size={15} color="#FFFFFF" />
                )}
              </View>

              <View style={styles.uploadTextCol}>
                <Text style={styles.uploadTitle} numberOfLines={1}>
                  {attachedFileName ? `${attachedFileName} Attached` : 'Upload Class Material'}
                </Text>
                <Text style={styles.uploadSubtitle}>
                  {attachedFileName ? 'Tap to replace document' : 'Select PDF or Word syllabus'}
                </Text>
              </View>
            </TouchableOpacity>

            {hasSyllabusSource && (
              <TouchableOpacity
                style={styles.removePill}
                onPress={() => setAttachedFileName(null)}
                activeOpacity={0.7}
              >
                <TrashIcon size={11} color="#EC4545" />
                <Text style={styles.removePillText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Section 6: Choose Vault Document (Rendered if vault docs exist) */}
          {vaultDocs.length > 0 && (
            <View style={styles.vaultSectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Choose Vault Document ({vaultDocs.length})</Text>
                {hasSyllabusSource ? (
                  <View style={styles.attachedBadge}>
                    <Text style={styles.badgeTextWhite}>SELECTED</Text>
                  </View>
                ) : (
                  <View style={styles.chooseBadge}>
                    <Text style={styles.chooseBadgeText}>CHOOSE 1 OF {vaultDocs.length + 1}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.uploadCard}
                onPress={() => setShowingVaultSelector(true)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.uploadIconCircle,
                    selectedVaultDocIds.length > 0 ? styles.uploadIconCircleGreen : styles.uploadIconCirclePurple
                  ]}
                >
                  {selectedVaultDocIds.length > 0 ? (
                    <Text style={styles.uploadCheckmarkText}>✓</Text>
                  ) : (
                    <ArchiveBoxFillIcon size={16} color="#FFFFFF" />
                  )}
                </View>

                <View style={styles.uploadTextCol}>
                  <Text style={styles.uploadTitle}>Choose Saved Document from Vault</Text>
                  <Text style={styles.uploadSubtitle}>Pick from documents stored in Syllabus</Text>
                </View>

                <View style={styles.vaultCountBadge}>
                  <Text style={styles.vaultCountBadgeText}>({vaultDocs.length} Saved)</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Vault Document Selection Modal Sheet */}
        <Modal
          visible={showingVaultSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowingVaultSelector(false)}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.navBar}>
              <TouchableOpacity
                onPress={() => setShowingVaultSelector(false)}
                style={[styles.navButton, styles.cancelButton]}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.navTitle}>Select Vault Documents</Text>
              <TouchableOpacity
                onPress={handleDoneVaultSelection}
                style={[styles.navButton, styles.actionButton]}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.saveText}>
                  {selectedVaultDocIds.length > 0 ? `Attach (${selectedVaultDocIds.length})` : 'Done'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
              {vaultDocs.map(doc => {
                const isSelected = selectedVaultDocIds.includes(doc.id);
                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.vaultItemCard, isSelected && styles.vaultItemCardSelected]}
                    onPress={() => toggleVaultDocSelection(doc.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.vaultDocIconCircle,
                        isSelected && styles.vaultDocIconCircleSelected
                      ]}
                    >
                      <ArchiveBoxFillIcon size={16} color={isSelected ? '#FFFFFF' : '#2470F5'} />
                    </View>

                    <View style={styles.vaultItemTextCol}>
                      <Text style={styles.vaultItemTitle} numberOfLines={1}>
                        {doc.title}
                      </Text>
                      <Text style={styles.vaultItemMeta}>
                        {doc.courseCode || 'General'} • {doc.fileSize}
                      </Text>
                    </View>

                    <View style={styles.vaultCheckmarkCol}>
                      {isSelected ? (
                        <CheckmarkCircleFillIcon size={20} color="#10BA80" />
                      ) : (
                        <View style={styles.unselectedCircle} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA'
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
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2470F5'
  },
  saveTextDisabled: {
    color: '#8E9BAE',
    opacity: 0.4
  },
  scrollContent: {
    flex: 1
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 4
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85',
    letterSpacing: 0.3
  },
  requiredBadge: {
    backgroundColor: '#EC4545',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  requiredBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FC',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 52
  },
  inputCapsuleError: {
    backgroundColor: 'rgba(236, 69, 69, 0.08)',
    borderColor: '#EC4545',
    borderWidth: 1.5
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#121C33',
    padding: 0
  },
  colorGridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  colorButtonWrapper: {
    width: '16.66%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginBottom: 8
  },
  colorCircle: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  colorCircleUnselected: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  colorCircleSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  noticeContainer: {
    marginTop: 22,
    gap: 12
  },
  noticePillBlue: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(36, 112, 245, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(36, 112, 245, 0.20)',
    padding: 14
  },
  noticePillOrange: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(224, 115, 20, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(224, 115, 20, 0.20)',
    padding: 14
  },
  noticeIconWrap: {
    marginTop: 2,
    marginRight: 10
  },
  noticeTextCol: {
    flex: 1
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#121C33',
    marginBottom: 3
  },
  noticeDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#596B85',
    lineHeight: 17
  },
  attachedBadge: {
    backgroundColor: '#10BA80',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  requiredStatusBadge: {
    backgroundColor: '#EC4545',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  chooseBadge: {
    backgroundColor: 'rgba(224, 102, 31, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  chooseBadgeText: {
    color: '#E0661F',
    fontSize: 9,
    fontWeight: '700'
  },
  badgeTextWhite: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700'
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2
  },
  uploadMainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  uploadIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  uploadIconCircleBlue: {
    backgroundColor: '#2470F5'
  },
  uploadIconCircleGreen: {
    backgroundColor: '#10BA80'
  },
  uploadIconCirclePurple: {
    backgroundColor: '#8C45F5'
  },
  uploadCheckmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  uploadTextCol: {
    flex: 1
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#121C33',
    marginBottom: 2
  },
  uploadSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#596B85'
  },
  removePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(236, 69, 69, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16
  },
  removePillText: {
    color: '#EC4545',
    fontSize: 12,
    fontWeight: '700'
  },
  vaultSectionWrap: {
    marginTop: 4
  },
  vaultCountBadge: {
    backgroundColor: 'rgba(140, 69, 245, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  vaultCountBadgeText: {
    color: '#8C45F5',
    fontSize: 11,
    fontWeight: '700'
  },
  vaultItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    padding: 12,
    marginBottom: 8
  },
  vaultItemCardSelected: {
    borderColor: '#10BA80',
    backgroundColor: 'rgba(16, 186, 128, 0.04)'
  },
  vaultDocIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(36, 112, 245, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  vaultDocIconCircleSelected: {
    backgroundColor: '#10BA80'
  },
  vaultItemTextCol: {
    flex: 1
  },
  vaultItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#121C33'
  },
  vaultItemMeta: {
    fontSize: 12,
    color: '#596B85',
    marginTop: 2
  },
  vaultCheckmarkCol: {
    marginLeft: 10
  },
  unselectedCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#C7D1E0'
  }
});
