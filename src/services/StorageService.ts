/**
 * Storage Service
 * Type-safe abstraction over key-value storage (UserDefaults equivalent).
 * Uses in-memory fallback for test runners and headless node environments.
 */

export interface KeyValueStorage {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  getBoolean(key: string): boolean;
  setBoolean(key: string, value: boolean): void;
  getNumber(key: string): number | null;
  setNumber(key: string, value: number): void;
  delete(key: string): void;
  clearAll(): void;
}

class StorageService implements KeyValueStorage {
  private memoryStore = new Map<string, string>();

  getString(key: string): string | null {
    return this.memoryStore.get(key) ?? null;
  }

  setString(key: string, value: string): void {
    this.memoryStore.set(key, value);
  }

  getBoolean(key: string): boolean {
    const val = this.memoryStore.get(key);
    return val === 'true';
  }

  setBoolean(key: string, value: boolean): void {
    this.memoryStore.set(key, String(value));
  }

  getNumber(key: string): number | null {
    const val = this.memoryStore.get(key);
    if (val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  setNumber(key: string, value: number): void {
    this.memoryStore.set(key, String(value));
  }

  delete(key: string): void {
    this.memoryStore.delete(key);
  }

  clearAll(): void {
    this.memoryStore.clear();
  }
}

export const storage = new StorageService();
