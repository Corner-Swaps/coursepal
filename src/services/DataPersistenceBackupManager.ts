/**
 * DataPersistenceBackupManager
 * 1:1 Parity with native Swift DataPersistenceBackupManager.swift
 * Automatically schedules and executes disk backups to CoursePal_AutoBackup.json
 * and provides instant disaster recovery and state restoration.
 */

import * as FileSystem from 'expo-file-system';
import { Course, Reading, Assignment, VaultDocument, DiagnosticImportRecord } from '../types/models';
import { NotificationService } from './NotificationService';

export interface BackupPayload {
  version: number;
  timestamp: number;
  courses: Course[];
  readings: Reading[];
  assignments: Assignment[];
  vaultDocs: VaultDocument[];
  hasAcceptedTerms?: boolean;
  diagnosticRecord?: DiagnosticImportRecord | null;
}

export class DataPersistenceBackupManager {
  private static instance: DataPersistenceBackupManager;
  private backupFileName = 'CoursePal_AutoBackup.json';
  private termsFileName = 'CoursePal_TermsAccepted.json';
  private termsAcceptedCached: boolean | null = null;
  private cachedDiagnosticRecord: DiagnosticImportRecord | null = null;
  private backupTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public get lastDiagnosticRecord(): DiagnosticImportRecord | null {
    return this.cachedDiagnosticRecord;
  }

  public setLastDiagnosticRecord(record: DiagnosticImportRecord | null): void {
    this.cachedDiagnosticRecord = record;
  }

  public static get shared(): DataPersistenceBackupManager {
    if (!DataPersistenceBackupManager.instance) {
      DataPersistenceBackupManager.instance = new DataPersistenceBackupManager();
    }
    return DataPersistenceBackupManager.instance;
  }

  private get backupFilePath(): string {
    const dir = FileSystem.documentDirectory || '';
    return `${dir}${this.backupFileName}`;
  }

  private get termsFilePath(): string {
    const dir = FileSystem.documentDirectory || '';
    return `${dir}${this.termsFileName}`;
  }

