import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/classpal',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Fallback in-memory database for local testing when PostgreSQL server is disconnected
class MemoryDB {
  users: Map<string, any> = new Map();
  courses: Map<string, any> = new Map();
  weeks: Map<string, any> = new Map();
  readings: Map<string, any> = new Map();
  assignments: Map<string, any> = new Map();
  userCourseEnrollments: Map<string, any> = new Map();
  userProgress: Map<string, any> = new Map();
  assignmentNotes: Map<string, any> = new Map();

  constructor() {
    // Seed default demo user
    const defaultUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'student@university.edu',
      created_at: new Date().toISOString()
    };
    this.users.set(defaultUser.id, defaultUser);
  }
}

export const memoryDb = new MemoryDB();

export async function query(text: string, params?: any[]) {
  try {
    return await pool.query(text, params);
  } catch (err: any) {
    // If PG connection fails, log fallback and allow fallback handlers in API routes
    console.warn(`[DB Warning] PG query fallback due to connection error: ${err.message}`);
    throw err;
  }
}

export function generateSharingCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}
