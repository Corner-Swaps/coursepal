import { Platform, Linking, Share } from 'react-native';
import fs from 'fs';
import path from 'path';
import {
  extractTextFromPDFContent,
  extractTextFromPDF,
  extractTextViaVision,
  renderPDFPages,
  openNativeDocumentViewer,
  openDocumentQuickLook
} from '../src/services/PDFTextExtractor';
import { CalendarExportService } from '../src/services/CalendarExportService';
import { StoreReviewService } from '../src/services/StoreReviewService';
import { beginBackgroundTask, endBackgroundTask } from '../src/services/BackgroundTaskService';
import { NotificationService } from '../src/services/NotificationService';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Android Feature Parity & PDF Processing Suite', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    jest.clearAllMocks();
  });

  describe('1. app.json Android Configuration Parity', () => {
    it('contains valid android package and permissions configuration', () => {
      const appJsonPath = path.resolve(__dirname, '../app.json');
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

      expect(appJson.expo.android).toBeDefined();
      expect(appJson.expo.android.package).toBe('com.coursepal.app');
      expect(appJson.expo.android.versionCode).toBeGreaterThanOrEqual(1);
      expect(appJson.expo.android.permissions).toContain('CAMERA');
      expect(appJson.expo.android.permissions).toContain('READ_CALENDAR');
      expect(appJson.expo.android.permissions).toContain('WRITE_CALENDAR');
    });
  });

  describe('2. Cross-Platform PDF Text Stream Parsing', () => {
    it('returns raw text directly if content is already plain text', () => {
      const plain = 'Course: CS101 Introduction to Computer Science\nWeek 1: Foundations';
      const extracted = extractTextFromPDFContent(plain);
      expect(extracted).toBe(plain);
    });

    it('extracts plain text from standard PDF BT...ET streams with Tj and TJ', () => {
      const syntheticPdfStream = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
(CS 301 Advanced Algorithms) Tj
ET
BT
/F1 10 Tf
72 680 Td
[(Assignment 1: Dynamic Programming) 20 ( - Due Oct 14)] TJ
ET
endstream
endobj
      `;

      const extracted = extractTextFromPDFContent(syntheticPdfStream);
      expect(extracted).toContain('CS 301 Advanced Algorithms');
      expect(extracted).toContain('Assignment 1: Dynamic Programming - Due Oct 14');
    });

    it('decodes octal escape sequences and nested parentheses properly', () => {
      const pdfWithEscapes = `
BT
(Welcome\\040to\\040ClassPal\\040\\(Term\\0401\\)) Tj
ET
      `;
      const extracted = extractTextFromPDFContent(pdfWithEscapes);
      expect(extracted).toContain('Welcome to ClassPal (Term 1)');
    });

    it('extracts hex encoded text in PDF streams', () => {
      // "Syllabus" in ASCII hex: 53 79 6c 6c 61 62 75 73
      const pdfWithHex = `
BT
<53796c6c61627573> Tj
ET
      `;
      const extracted = extractTextFromPDFContent(pdfWithHex);
      expect(extracted).toContain('Syllabus');
    });

    it('renderPDFPages returns graceful empty fallback without throwing on Android', async () => {
      (Platform as any).OS = 'android';
      const res = await renderPDFPages('file:///data/user/0/com.coursepal.app/cache/sample.pdf', 5);
      expect(res).toEqual({ pageCount: 0, imageUris: [], base64Pages: [] });
    });
  });

  describe('3. Native Document Viewer & Quick Look Parity', () => {
    it('openNativeDocumentViewer invokes system opener on Android', async () => {
      (Platform as any).OS = 'android';

      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

      const success = await openNativeDocumentViewer('file:///data/user/0/com.coursepal.app/cache/doc.pdf');
      expect(success).toBe(true);
      expect(canOpenSpy).toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalled();
    });

    it('openNativeDocumentViewer falls back to Share.share on Android if canOpenURL is false', async () => {
      (Platform as any).OS = 'android';

      jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

      const success = await openNativeDocumentViewer('file:///data/user/0/com.coursepal.app/cache/doc.pdf');
      expect(success).toBe(true);
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('doc.pdf')
        })
      );
    });

    it('openDocumentQuickLook is an exact alias for openNativeDocumentViewer', () => {
      expect(openDocumentQuickLook).toBe(openNativeDocumentViewer);
    });
  });

  describe('4. Calendar Export Parity on Android', () => {
    it('shares .ics file URL on Android instead of raw text dump', async () => {
      (Platform as any).OS = 'android';

      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

      const ics = CalendarExportService.createCourseScheduleICS(
        {
          id: 'c1',
          creatorId: 'user-1',
          courseCode: 'CS 101',
          courseName: 'Intro to Computer Science',
          hexColor: '#2470F5',
          termWeeks: 12,
          sharingCode: 'CS101-ABC',
          isDeleted: false,
          isFavorite: false,
          createdAt: new Date(),
          weeks: [],
          assignments: [],
          syllabusDocs: []
        },
        [
          {
            id: 'a1',
            courseId: 'c1',
            courseCode: 'CS 101',
            title: 'Project 1',
            dueDate: new Date('2026-10-15T23:59:00Z'),
            weekNumber: 1,
            isDeleted: false,
            isFavorite: false,
            rubricCriteria: [],
            isCompleted: false
          }
        ],
        []
      );

      const success = await CalendarExportService.exportAndShareICS('CS101_Schedule', ics, 'CS 101 Schedule');
      expect(success).toBe(true);
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'CS 101 Schedule',
          url: expect.stringContaining('.ics')
        }),
        expect.objectContaining({
          dialogTitle: 'CS 101 Schedule'
        })
      );
    });
  });

  describe('5. Store Review & Background Task Parity on Android', () => {
    it('openAppStoreReviewPage opens Google Play market URL on Android', async () => {
      (Platform as any).OS = 'android';

      const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

      const success = await StoreReviewService.shared.openAppStoreReviewPage();

      expect(success).toBe(true);
      expect(canOpenSpy).toHaveBeenCalledWith('market://details?id=com.coursepal.app');
      expect(openSpy).toHaveBeenCalledWith('market://details?id=com.coursepal.app');
    });

    it('beginBackgroundTask provides safe token counter on Android without crashing', async () => {
      (Platform as any).OS = 'android';

      const taskId = await beginBackgroundTask('SyllabusUpload');
      expect(typeof taskId).toBe('number');
      expect(taskId).toBeGreaterThanOrEqual(1000);

      // Should complete cleanly
      await expect(endBackgroundTask('SyllabusUpload')).resolves.not.toThrow();
    });

    it('reloadWidgetTimelines does not throw on Android', async () => {
      (Platform as any).OS = 'android';
      const result = await NotificationService.shared.reloadWidgetTimelines();
      expect(result).toBe(false);
    });
  });

  describe('6. End-to-End Parsing Rules Parity with Android Extracted Stream', () => {
    it('parses structured course, readings, and deliverables from stream-extracted PDF text', () => {
      const androidExtractedText = `
CPC 523 Psychology of Sexuality and Human Development
Instructor: Dr. Jane Doe
Email: jdoe@university.edu

Course Overview of Required Assignments:
1. Research Article Analysis (20%) - 100 Points
2. Peer Review Group Report (10%) - 100 Points
3. Sexuality Reflection Assignment (30%) - 100 Points
4. Final Research Study Design (40%) - 100 Points

Schedule and Weekly Readings:
Week 1 July 3rd Introduction
Required: Watch: The keys to a happier, healthier sex life, Emily Nagoski - TED
Week 2 July 10th Cultural Influences
Required: Corey Ch. 1 & 2 Yalom Ch. 1
Week 5 July 31st Consensual Relationships
Due: Sexuality Reflection Assignment
      `;

      const parsed = LocalSyllabusParser.shared.parseText(androidExtractedText);
      expect(parsed.courseCode).toBe('CPC 523');
      expect(parsed.courseName).toContain('Sexuality');

      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(parsed, androidExtractedText);

      // Rule 1: Deliverables extracted
      expect(normalized.candidateAssignments.length).toBeGreaterThanOrEqual(4);

      // Rule 4: Multi-book split
      const week2Readings = normalized.candidateReadings.filter(
        r => r.weekNumber === 2 || Boolean(r.title?.includes('Corey')) || Boolean(r.title?.includes('Yalom'))
      );
      expect(week2Readings.length).toBeGreaterThanOrEqual(2);

      // Rule 7: Honest outcome
      const outcome = SyllabusImportManager.shared.determineImportOutcome({
        fileName: 'CPC523_Syllabus.pdf',
        hasReadablePayload: true,
        isApiSuccess: true,
        isFallbackUsed: false,
        isPartial: false,
        readingsCount: normalized.candidateReadings.length,
        assignmentsCount: normalized.candidateAssignments.length,
        saveSuccess: true
      });
      expect(outcome.outcome).toBe('SUCCESS');
    });

    it('handles extractTextViaVision safely when on non-native environments or empty inputs', async () => {
      const emptyRes = await extractTextViaVision('');
      expect(emptyRes).toBe('');

      const validPathEmptyRes = await extractTextViaVision('/path/to/nonexistent.pdf');
      expect(typeof validPathEmptyRes).toBe('string');
    });
  });
});