  /**
   * Immediately saves state to disk without debounce, cancelling any pending debounced timer
   */
  public async saveImmediate(data: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    vaultDocs: VaultDocument[];
    diagnosticRecord?: DiagnosticImportRecord | null;
  }): Promise<boolean> {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
    }
    return this.performAutoBackup(data);
  }

  /**
   * Schedules an auto-backup debounced by 400ms to avoid I/O bottlenecks during rapid edits
   */
  public scheduleAutoBackup(data: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    vaultDocs: VaultDocument[];
    diagnosticRecord?: DiagnosticImportRecord | null;
  }): void {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
    }
    this.backupTimer = setTimeout(() => {
      this.performAutoBackup(data);
    }, 400);
  }

  private activeWritePromise: Promise<boolean> | null = null;
  private pendingWrite: {
    data: {
      courses: Course[];
      readings: Reading[];
      assignments: Assignment[];
      vaultDocs: VaultDocument[];
      diagnosticRecord?: DiagnosticImportRecord | null;
    };
    resolve: (val: boolean) => void;
  } | null = null;

  /**
   * Immediately writes current state to disk. If a write is currently in progress,
   * queues the latest data to be written as soon as the current operation completes,
   * and returns a promise that resolves only when that write actually completes.
   */
  public async performAutoBackup(data: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    vaultDocs: VaultDocument[];
    diagnosticRecord?: DiagnosticImportRecord | null;
  }): Promise<boolean> {
    if (this.activeWritePromise) {
      return new Promise<boolean>(resolve => {
        if (this.pendingWrite) {
          this.pendingWrite.resolve(false);
        }
        this.pendingWrite = { data, resolve };
      });
    }

    this.activeWritePromise = this.executeDiskWrite(data);
    try {
      const result = await this.activeWritePromise;
      return result;
    } finally {
      this.activeWritePromise = null;
      if (this.pendingWrite) {
        const next = this.pendingWrite;
        this.pendingWrite = null;
        this.performAutoBackup(next.data).then(res => next.resolve(res));
      }
    }
  }

  private async executeDiskWrite(data: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    vaultDocs: VaultDocument[];
    diagnosticRecord?: DiagnosticImportRecord | null;
  }): Promise<boolean> {
    try {
      if (!FileSystem.documentDirectory) {
        return false;
      }

      if (data.diagnosticRecord !== undefined) {
        this.cachedDiagnosticRecord = data.diagnosticRecord;
      }

      const payload: BackupPayload = {
        version: 3,
        timestamp: Date.now(),
        courses: data.courses,
        readings: data.readings,
        assignments: data.assignments,
        vaultDocs: data.vaultDocs,
        hasAcceptedTerms: this.termsAcceptedCached ?? true,
        diagnosticRecord: this.cachedDiagnosticRecord
      };

      const jsonStr = JSON.stringify(payload);
      await FileSystem.writeAsStringAsync(this.backupFilePath, jsonStr, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // Confirm file exists after write
      const info = await FileSystem.getInfoAsync(this.backupFilePath);
      if (!info.exists) {
        return false;
      }

      // Compute and write shared Widget Snapshot for iOS WidgetKit
      try {
        const widgetSnapshot = NotificationService.shared.generateWidgetSnapshot({
          courses: data.courses,
          readings: data.readings,
          assignments: data.assignments
        });
        const widgetPath = `${FileSystem.documentDirectory}CoursePal_WidgetSnapshot.json`;
        await FileSystem.writeAsStringAsync(widgetPath, JSON.stringify(widgetSnapshot), {
          encoding: FileSystem.EncodingType.UTF8
        });

        // Plan deadline notification reminders
        NotificationService.shared.planAssignmentDeadlineNotifications(
          data.assignments,
          data.courses
        );
      } catch (widgetErr) {
        // Non-blocking for widget snapshot
      }
      return true;
    } catch (err) {
      console.warn('AutoBackup write failure:', err);
      return false;
    }
  }

  /**
   * Loads the latest backup from disk if available
   */
  public async loadLatestBackup(): Promise<BackupPayload | null> {
    try {
      if (!FileSystem.documentDirectory) {
        return null;
      }
      const info = await FileSystem.getInfoAsync(this.backupFilePath);
      if (!info.exists) {
        return null;
      }

      const content = await FileSystem.readAsStringAsync(this.backupFilePath, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (!content || content.trim().length === 0) {
        return null;
      }

      const parsed: BackupPayload = JSON.parse(content);
      if (!parsed || parsed.version < 3) {
        return null;
      }
      // Revive ISO date strings to Date objects
      const reviveDate = (d: any): Date | null => {
        if (!d) return null;
        if (d instanceof Date) return d;
        const parsedD = new Date(d);
        return isNaN(parsedD.getTime()) ? null : parsedD;
      };

      if (Array.isArray(parsed.courses)) {
        parsed.courses = parsed.courses.map(c => ({
          ...c,
          createdAt: reviveDate(c.createdAt) || new Date()
        }));
      }

      if (Array.isArray(parsed.readings)) {
        parsed.readings = parsed.readings.map(r => ({
          ...r,
          dueDate: reviveDate(r.dueDate)
        }));
      }

      if (Array.isArray(parsed.assignments)) {
        parsed.assignments = parsed.assignments.map(a => ({
          ...a,
          dueDate: reviveDate(a.dueDate)
        }));
      }

      if (Array.isArray(parsed.vaultDocs)) {
        parsed.vaultDocs = parsed.vaultDocs.map(v => ({
          ...v,
          uploadedAt: reviveDate(v.uploadedAt) || new Date()
        }));
      }

      if (parsed.diagnosticRecord) {
        this.cachedDiagnosticRecord = parsed.diagnosticRecord;
      }

      return parsed;
    } catch (err) {
      return null;
    }
  }

  /**
   * Checks whether the user has previously accepted the Welcome / Terms & Conditions.
   * Caches in-memory so subsequent checks are synchronous and instantaneous.
   * If terms file is missing but user has existing data/backups, auto-infers acceptance
   * so an existing user is NEVER re-prompted.
   */
  public async loadTermsAccepted(): Promise<boolean> {
    if (this.termsAcceptedCached !== null) {
      return this.termsAcceptedCached;
    }
    try {
      if (!FileSystem.documentDirectory) return false;
      const info = await FileSystem.getInfoAsync(this.termsFilePath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(this.termsFilePath, {
          encoding: FileSystem.EncodingType.UTF8
        });
        if (content && content.trim().length > 0) {
          const parsed = JSON.parse(content);
          if (parsed?.accepted === true) {
            this.termsAcceptedCached = true;
            return true;
          }
        }
      }

      // Fallback: If user has an existing backup or has created courses/readings/assignments,
      // they have clearly already onboarded. Never re-prompt an existing user!
      const backup = await this.loadLatestBackup();
      if (
        backup &&
        (backup.hasAcceptedTerms === true ||
          (Array.isArray(backup.courses) && backup.courses.length > 0) ||
          (Array.isArray(backup.readings) && backup.readings.length > 0) ||
          (Array.isArray(backup.assignments) && backup.assignments.length > 0))
      ) {
        this.termsAcceptedCached = true;
        // Persist to disk so future loads find the file immediately
        await this.saveTermsAccepted();
        return true;
      }

      this.termsAcceptedCached = false;
      return false;
    } catch (err) {
      return false;
    }
  }

  /**
   * Persists terms acceptance to disk permanently so the welcome popup NEVER appears again
   */
  public async saveTermsAccepted(): Promise<boolean> {
    this.termsAcceptedCached = true;
    try {
      if (!FileSystem.documentDirectory) return false;
      await FileSystem.writeAsStringAsync(
        this.termsFilePath,
        JSON.stringify({ accepted: true, timestamp: Date.now() }),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      return true;
    } catch (err) {
      return false;
    }
  }
}

export const persistenceManager = DataPersistenceBackupManager.shared;
