/**
 * NotificationService
 * Manages deadline alerts, weekly reading digests, and home screen widget snapshots.
 *
 * Core Capabilities:
 * 1. Computes upcoming deadlines (due today, tomorrow, this week) with course color associations.
 * 2. Formats urgent & friendly notifications for upcoming assignments and readings.
 * 3. Generates a compact widget snapshot payload (WidgetSnapshot) ready for iOS WidgetKit / shared storage.
 * 4. Tracks notification preferences and simulated schedule queue for transparent on-device operation.
 */

import { Assignment, Reading, Course } from '../types/models';
import { parseSafeDate, formatAssignmentDueDate } from '../utils/readingDisplayHelper';

export interface ScheduledNotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'assignment_due' | 'reading_digest' | 'focus_reminder';
  courseCode: string;
  hexColor: string;
  fireDate: Date;
  targetItemId: string;
}

export interface WidgetUpcomingItem {
  id: string;
  title: string;
  courseCode: string;
  hexColor: string;
  type: 'assignment' | 'reading';
  dueText: string;
  isCompleted: boolean;
  priorityScore: number; // lower means more urgent
  urgencyLevel?: 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed';
  dueCountdown?: string;
  deepLinkUrl?: string;
}

export interface WidgetSnapshot {
  updatedAt: string;
  termWeek: number;
  totalActiveItems: number;
  completedItemsCount: number;
  overallCompletionPct: number;
  pendingDeliverablesCount?: number;
  smartGreeting?: string;
  upcomingItems: WidgetUpcomingItem[];
  coursesSummary: Array<{
    courseCode: string;
    courseName: string;
    hexColor: string;
    completedCount: number;
    totalCount: number;
    percentage: number;
  }>;
}


export class NotificationService {
  private static instance: NotificationService;

  private scheduledQueue: ScheduledNotificationItem[] = [];

  private constructor() {}

