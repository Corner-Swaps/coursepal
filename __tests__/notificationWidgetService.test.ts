import { NotificationService } from '../src/services/NotificationService';
import { Course, Reading, Assignment } from '../src/types/models';

describe('NotificationService & Widget Snapshot Calculus', () => {
  const mockCourses: Course[] = [
    {
      id: 'c-cpc512',
      courseCode: 'CPC 512',
      courseName: 'Family Systems Approaches',
      termWeeks: 10,
      hexColor: '#2470F5',
      sharingCode: 'CPC512',
      createdAt: new Date(),
      weeks: [],
      creatorId: 'user-1',
      isDeleted: false,
      isFavorite: false,
      assignments: [],
      syllabusDocs: []
    },
    {
      id: 'c-psyc101',
      courseCode: 'PSYC 101',
      courseName: 'Introduction to Psychology',
      termWeeks: 12,
      hexColor: '#10BA80',
      sharingCode: 'PSYC101',
      createdAt: new Date(),
      weeks: [],
      creatorId: 'user-1',
      isDeleted: false,
      isFavorite: false,
      assignments: [],
      syllabusDocs: []
    }
  ];

  const now = new Date('2026-09-12T12:00:00.000Z');

  const mockAssignments: Assignment[] = [
    {
      id: 'a-1',
      title: 'Family Genogram Paper',
      courseCode: 'CPC 512',
      dueDate: new Date('2026-09-13T18:00:00.000Z'), // ~30 hours away (Tomorrow)
      pointsPossible: '100 Pts',
      weightPercentage: '25%',
      isCompleted: false,
      isDeleted: false,
      isFavorite: false,
      weekNumber: 2,
      rubricCriteria: []
    },
    {
      id: 'a-2',
      title: 'Ethics Case Study',
      courseCode: 'PSYC 101',
      dueDate: new Date('2026-09-12T20:00:00.000Z'), // ~8 hours away (Due Today)
      pointsPossible: '50 Pts',
      weightPercentage: '15%',
      isCompleted: false,
      isDeleted: false,
      isFavorite: false,
      weekNumber: 1,
      rubricCriteria: []
    },
    {
      id: 'a-3',
      title: 'Archived Deleted Project',
      courseCode: 'CPC 512',
      dueDate: new Date('2026-09-15T12:00:00.000Z'),
      pointsPossible: '20 Pts',
      weightPercentage: '5%',
      isCompleted: false,
      isDeleted: true, // Should be ignored
      isFavorite: false,
      weekNumber: 3,
      rubricCriteria: []
    }
  ];

  const mockReadings: Reading[] = [
    {
      id: 'r-1',
      title: 'Structural Family Therapy Fundamentals',
      courseCode: 'CPC 512',
      chapterText: 'Chapter 4',
      dueDate: new Date('2026-09-12T15:00:00.000Z'), // Today
      isCompleted: true,
      isDeleted: false,
      isFavorite: false,
      weekNumber: 1,
      mediaType: 'textbook',
      mediaTypeRaw: 'textbook',
      summaryText: '',
      keyTakeawaysText: '',
      estimatedTimeText: '~40 min read'
    },
    {
      id: 'r-2',
      title: 'Cognitive Behavioral Modalities',
      courseCode: 'PSYC 101',
      chapterText: 'Chapter 8',
      dueDate: new Date('2026-09-16T12:00:00.000Z'),
      isCompleted: false,
      isDeleted: false,
      isFavorite: false,
      weekNumber: 2,
      mediaType: 'textbook',
      mediaTypeRaw: 'textbook',
      summaryText: '',
      keyTakeawaysText: '',
      estimatedTimeText: '~35 min read'
    }
  ];

  describe('generateWidgetSnapshot', () => {
    it('accurately computes total active items and completion percentages', () => {
      const snapshot = NotificationService.shared.generateWidgetSnapshot({
        courses: mockCourses,
        readings: mockReadings,
        assignments: mockAssignments,
        now
      });

      expect(snapshot).toBeDefined();
      // Total active = 2 assignments (a-1, a-2) + 2 readings (r-1, r-2) = 4
      expect(snapshot.totalActiveItems).toBe(4);
      // Completed = 1 reading (r-1)
      expect(snapshot.completedItemsCount).toBe(1);
      expect(snapshot.overallCompletionPct).toBe(25);
    });

    it('prioritizes uncompleted items due today and tomorrow in upcoming list', () => {
      const snapshot = NotificationService.shared.generateWidgetSnapshot({
        courses: mockCourses,
        readings: mockReadings,
        assignments: mockAssignments,
        now
      });

      expect(snapshot.upcomingItems.length).toBeGreaterThan(0);
      const firstItem = snapshot.upcomingItems[0];
      // Due Today assignment (a-2) should be first priority
      expect(firstItem.id).toBe('a-2');
      expect(firstItem.dueText).toBe('Today');
      expect(firstItem.courseCode).toBe('PSYC 101');
      expect(firstItem.hexColor).toBe('#10BA80');

      const secondItem = snapshot.upcomingItems[1];
      expect(secondItem.id).toBe('a-1');
      expect(secondItem.dueText).toBe('Tomorrow');
      expect(secondItem.courseCode).toBe('CPC 512');
    });

    it('generates per-course summaries with counts and color integrity', () => {
      const snapshot = NotificationService.shared.generateWidgetSnapshot({
        courses: mockCourses,
        readings: mockReadings,
        assignments: mockAssignments,
        now
      });

      expect(snapshot.coursesSummary).toHaveLength(2);
      const cpcCourse = snapshot.coursesSummary.find(c => c.courseCode === 'CPC 512');
      expect(cpcCourse).toBeDefined();
      expect(cpcCourse?.hexColor).toBe('#2470F5');
      // CPC 512 has 1 active assignment (a-1) + 1 active reading (r-1) = 2 total, 1 done
      expect(cpcCourse?.totalCount).toBe(2);
      expect(cpcCourse?.completedCount).toBe(1);
      expect(cpcCourse?.percentage).toBe(50);
    });
  });

  describe('planAssignmentDeadlineNotifications', () => {
    it('schedules 24-hour and day-of reminders for pending assignments', () => {
      const notifs = NotificationService.shared.planAssignmentDeadlineNotifications(
        mockAssignments,
        mockCourses
      );

      // 2 pending assignments with due dates -> 4 total notifications (day before + day of)
      expect(notifs).toHaveLength(4);

      const dayOfA2 = notifs.find(n => n.id === 'notif-dayof-a-2');
      expect(dayOfA2).toBeDefined();
      expect(dayOfA2?.title).toContain('PSYC 101');
      expect(dayOfA2?.body).toContain('Ethics Case Study');

      const dayBeforeA1 = notifs.find(n => n.id === 'notif-daybefore-a-1');
      expect(dayBeforeA1).toBeDefined();
      expect(dayBeforeA1?.title).toContain('CPC 512');
      expect(dayBeforeA1?.body).toContain('Family Genogram Paper');
      expect(dayBeforeA1?.body).toContain('100 Pts');
    });

    it('ignores completed and deleted assignments when planning notifications', () => {
      const completedAssignments: Assignment[] = [
        {
          ...mockAssignments[0],
          isCompleted: true
        }
      ];

      const notifs = NotificationService.shared.planAssignmentDeadlineNotifications(
        completedAssignments,
        mockCourses
      );

      expect(notifs).toHaveLength(0);
    });
  });
});
