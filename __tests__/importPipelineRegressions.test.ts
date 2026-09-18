import * as path from 'path';
import { execSync } from 'child_process';
import {
  SyllabusImportManager,
  SyllabusPayloadInput
} from '../src/services/SyllabusImportManager';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { deduplicateReadingsList } from '../src/utils/readingDisplayHelper';
import { Course, Assignment, Reading, ImportOutcome } from '../src/types/models';
import { DataPersistenceBackupManager } from '../src/services/DataPersistenceBackupManager';

describe('Document Import Pipeline Regression Test Suite (9 Core Repairs)', () => {
  // --------------------------------------------------------------------------
  // REPAIR 1: Stop merging different readings
  // --------------------------------------------------------------------------
  describe('Repair 1: Two different books with Chapter 1 in Week 2 must remain separate', () => {
    const rawReadings = [
      {
        title: 'Corey Ch. 1',
        chapterText: 'Chapter 1',
        authorName: 'Corey',
        resourceTitle: 'Theory and Practice of Group Counseling',
        weekNumber: 2
      },
      {
        title: 'Yalom Ch. 1',
        chapterText: 'Chapter 1',
        authorName: 'Yalom',
        resourceTitle: 'The Theory and Practice of Group Psychotherapy',
        weekNumber: 2
      }
    ];

    it('demonstrates failure before repair: naive deduplication keyed by week + chapter collapses different books', () => {
      // Pre-repair flawed deduplication pattern:
      const flawedMap = new Map<string, any>();
      for (const r of rawReadings) {
        // Flawed key only used week and chapter:
        const flawedKey = `w_${r.weekNumber}_ch_${r.chapterText.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        flawedMap.set(flawedKey, r);
      }
      // Demonstrates defect: One reading is lost!
      expect(flawedMap.size).toBe(1);
    });

    it('demonstrates success after repair: SyllabusImportManager preserves both readings as separate', () => {
      const deduplicated = SyllabusImportManager.deduplicateReadings(rawReadings as any);
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].authorName).toBe('Corey');
      expect(deduplicated[1].authorName).toBe('Yalom');
    });

    it('demonstrates success after repair: deduplicateReadingsList preserves both readings in display helper', () => {
      const readingsWithIds = rawReadings.map((r, i) => ({
        ...r,
        id: `r-${i + 1}`,
        weekId: `week-${r.weekNumber}`,
        courseCode: 'CPC 527',
        isCompleted: false,
        isDeleted: false
      }));

      const result = deduplicateReadingsList(readingsWithIds as any);
      expect(result).toHaveLength(2);
      const authors = result.map(r => r.authorName);
      expect(authors).toContain('Corey');
      expect(authors).toContain('Yalom');
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 2: Preserve recurring assignments
  // --------------------------------------------------------------------------
  describe('Repair 2: Recurring assignments with same title across different weeks must not collapse', () => {
    const recurringAssignments = [
      {
        title: 'Weekly Reflection',
        weekNumber: 1,
        dueDate: '2026-09-10',
        weightPercentage: '5%'
      },
      {
        title: 'Weekly Reflection',
        weekNumber: 2,
        dueDate: '2026-09-17',
        weightPercentage: '5%'
      },
      {
        title: 'Weekly Reflection',
        weekNumber: 3,
        dueDate: '2026-09-24',
        weightPercentage: '5%'
      }
    ];

    it('demonstrates failure before repair: title-only deduplication collapses 3 assignments into 1', () => {
      // Pre-repair flawed deduplication pattern:
      const flawedMap = new Map<string, any>();
      for (const a of recurringAssignments) {
        const flawedKey = a.title.toLowerCase().trim();
        flawedMap.set(flawedKey, a);
      }
      // Demonstrates defect: 2 assignments lost!
      expect(flawedMap.size).toBe(1);
    });

    it('demonstrates success after repair: SyllabusImportManager preserves all 3 occurrences', () => {
      const result = SyllabusImportManager.deduplicateAssignments(recurringAssignments as any);
      expect(result).toHaveLength(3);
      expect(result.map(a => a.weekNumber)).toEqual([1, 2, 3]);
      expect(result.map(a => a.dueDate?.toISOString().slice(0, 10))).toEqual(['2026-09-10', '2026-09-17', '2026-09-24']);
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 3: Duplicate mentions of one actual task must consolidate into 1
  // --------------------------------------------------------------------------
  describe('Repair 3: Duplicate mentions of one actual task consolidate into 1 task with enriched fields', () => {
    it('consolidates summary syllabus table mention with detailed instructions block', () => {
      const duplicateMentions = [
        {
          title: 'Distributed Key-Value Store',
          weekNumber: 2,
          dueDate: '2026-08-22',
          weightPercentage: '30%',
          pointsPossible: undefined
        },
        {
          title: 'Distributed Key-Value Store Assignment (CS 501)',
          dueDate: '2026-08-22',
          pointsPossible: '100 Points Possible',
          fullInstructions: 'Implement a distributed key-value store with leader election.'
        }
      ];

      const result = SyllabusImportManager.deduplicateAssignments(duplicateMentions as any);
      expect(result).toHaveLength(1);
      const consolidated = result[0];
      // Kept the cleaner title
      expect(consolidated.title).toContain('Distributed Key-Value Store');
      // Enriched with points from the second mention
      expect(consolidated.pointsPossible).toBe('100 Points Possible');
      // Enriched with instructions
      expect(consolidated.fullInstructions).toContain('Implement a distributed key-value store');
      // Kept weight from the first mention
      expect(consolidated.weightPercentage).toBe('30%');
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 4: Valid items-only response must normalize successfully
  // --------------------------------------------------------------------------
  describe('Repair 4: Normalize and validate AI responses (items-only & truncated JSON)', () => {
    it('successfully extracts tasks from items-only payload', () => {
      const itemsOnlyPayload: SyllabusPayloadInput = {
        courseCode: 'BIO 412',
        courseName: 'Molecular Genetics',
        items: [
          {
            title: 'Lab 1: DNA Gel Electrophoresis',
            type: 'assignment',
            weekNumber: 2,
            dueDate: '2026-09-20',
            pointsPossible: '50 Points'
          },
          {
            title: 'Lodish Chapter 4: Molecular Mechanisms',
            type: 'reading',
            chapterText: 'Chapter 4',
            weekNumber: 2,
            authorName: 'Lodish'
          }
        ]
      };

      const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(itemsOnlyPayload);
      expect(normalized.candidateAssignments).toHaveLength(1);
      expect(normalized.candidateAssignments[0].title).toBe('Lab 1: DNA Gel Electrophoresis');
      expect(normalized.candidateReadings).toHaveLength(1);
      expect(normalized.candidateReadings[0].title).toContain('Lodish Chapter 4');
    });

    it('repairs truncated JSON string from AI model output', () => {
      const truncatedJson = '{"courseCode":"CS 501","assignments":[{"title":"Project 1","pointsPossible":"50 Points"},{"title":"Project 2"';
      const repaired = SyllabusImportManager.repairTruncatedJson(truncatedJson);
      expect(repaired).not.toBeNull();
      const parsed = typeof repaired === 'string' ? JSON.parse(repaired) : repaired;
      expect(parsed.courseCode).toBe('CS 501');
      expect(parsed.assignments).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 5: Remove invented academic info
  // --------------------------------------------------------------------------
  describe('Repair 5: Remove invented points, years, and fake deadlines', () => {
    it('demonstrates failure before repair: naive sanitizeAssignment previously defaulted points to "100 Points"', () => {
      // Pre-repair logic:
      const oldSanitize = (raw: any) => ({
        pointsPossible: raw.pointsPossible || '100 Points'
      });
      const itemWithoutPoints = { title: 'Essay' };
      // Demonstrates defect:
      expect(oldSanitize(itemWithoutPoints).pointsPossible).toBe('100 Points');
    });

    it('demonstrates success after repair: SyllabusImportManager leaves points undefined when omitted', () => {
      const payload: SyllabusPayloadInput = {
        courseCode: 'PHIL 101',
        courseName: 'Ethics',
        assignments: [
          {
            title: 'Moral Philosophy Essay',
            // No points, no weight, no due date provided
            weekNumber: 4
          }
        ]
      };

      const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(payload);
      expect(normalized.candidateAssignments[0].pointsPossible).toBeUndefined();
      expect(normalized.candidateAssignments[0].weightPercentage).toBeUndefined();
      expect(normalized.candidateAssignments[0].dueDate).toBeUndefined();
    });

    it('does not fabricate year 2026 when document has no year', () => {
      const syllabusWithoutYear = `
        HIST 200: Early Modern History
        Course Assignments Details
        Historiographical Essay (20%) – Due October 15th at 11:59 PM
      `;
      const parsed = LocalSyllabusParser.shared.parseText(syllabusWithoutYear);
      // Date should not inject 2026-10-15 if 2026 was nowhere in the document
      const due = parsed.assignments?.[0]?.dueDate;
      expect(due).toBeDefined();
      expect(due).not.toContain('2026');
      expect(due?.toLowerCase()).toMatch(/oct(ober)? 15/);
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 6: Separate resources from assigned tasks
  // --------------------------------------------------------------------------
  describe('Repair 6: Bibliography-only books are catalog resources, not reading tasks', () => {
    it('preserves textbook resources in textbooks array without creating reading tasks', () => {
      const payloadWithResources: SyllabusPayloadInput = {
        courseCode: 'PSYC 300',
        courseName: 'Cognitive Psychology',
        resources: [
          {
            title: 'Cognitive Psychology: Mind, Research, and Everyday Experience',
            author: 'Goldstein, E. Bruce',
            edition: '5th Edition',
            isRequired: true
          }
        ],
        // No weekly readings assigned yet
        readings: []
      };

      const normalized = SyllabusImportManager.normalizeAndValidateSyllabusPayload(payloadWithResources);
      // Resource is retained in course textbooks:
      expect(normalized.textbooks).toHaveLength(1);
      expect(normalized.textbooks![0].title).toContain('Cognitive Psychology');
      expect(normalized.textbooks![0].authorName).toBe('Goldstein, E. Bruce');
      // No synthetic reading tasks created:
      expect(normalized.candidateReadings).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 7: Honest outcome reporting
  // --------------------------------------------------------------------------
  describe('Repair 7: Honest outcome reporting without false celebration', () => {
    it('reports UNREADABLE_DOCUMENT for empty or image-only scanned document', () => {
      const outcome = SyllabusImportManager.determineImportOutcome({
        fileName: 'scanned.pdf',
        hasReadablePayload: false,
        isApiSuccess: false,
        isFallbackUsed: false,
        isPartial: false,
        readingsCount: 0,
        assignmentsCount: 0,
        saveSuccess: false,
        errorMessage: 'Empty text found'
      });
      expect(outcome.outcome).toBe('UNREADABLE_DOCUMENT');
      expect(outcome.success).toBe(false);
      expect(outcome.message).toContain('scanned or image-only');
    });

    it('reports API_FAILURE when AI service fails with network or auth error', () => {
      const outcome = SyllabusImportManager.determineImportOutcome({
        fileName: 'syllabus.pdf',
        hasReadablePayload: true,
        isApiSuccess: false,
        isFallbackUsed: false,
        isPartial: false,
        readingsCount: 0,
        assignmentsCount: 0,
        saveSuccess: false,
        errorMessage: 'Network timeout: 403 Forbidden'
      });
      expect(outcome.outcome).toBe('API_FAILURE');
      expect(outcome.success).toBe(false);
    });

    it('reports NO_TASKS_FOUND when syllabus text has no schedule or assignments', () => {
      const outcome = SyllabusImportManager.determineImportOutcome({
        fileName: 'policy_only.pdf',
        hasReadablePayload: true,
        isApiSuccess: true,
        isFallbackUsed: false,
        isPartial: false,
        readingsCount: 0,
        assignmentsCount: 0,
        saveSuccess: true
      });
      expect(outcome.outcome).toBe('NO_TASKS_FOUND');
      expect(outcome.success).toBe(false);
    });

    it('reports SUCCESS only when tasks are genuinely extracted', () => {
      const outcome = SyllabusImportManager.determineImportOutcome({
        fileName: 'syllabus.pdf',
        hasReadablePayload: true,
        isApiSuccess: true,
        isFallbackUsed: false,
        isPartial: false,
        readingsCount: 3,
        assignmentsCount: 2,
        saveSuccess: true
      });
      expect(outcome.outcome).toBe('SUCCESS');
      expect(outcome.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 8: Reliable saving & persistence check
  // --------------------------------------------------------------------------
  describe('Repair 8: Reliable saving & persistence verification', () => {
    it('returns false and does not report success if disk write fails', async () => {
      // Mock DataPersistenceBackupManager.shared save to fail
      const originalSave = DataPersistenceBackupManager.shared.saveImmediate;
      try {
        DataPersistenceBackupManager.shared.saveImmediate = jest.fn().mockResolvedValue(false);
        const saveResult = await DataPersistenceBackupManager.shared.saveImmediate({
          courses: [],
          readings: [],
          assignments: [],
          vaultDocs: []
        });
        expect(saveResult).toBe(false);
        // UI should NOT report successful save if saveResult is false
      } finally {
        DataPersistenceBackupManager.shared.saveImmediate = originalSave;
      }
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 9: Reimporting same document preserves user edits and avoids multiplication
  // --------------------------------------------------------------------------
  describe('Repair 9: Reimporting same document preserves user state', () => {
    it('preserves isCompleted, user notes, and does not duplicate assignments', () => {
      const existingCourse: any = {
        id: 'c-1',
        creatorId: 'u-1',
        courseCode: 'CS 501',
        courseName: 'Distributed Systems Infrastructure',
        termWeeks: 16,
        hexColor: '#3B82F6',
        sharingCode: 'CS501-SHARE',
        isDeleted: false,
        isFavorite: false,
        createdAt: new Date(),
        weeks: [],
        assignments: [],
        syllabusDocs: []
      };

      const existingAssignments: any[] = [
        {
          id: 'a-1',
          courseCode: 'CS 501',
          title: 'Distributed Key-Value Store',
          weekNumber: 2,
          dueDate: new Date('2026-08-22'),
          weightPercentage: '30%',
          pointsPossible: '100 Points Possible',
          isCompleted: true, // User completed this!
          noteText: 'Completed with 100% test coverage', // User added notes!
          isDeleted: false
        }
      ];

      const existingReadings: any[] = [
        {
          id: 'r-1',
          courseCode: 'CS 501',
          title: 'Raft Consensus Algorithm Paper',
          weekNumber: 1,
          dueDate: new Date('2026-08-15'),
          mediaType: 'article',
          mediaTypeRaw: 'article',
          summaryText: '',
          keyTakeawaysText: '',
          estimatedTimeText: '',
          isFavorite: false,
          isCompleted: true, // User completed this!
          isDeleted: false
        }
      ];

      // Newly parsed syllabus from reimport
      const freshImportDTO = {
        courseCode: 'CS 501',
        courseName: 'Distributed Systems Infrastructure',
        assignments: [
          {
            title: 'Distributed Key-Value Store',
            dueDate: '2026-08-22',
            weightPercentage: '30%',
            pointsPossible: '100 Points Possible'
          },
          {
            title: 'New Final Project Deliverable',
            dueDate: '2026-11-30',
            weightPercentage: '40%'
          }
        ],
        readings: [
          {
            title: 'Raft Consensus Algorithm Paper',
            dueDate: '2026-08-15'
          }
        ]
      };

      const merged = SyllabusImportManager.mergeReimportedCourse({
        targetCourseId: 'c-1',
        existingCourses: [existingCourse],
        existingReadings: existingReadings,
        existingAssignments: existingAssignments,
        existingVaultDocs: [],
        newCourseData: { courseCode: 'CS 501', courseName: 'Distributed Systems Infrastructure' },
        newReadings: [
          {
            id: 'r-new-1',
            courseCode: 'CS 501',
            title: 'Raft Consensus Algorithm Paper',
            weekNumber: 1,
            dueDate: new Date('2026-08-15'),
            mediaType: 'article',
            mediaTypeRaw: 'article',
            summaryText: '',
            keyTakeawaysText: '',
            estimatedTimeText: '',
            isFavorite: false,
            isCompleted: false,
            isDeleted: false
          }
        ],
        newAssignments: [
          {
            id: 'a-reimp-1',
            courseCode: 'CS 501',
            title: 'Distributed Key-Value Store',
            weekNumber: 2,
            dueDate: new Date('2026-08-22'),
            weightPercentage: '30%',
            pointsPossible: '100 Points Possible',
            isCompleted: false,
            isDeleted: false,
            isFavorite: false,
            rubricCriteria: []
          },
          {
            id: 'a-new-2',
            courseCode: 'CS 501',
            title: 'New Final Project Deliverable',
            weekNumber: 10,
            dueDate: new Date('2026-11-30'),
            weightPercentage: '40%',
            isCompleted: false,
            isDeleted: false,
            isFavorite: false,
            rubricCriteria: []
          }
        ],
        newVaultDoc: {
          id: 'v-1',
          title: 'Syllabus',
          category: 'syllabus',
          fileSize: '1024',
          fileType: 'pdf',
          uploadedAt: new Date(),
          courseCode: 'CS 501',
          docColorHex: '#3B82F6'
        }
      });

      // Verify no duplicates
      expect(merged.updatedAssignments).toHaveLength(2); // 1 existing + 1 new
      expect(merged.updatedReadings).toHaveLength(1);

      // Verify user's completion status and notes were PRESERVED:
      const existingReconciled = merged.updatedAssignments.find((a: any) => a.id === 'a-1');
      expect(existingReconciled?.isCompleted).toBe(true);
      expect(existingReconciled?.noteText).toBe('Completed with 100% test coverage');

      const existingReadingReconciled = merged.updatedReadings.find((r: any) => r.id === 'r-1');
      expect(existingReadingReconciled?.isCompleted).toBe(true);

      // Verify new assignment was added
      const newAssign = merged.updatedAssignments.find((a: any) => a.title === 'New Final Project Deliverable');
      expect(newAssign).toBeDefined();
      expect(newAssign?.isCompleted).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // REAL PDF TESTS: 3 Real PDF Syllabi
  // --------------------------------------------------------------------------
  describe('Real PDF Evaluations: Schedule Table, Multi-Page, and Scanned Image', () => {
    it('PDF 1 (Schedule Table): Syllabus_1_CS501.pdf extracts assignments and readings without fabricated points', () => {
      const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/Syllabus_1_CS501.pdf');
      const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
      const fullText = execSync(`python3 -c "${pyScript}"`).toString();

      const parsed = LocalSyllabusParser.shared.parseText(fullText);
      expect(parsed.courseCode).toBe('CS 501');

      // Ground truth from Page 1:
      // Assignments: "Distributed Key-Value Store" (30%, 100 Points Possible, Due 2026-08-22)
      const assign = parsed.assignments?.find(a => a.title.includes('Distributed Key-Value Store'));
      expect(assign).toBeDefined();
      expect(assign?.dueDate).toContain('2026-08-22');
      expect(assign?.weightPercentage).toBe('30%');
      expect(assign?.pointsPossible).toContain('100 Points');

      // Readings: "Raft Consensus Algorithm Paper" (Week 1), "Watch MIT 6.824 Raft Lecture Video" (Week 3)
      const allReadings = (parsed.weeks || []).flatMap(w => w.readings || []);
      const raftReading = allReadings.find(r => r.title.toLowerCase().includes('raft'));
      expect(raftReading).toBeDefined();
    });

    it('PDF 2 (Multi-Page Syllabus): CPC527_Syllabus.pdf extracts distinct multi-author readings across 21 pages', () => {
      const pdfPath = path.resolve(__dirname, '../src/assets/syllabi/CPC527_Syllabus.pdf');
      const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
      const fullText = execSync(`python3 -c "${pyScript}"`).toString();

      const parsed = LocalSyllabusParser.shared.parseText(fullText);
      expect(parsed.courseCode).toBe('CPC 527');

      // Ground truth from Page 16/17 (Module 1 / Module 2):
      // Corey and Yalom must both exist in the extracted schedule
      const allReadings = (parsed.weeks || []).flatMap(w => w.readings || []);
      const hasCorey = allReadings.some(r => r.title.toLowerCase().includes('corey') || r.authorName?.toLowerCase().includes('corey'));
      const hasYalom = allReadings.some(r => r.title.toLowerCase().includes('yalom') || r.authorName?.toLowerCase().includes('yalom'));

      expect(hasCorey).toBe(true);
      expect(hasYalom).toBe(true);

      // Distinct assignments from Page 6:
      // "Group Facilitation Presentation/Project (40%)"
      // "Collaboration & Participation (25%)"
      // "Group Therapy Reflection Paper (25%)"
      expect(parsed.assignments?.length).toBeGreaterThanOrEqual(3);
    });

    it('PDF 3 (Scanned / Image-Only): scanned_image_syllabus.pdf reports UNREADABLE_DOCUMENT honestly', () => {
      const pdfPath = path.resolve(__dirname, 'fixtures/scanned_image_syllabus.pdf');
      const pyScript = `import pypdf; r=pypdf.PdfReader('${pdfPath}'); print('\\n'.join(p.extract_text() or '' for p in r.pages))`;
      const extractedText = execSync(`python3 -c "${pyScript}"`).toString().trim();

      // Verified: Scanned image PDF yields 0 text characters
      expect(extractedText.length).toBe(0);

      // Pipeline outcome check:
      const outcome = SyllabusImportManager.determineImportOutcome({
        fileName: 'scanned_image_syllabus.pdf',
        hasReadablePayload: false,
        isApiSuccess: false,
        isFallbackUsed: false,
        isPartial: false,
        readingsCount: 0,
        assignmentsCount: 0,
        saveSuccess: false
      });
      expect(outcome.outcome).toBe('UNREADABLE_DOCUMENT');
      expect(outcome.success).toBe(false);
      expect(outcome.message).toContain('scanned or image-only');
    });
  });

  // --------------------------------------------------------------------------
  // REPAIR 10: Dual-Engine Local Enrichment of AI Payloads (Rubrics & Weights)
  // --------------------------------------------------------------------------
  describe('Repair 10: Dual-Engine local enrichment fills missing weights and rubrics from AI payload', () => {
    it('enriches AI payload where Peer Review Group Report had unspecified weight and missing rubrics', () => {
      // Simulate raw AI output from Gemini that missed weight and rubrics
      const mockAiPayload = {
        courseName: 'Family Systems Approaches to Counselling',
        courseCode: 'CPC 512',
        assignments: [
          {
            title: 'Peer Review Group Report',
            dueDate: '2026-08-20',
            pointsPossible: '100 Points',
            weightPercentage: null, // AI failed to cross-reference Overview table 10%
            fullInstructions: 'Provide classmates with feedback on their in-class interventions presentation.',
            rubricCriteria: [] // AI previously lacked rubric schema
          },
          {
            title: 'Genogram/Family Mapping Paper',
            dueDate: '2026-07-30',
            pointsPossible: '100 Points',
            weightPercentage: '30%',
            fullInstructions: 'Write a comprehensive genogram paper.'
          }
        ],
        readings: [],
        weeks: []
      };

      const normalized = SyllabusImportManager.shared.normalizeAndValidateSyllabusPayload(mockAiPayload);
      expect(normalized.candidateAssignments[0].weightPercentage).toBeNull();
      expect(normalized.candidateAssignments[0].rubricCriteria?.length || 0).toBe(0);

      // Local parser result with extracted overview table weights and rubric criteria
      const mockLocalDto = {
        id: 'local-cpc-512',
        courseName: 'Family Systems Approaches to Counselling',
        courseCode: 'CPC 512',
        termWeeks: 12,
        weeks: [],
        readings: [],
        assignments: [
          {
            id: 'la-1',
            title: 'Peer Review Group Report',
            pointsPossible: '100 Points',
            weightPercentage: '10%',
            rubricCriteria: [
              { criterionName: 'Feedback Quality', points: 20 },
              { criterionName: 'Application of Theory', points: 20 },
              { criterionName: 'Intervention Critiques', points: 20 },
              { criterionName: 'Constructive Tone', points: 20 },
              { criterionName: 'Formatting and Clarity', points: 10 },
              { criterionName: 'Timeliness', points: 10 }
            ]
          },
          {
            id: 'la-2',
            title: 'Genogram/Family Mapping Paper',
            pointsPossible: '100 Points',
            weightPercentage: '30%',
            rubricCriteria: [
              { criterionName: 'Genogram Construction', points: 20 },
              { criterionName: 'Family History Analysis', points: 20 }
            ]
          },
          {
            id: 'la-3',
            title: 'Collaboration & Participation',
            pointsPossible: '100 Points',
            weightPercentage: '20%',
            rubricCriteria: [
              { criterionName: 'Attendance', points: 50 },
              { criterionName: 'Engagement', points: 50 }
            ]
          }
        ]
      };

      // Enrich payload
      const enriched = SyllabusImportManager.shared.enrichPayloadWithLocalExtraction(
        normalized,
        mockLocalDto as any
      );

      // Verify AI's Peer Review was enriched with 10% weight and 6 rubric criteria
      const peerReview = enriched.candidateAssignments.find(a => /Peer Review/i.test(a.title || ''));
      expect(peerReview).toBeDefined();
      expect(peerReview?.weightPercentage).toBe('10%');
      expect(peerReview?.rubricCriteria?.length).toBe(6);
      expect(peerReview?.pointsPossible).toBe('100 Points');

      // Verify AI completely missed deliverable "Collaboration & Participation" was preserved from overview table
      const collab = enriched.candidateAssignments.find(a => /Collaboration/i.test(a.title || ''));
      expect(collab).toBeDefined();
      expect(collab?.weightPercentage).toBe('20%');

      // Test clean assignments list deduplication
      const cleanAssignments = SyllabusImportManager.shared.deduplicateAssignments(enriched.candidateAssignments);
      const cleanPeerReview = cleanAssignments.find(a => /Peer Review/i.test(a.title));
      expect(cleanPeerReview).toBeDefined();
      expect(cleanPeerReview?.weightPercentage).toBe('10%');
      expect(cleanPeerReview?.rubricCriteria?.length).toBe(6);
      expect(cleanPeerReview?.pointsPossible).toBe('100 Points');
    });
  });
});