  public static get shared(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Builds a normalized WidgetSnapshot payload containing the next priority tasks and weekly progress.
   */
  public generateWidgetSnapshot(params: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    now?: Date;
  }): WidgetSnapshot {
    const { courses, readings, assignments } = params;
    const now = params.now || new Date();
    const nowMs = now.getTime();

    const activeReadings = readings.filter(r => !r.isDeleted);
    const activeAssignments = assignments.filter(a => !a.isDeleted);

    const totalActive = activeReadings.length + activeAssignments.length;
    const completedReadings = activeReadings.filter(r => r.isCompleted).length;
    const completedAssignments = activeAssignments.filter(a => a.isCompleted).length;
    const totalCompleted = completedReadings + completedAssignments;
    const overallPct = totalActive > 0 ? Math.round((totalCompleted / totalActive) * 100) : 0;

    // Map course colors
    const courseMap = new Map<string, Course>();
    courses.forEach(c => {
      if (c.courseCode) courseMap.set(c.courseCode.toLowerCase().trim(), c);
      if (c.courseName) courseMap.set(c.courseName.toLowerCase().trim(), c);
    });

    const resolveCourse = (code?: string | null): Course | undefined => {
      if (!code) return undefined;
      return courseMap.get(code.toLowerCase().trim());
    };

    // Build upcoming items list
    const upcoming: WidgetUpcomingItem[] = [];

    // Process assignments
    activeAssignments.forEach(a => {
       const c = resolveCourse(a.courseCode);
       const hexColor = c?.hexColor || '#2470F5';
       const courseCode = (c?.courseCode || a.courseCode || 'Assignment').toUpperCase();
       const dueDate = parseSafeDate(a.dueDate);

       let dueText = 'No Due Date';
       let priorityScore = 1000;
       let urgencyLevel: 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed' = 'upcoming';
       let dueCountdown: string | undefined = undefined;

       if (dueDate) {
         const diffHours = (dueDate.getTime() - nowMs) / (1000 * 60 * 60);
         if (diffHours < 0) {
           dueText = 'Overdue';
           urgencyLevel = 'overdue';
           dueCountdown = 'Overdue';
           priorityScore = -10;
         } else if (diffHours <= 24) {
           dueText = 'Today';
           urgencyLevel = 'today';
           dueCountdown = 'Today';
           priorityScore = 1;
         } else if (diffHours <= 48) {
           dueText = 'Tomorrow';
           urgencyLevel = 'tomorrow';
           dueCountdown = 'Tomorrow';
           priorityScore = 2;
         } else {
           dueText = formatAssignmentDueDate(dueDate) || `In ${Math.ceil(diffHours / 24)} days`;
           urgencyLevel = 'upcoming';
           dueCountdown = `In ${Math.ceil(diffHours / 24)}d`;
           priorityScore = Math.ceil(diffHours / 24);
         }
       } else if (a.weekNumber > 0) {
         dueText = `Week ${a.weekNumber}`;
         priorityScore = 200 + a.weekNumber;
       }

       if (a.isCompleted) {
         urgencyLevel = 'completed';
       }

       upcoming.push({
         id: a.id,
         title: a.title,
         courseCode,
         hexColor,
         type: 'assignment',
         dueText,
         isCompleted: !!a.isCompleted,
         priorityScore: a.isCompleted ? priorityScore + 10000 : priorityScore,
         urgencyLevel,
         dueCountdown,
         deepLinkUrl: `coursepal://tab/assignments?id=${encodeURIComponent(a.id)}`
       });
     });

    // Process readings
    activeReadings.forEach(r => {
      const c = resolveCourse(r.courseCode);
      const hexColor = c?.hexColor || '#2470F5';
      const courseCode = (c?.courseCode || r.courseCode || 'Reading').toUpperCase();
      const dueDate = parseSafeDate(r.dueDate);

      let dueText = r.chapterText || (r.weekNumber ? `Week ${r.weekNumber}` : 'Reading');
      let priorityScore = 500;
      let urgencyLevel: 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed' = 'upcoming';
      let dueCountdown: string | undefined = undefined;

      if (dueDate) {
        const diffHours = (dueDate.getTime() - nowMs) / (1000 * 60 * 60);
        if (diffHours < 0) {
          dueText = 'Overdue';
          urgencyLevel = 'overdue';
          dueCountdown = 'Overdue';
          priorityScore = -5;
        } else if (diffHours <= 24) {
          dueText = 'Today';
          urgencyLevel = 'today';
          dueCountdown = 'Today';
          priorityScore = 1.5;
        } else if (diffHours <= 48) {
          dueText = 'Tomorrow';
          urgencyLevel = 'tomorrow';
          dueCountdown = 'Tomorrow';
          priorityScore = 2.5;
        } else {
          dueText = formatAssignmentDueDate(dueDate) || `In ${Math.ceil(diffHours / 24)} days`;
          urgencyLevel = 'upcoming';
          dueCountdown = `In ${Math.ceil(diffHours / 24)}d`;
          priorityScore = Math.max(1, Math.ceil(diffHours / 24)) + 5;
        }
      }

      if (r.isCompleted) {
        urgencyLevel = 'completed';
      }

      upcoming.push({
        id: r.id,
        title: r.title,
        courseCode,
        hexColor,
        type: 'reading',
        dueText,
        isCompleted: !!r.isCompleted,
        priorityScore: r.isCompleted ? priorityScore + 10000 : priorityScore,
        urgencyLevel,
        dueCountdown,
        deepLinkUrl: `coursepal://tab/readings?id=${encodeURIComponent(r.id)}`
      });
    });

    // Sort by priority (uncompleted first, then soonest deadline)
    upcoming.sort((a, b) => a.priorityScore - b.priorityScore);

    const pendingDeliverables = upcoming.filter(item => !item.isCompleted);
    const hasOverdue = pendingDeliverables.some(item => item.urgencyLevel === 'overdue');
    const hasDueToday = pendingDeliverables.some(item => item.urgencyLevel === 'today');

    let smartGreeting = 'All caught up';
    if (hasOverdue) {
      smartGreeting = 'Overdue Deadlines';
    } else if (hasDueToday) {
      smartGreeting = 'Due Today';
    } else if (pendingDeliverables.length > 0) {
      smartGreeting = 'Upcoming Deadlines';
    }


    // Per-course breakdown
    const coursesSummary = courses.map(c => {
      const key = (c.courseCode || c.courseName || '').toLowerCase().trim();
      const cReadings = activeReadings.filter(r => (r.courseCode || '').toLowerCase().trim() === key);
      const cAssignments = activeAssignments.filter(a => (a.courseCode || '').toLowerCase().trim() === key);
      const cTotal = cReadings.length + cAssignments.length;
      const cDone = cReadings.filter(r => r.isCompleted).length + cAssignments.filter(a => a.isCompleted).length;
      const pct = cTotal > 0 ? Math.round((cDone / cTotal) * 100) : 0;

      return {
        courseCode: (c.courseCode || c.courseName).toUpperCase(),
        courseName: c.courseName,
        hexColor: c.hexColor,
        completedCount: cDone,
        totalCount: cTotal,
        percentage: pct
      };
    });

    return {
      updatedAt: now.toISOString(),
      termWeek: 1,
      totalActiveItems: totalActive,
      completedItemsCount: totalCompleted,
      overallCompletionPct: overallPct,
      pendingDeliverablesCount: pendingDeliverables.length,
      smartGreeting,
      upcomingItems: upcoming.slice(0, 10),
      coursesSummary
    };

  }

