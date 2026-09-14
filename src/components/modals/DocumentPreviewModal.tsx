import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { VaultDocument } from '../../types/models';
import { CoursePalTheme } from '../../constants/theme';
import {
  DocFillIcon,
  GraduationCapFillIcon,
  BookFillIcon,
  CheckmarkCircleFillIcon
} from '../SvgIcons';
import { renderPDFPages } from '../../services/PDFTextExtractor';
import { useCoursePal } from '../../context/CoursePalContext';
import { formatShortDocumentTitle } from '../../utils/readingDisplayHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DocumentPreviewModalProps {
  visible: boolean;
  document: VaultDocument | null;
  onClose: () => void;
}

const resolveLocalPath = (uri: string | null | undefined): string | null => {
  if (!uri) return null;
  const docDir = FileSystem.documentDirectory;
  const cacheDir = FileSystem.cacheDirectory;
  if (docDir && uri.includes('/Documents/')) {
    const subpath = uri.split('/Documents/')[1];
    return `${docDir}${subpath}`;
  }
  if (cacheDir && uri.includes('/Library/Caches/')) {
    const subpath = uri.split('/Library/Caches/')[1];
    return `${cacheDir}${subpath}`;
  }
  return uri;
};

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  visible,
  document,
  onClose
}) => {
  const { courses, readings, assignments } = useCoursePal();
  const [pages, setPages] = useState<string[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false);
  const [hasFailedImages, setHasFailedImages] = useState<boolean>(false);

  useEffect(() => {
    if (!visible || !document) {
      setPages([]);
      setIsLoadingPages(false);
      setHasFailedImages(false);
      return;
    }

    const resolvedRawUri = resolveLocalPath(document.rawFileDataUri);

    // If pre-existing page images exist, map to current container
    if (document.pageImages && document.pageImages.length > 0) {
      const resolvedImages = document.pageImages
        .map(resolveLocalPath)
        .filter((u): u is string => Boolean(u));
      if (resolvedImages.length > 0) {
        setPages(resolvedImages);
        setIsLoadingPages(false);
        return;
      }
    }

    // If we have the raw file, render high-res pages dynamically
    if (resolvedRawUri) {
      setIsLoadingPages(true);
      renderPDFPages(resolvedRawUri, 30)
        .then(res => {
          if (res.imageUris && res.imageUris.length > 0) {
            setPages(res.imageUris);
          }
        })
        .catch(err => {
          console.warn('Failed to dynamically render document pages:', err);
        })
        .finally(() => {
          setIsLoadingPages(false);
        });
    }
  }, [visible, document]);

  if (!visible || !document) return null;

  const cardWidth = SCREEN_WIDTH - 40;
  const pageImageHeight = cardWidth * 1.333; // Standard 8.5x11 aspect ratio
  const resolvedRawUri = resolveLocalPath(document.rawFileDataUri);

  const matchedCourse = courses.find(c =>
    (c.courseCode && document.courseCode && c.courseCode.toUpperCase() === document.courseCode.toUpperCase()) ||
    c.id === (document as any).courseId
  );
  const matchedReadings = matchedCourse
    ? readings.filter(r => r.courseCode === matchedCourse.courseCode)
    : [];
  const matchedAssignments = matchedCourse
    ? assignments.filter(a => a.courseCode === matchedCourse.courseCode)
    : [];

  const handleImageError = () => {
    setHasFailedImages(true);
    // If an image fails to load and raw file is present, trigger a fresh render
    if (resolvedRawUri && !isLoadingPages) {
      setIsLoadingPages(true);
      renderPDFPages(resolvedRawUri, 30)
        .then(res => {
          if (res.imageUris && res.imageUris.length > 0) {
            setPages(res.imageUris);
            setHasFailedImages(false);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingPages(false);
        });
    }
  };

  const rawContentText = (document.fileContent || '').trim();
  const hasVisualPages = pages.length > 0 && !hasFailedImages;

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
              {formatShortDocumentTitle(document.title)}
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
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.docIconCircle}>
              <DocFillIcon size={32} color={document.docColorHex || CoursePalTheme.accentBlue} />
            </View>
            <Text style={styles.docTitle}>{formatShortDocumentTitle(document.title)}</Text>
            <Text style={styles.docMeta}>
              {document.courseCode || 'Course Syllabus'}{pages.length > 0 ? ` • ${pages.length} Pages` : ''}
            </Text>
          </View>

          {/* Visual PDF Page Photos */}
          {isLoadingPages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2470F5" />
              <Text style={styles.loadingText}>Rendering visual document pages...</Text>
            </View>
          ) : hasVisualPages ? (
            <View style={styles.pagesContainer}>
              {pages.map((imgUri, idx) => (
                <View key={idx} style={styles.pageCard}>
                  <View style={styles.pageBadge}>
                    <Text style={styles.pageBadgeText}>Page {idx + 1} of {pages.length}</Text>
                  </View>
                  <Image
                    source={{ uri: imgUri }}
                    style={[styles.pageImage, { width: cardWidth - 2, height: pageImageHeight }]}
                    resizeMode="contain"
                    onError={handleImageError}
                  />
                </View>
              ))}
            </View>
          ) : (
            /* Structured Syllabus & Course Outline View (Never Blank!) */
            <View style={styles.fallbackContainer}>
              {/* If we have an associated course, render a rich course summary */}
              {matchedCourse && (
                <View style={styles.courseSummaryCard}>
                  <View style={styles.courseSummaryHeader}>
                    <GraduationCapFillIcon size={20} color={matchedCourse.hexColor || CoursePalTheme.accentBlue} />
                    <Text style={styles.courseSummaryTitle}>{matchedCourse.courseName}</Text>
                  </View>
                  {matchedCourse.instructorName ? (
                    <Text style={styles.courseInstructorText}>
                      Instructor: {matchedCourse.instructorName}
                    </Text>
                  ) : null}

                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <BookFillIcon size={16} color="#2470F5" />
                      <Text style={styles.statCount}>{matchedReadings.length}</Text>
                      <Text style={styles.statLabel}>Readings</Text>
                    </View>
                    <View style={styles.statBox}>
                      <CheckmarkCircleFillIcon size={16} color="#059669" />
                      <Text style={styles.statCount}>{matchedAssignments.length}</Text>
                      <Text style={styles.statLabel}>Assignments</Text>
                    </View>
                    <View style={styles.statBox}>
                      <DocFillIcon size={16} color="#7C3AED" />
                      <Text style={styles.statCount}>{matchedCourse.termWeeks || 12}</Text>
                      <Text style={styles.statLabel}>Weeks</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Document Text Body Card */}
              <View style={styles.documentBodyCard}>
                <Text style={styles.contentHeader}>DOCUMENT SYLLABUS CONTENT</Text>
                <Text style={styles.contentText}>
                  {rawContentText ||
                    (matchedCourse
                      ? `Syllabus for ${matchedCourse.courseName} (${matchedCourse.courseCode || 'Course'}). This course contains ${matchedReadings.length} required reading modules and ${matchedAssignments.length} scheduled deliverables.`
                      : 'This document contains course syllabus outlines, required reading assignments, grading weight breakdown, and weekly seminar schedules.')}
                </Text>
              </View>
            </View>
          )}
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
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E3E8F0',
    gap: 12
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#596B85'
  },
  pagesContainer: {
    gap: 16,
    width: '100%'
  },
  pageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3
  },
  pageBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center'
  },
  pageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  pageImage: {
    backgroundColor: '#FFFFFF'
  },
  fallbackContainer: {
    width: '100%',
    gap: 16
  },
  courseSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  courseSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  courseSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1
  },
  courseInstructorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 12
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2
  },
  statCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B'
  }
});
