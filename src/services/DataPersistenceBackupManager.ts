/**
 * DataPersistenceBackupManager
 * 1:1 Parity with native Swift DataPersistenceBackupManager.swift
 * Automatically schedules and executes disk backups to CoursePal_AutoBackup.json
 * and provides instant disaster recovery and state restoration.
 */

import * as FileSystem from 'expo-file-system';
import { Course, Reading, Assignment, VaultDocument } from '../types/models';

export interface BackupPayload {
  version: number;
  timestamp: number;
  courses: Course[];
  readings: Reading[];
  assignments: Assignment[];
  vaultDocs: VaultDocument[];
}

class DataPersistenceBackupManager {
  private static instance: DataPersistenceBackupManager;
  private backupFileName = 'CoursePal_AutoBackup.json';
  private backupTimer: NodeJS.Timeout | null = null;
  private isSaving = false;

  private constructor() {}

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

  /**
   * Schedules an auto-backup debounced by 400ms to avoid I/O bottlenecks during rapid edits
   */
  public scheduleAutoBackup(data: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    vaultDocs: VaultDocument[];
  }): void {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
    }
    this.backupTimer = setTimeout(() => {
      this.performAutoBackup(data);
    }, 400);
  }

  /**
   * Immediately writes current state to disk
   */
  public async performAutoBackup(data: {
    courses: Course[];
    readings: Reading[];
    assignments: Assignment[];
    vaultDocs: VaultDocument[];
  }): Promise<boolean> {
    if (this.isSaving) return false;
    this.isSaving = true;

    try {
      const payload: BackupPayload = {
        version: 2,
        timestamp: Date.now(),
        courses: data.courses,
        readings: data.readings,
        assignments: data.assignments,
        vaultDocs: data.vaultDocs
      };

      const jsonStr = JSON.stringify(payload);
      if (FileSystem.documentDirectory) {
        await FileSystem.writeAsStringAsync(this.backupFilePath, jsonStr, {
          encoding: FileSystem.EncodingType.UTF8
        });
      }
      return true;
    } catch (err) {
      // In headless testing or environments without FileSystem, safely return false
      return false;
    } finally {
      this.isSaving = false;
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
      if (!parsed || parsed.version < 2) {
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

      return parsed;
    } catch (err) {
      return null;
    }
  }
}

export const persistenceManager = DataPersistenceBackupManager.shared;