  /**
   * Plans and schedules deadline notifications for upcoming assignments.
   */
  public planAssignmentDeadlineNotifications(
    assignments: Assignment[],
    courses: Course[]
  ): ScheduledNotificationItem[] {
    const courseMap = new Map<string, Course>();
    courses.forEach(c => {
      if (c.courseCode) courseMap.set(c.courseCode.toLowerCase().trim(), c);
      if (c.courseName) courseMap.set(c.courseName.toLowerCase().trim(), c);
    });

    const planned: ScheduledNotificationItem[] = [];

    assignments
      .filter(a => !a.isDeleted && !a.isCompleted && a.dueDate)
      .forEach(a => {
        const dueDate = parseSafeDate(a.dueDate);
        if (!dueDate) return;

        const c = a.courseCode ? courseMap.get(a.courseCode.toLowerCase().trim()) : undefined;
        const code = (c?.courseCode || a.courseCode || 'Course').toUpperCase();
        const hexColor = c?.hexColor || '#2470F5';

        // 24 hours prior reminder
        const oneDayPrior = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
        oneDayPrior.setHours(9, 0, 0, 0); // 9:00 AM the day before

        planned.push({
          id: `notif-daybefore-${a.id}`,
          title: `Upcoming Deadline: ${code}`,
          body: `"${a.title}" is due tomorrow${a.pointsPossible ? ` (${a.pointsPossible})` : ''}.`,
          category: 'assignment_due',
          courseCode: code,
          hexColor,
          fireDate: oneDayPrior,
          targetItemId: a.id
        });

        // Morning of due date reminder (8:00 AM)
        const dayOf = new Date(dueDate);
        dayOf.setHours(8, 0, 0, 0);

        planned.push({
          id: `notif-dayof-${a.id}`,
          title: `Due Today: ${code}`,
          body: `Don't forget to submit "${a.title}" today!`,
          category: 'assignment_due',
          courseCode: code,
          hexColor,
          fireDate: dayOf,
          targetItemId: a.id
        });
      });

    this.scheduledQueue = planned;
    return planned;
  }

  /**
   * Returns current pending scheduled notification queue.
   */
  public getScheduledNotifications(): ScheduledNotificationItem[] {
    return [...this.scheduledQueue];
  }

  /**
   * Triggers native WidgetKit (iOS) or AppWidget (Android) timeline reload if native module is linked.
   */
  public async reloadWidgetTimelines(): Promise<boolean> {
    try {
      const { NativeModules } = require('react-native');
      if (NativeModules?.CoursePalWidgetManager?.reloadTimelines) {
        await NativeModules.CoursePalWidgetManager.reloadTimelines();
        return true;
      }
    } catch {
      // Graceful fallback
    }
    return false;
  }
}

