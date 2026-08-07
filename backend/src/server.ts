import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { query, generateSharingCode, memoryDb } from './db';
import { parseSyllabusDocument } from './services/syllabusParser';
import { NeuralDocumentEngine } from './services/neuralDocumentEngine';

const app = express();
const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3088', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ClassPal Antigravity 2.0 API', version: '2.0.0' });
});

// Neural Net API Routes
app.post('/api/neural/train', (req, res) => {
  const { docId, title, content } = req.body;
  if (!docId || !title || !content) {
    return res.status(400).json({ error: 'docId, title, and content are required' });
  }

  const engine = NeuralDocumentEngine.getInstance();
  const trainResult = engine.trainDocument(docId, title, content);
  res.json({
    status: 'success',
    docId,
    title,
    chunksCreated: trainResult.chunksCreated,
    totalIndexed: trainResult.totalIndexed,
    stats: engine.getStats()
  });
});

app.post('/api/neural/query', (req, res) => {
  const { queryText, topK } = req.body;
  if (!queryText) {
    return res.status(400).json({ error: 'queryText is required' });
  }

  const engine = NeuralDocumentEngine.getInstance();
  const results = engine.search(queryText, topK || 5);
  res.json({
    query: queryText,
    results: results.map(r => ({
      chunkId: r.chunk.id,
      docId: r.chunk.docId,
      title: r.chunk.title,
      contentSnippet: r.chunk.content,
      similarityScore: Math.round(r.similarityScore * 1000) / 1000,
      topicKeywords: r.chunk.topicKeywords
    }))
  });
});

app.get('/api/neural/stats', (req, res) => {
  const engine = NeuralDocumentEngine.getInstance();
  res.json(engine.getStats());
});

// 1. User Auth / Profile
app.post('/api/users', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await query(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING *`,
      [email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    // Memory DB fallback
    let user = Array.from(memoryDb.users.values()).find(u => u.email === email);
    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        email,
        created_at: new Date().toISOString()
      };
      memoryDb.users.set(user.id, user);
    }
    res.json(user);
  }
});

// 2. Syllabus Upload & Vision AI Parsing Endpoint with SHA-256 Deduplication
app.post('/api/syllabi/parse', upload.single('syllabus'), async (req, res) => {
  const userId = (req.body.userId as string) || '00000000-0000-0000-0000-000000000001';
  const rawText = req.body.rawText as string | undefined;

  try {
    // Calculate SHA-256 hash of syllabus payload for duplicate detection
    const contentToHash = req.file?.buffer || Buffer.from(rawText || '');
    const fileHash = contentToHash.length > 0
      ? crypto.createHash('sha256').update(contentToHash).digest('hex')
      : null;

    if (fileHash) {
      try {
        // Check for pre-existing course matching this SHA-256 file hash in PostgreSQL
        const existingRes = await query(`SELECT id FROM courses WHERE file_hash = $1 LIMIT 1`, [fileHash]);
        if (existingRes.rows.length > 0) {
          const existingCourseId = existingRes.rows[0].id;
          console.log(`[Deduplication] Matching SHA-256 hash found (${fileHash}). Auto-enrolling user ${userId} in course ${existingCourseId}`);
          
          await query(
            `INSERT INTO user_course_enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, existingCourseId]
          );

          const fullCourse = await getFullCourseDetails(existingCourseId, userId);
          return res.json({ ...fullCourse, deduplicated: true });
        }
      } catch (dbErr) {
        // Fallback SHA-256 hash check in memoryDb
        const existingCourse = Array.from(memoryDb.courses.values()).find(c => c.file_hash === fileHash);
        if (existingCourse) {
          console.log(`[Deduplication MemoryDB] Matching SHA-256 hash found (${fileHash}). Auto-enrolling user ${userId} in course ${existingCourse.id}`);
          memoryDb.userCourseEnrollments.set(`${userId}-${existingCourse.id}`, {
            id: `enroll-${Date.now()}`,
            user_id: userId,
            course_id: existingCourse.id,
            joined_at: new Date().toISOString()
          });

          const weeks = Array.from(memoryDb.weeks.values()).filter(w => w.course_id === existingCourse.id);
          const assignments = Array.from(memoryDb.assignments.values()).filter(a => a.course_id === existingCourse.id);
          return res.json({ ...existingCourse, weeks, assignments, deduplicated: true });
        }
      }
    }

    const parsedSyllabus = await parseSyllabusDocument(
      req.file?.buffer,
      req.file?.mimetype,
      rawText
    );

    // Auto-train Neural Document Engine on parsed syllabus content
    const neuralEngine = NeuralDocumentEngine.getInstance();
    neuralEngine.trainDocument(
      `doc-${Date.now()}`,
      parsedSyllabus.courseName || 'Course Syllabus',
      rawText || JSON.stringify(parsedSyllabus)
    );

    const sharingCode = generateSharingCode();

    try {
      // 1. Create course
      const courseRes = await query(
        `INSERT INTO courses (creator_id, course_name, course_code, term_weeks, sharing_code, file_hash)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, parsedSyllabus.courseName, parsedSyllabus.courseCode || null, parsedSyllabus.termWeeks, sharingCode, fileHash]
      );
      const course = courseRes.rows[0];

      // Automatically enroll creator
      await query(
        `INSERT INTO user_course_enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, course.id]
      );

      // 2. Insert weeks & readings
      for (const w of parsedSyllabus.weeks) {
        const weekRes = await query(
          `INSERT INTO weeks (course_id, week_number, start_date, theme)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [course.id, w.weekNumber, w.startDate || null, w.theme || null]
        );
        const week = weekRes.rows[0];

        for (const r of w.readings) {
          await query(
            `INSERT INTO readings (week_id, title, media_type) VALUES ($1, $2, $3)`,
            [week.id, r.title, r.mediaType]
          );
        }
      }

      // 3. Insert assignments
      for (const a of parsedSyllabus.assignments) {
        // Normalize month abbreviations that JS Date() can't parse (e.g. "Sept" → "Sep")
        const normalizedDate = a.dueDate
          ? a.dueDate.replace(/\bSept\b/i, 'Sep').replace(/\bJune\b/i, 'Jun').replace(/\bJuly\b/i, 'Jul')
          : null;
        const parsedDate = normalizedDate ? new Date(normalizedDate) : null;
        const validDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

        await query(
          `INSERT INTO assignments (course_id, title, due_date, full_instructions, points_possible, weight_percentage)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [course.id, a.title, validDate, a.fullInstructions || null, a.pointsPossible || null, a.weightPercentage || null]
        );
      }

      // Fetch complete course graph
      const fullCourse = await getFullCourseDetails(course.id, userId);
      return res.json(fullCourse);

    } catch (pgErr) {
      // Memory DB fallback
      const courseId = `course-${Date.now()}`;
      const course = {
        id: courseId,
        creator_id: userId,
        course_name: parsedSyllabus.courseName,
        course_code: parsedSyllabus.courseCode || 'CS 101',
        term_weeks: parsedSyllabus.termWeeks,
        sharing_code: sharingCode,
        file_hash: fileHash,
        created_at: new Date().toISOString()
      };
      memoryDb.courses.set(courseId, course);

      memoryDb.userCourseEnrollments.set(`${userId}-${courseId}`, {
        id: `enroll-${Date.now()}`,
        user_id: userId,
        course_id: courseId,
        joined_at: new Date().toISOString()
      });

      const weeksArr: any[] = [];
      const assignmentsArr: any[] = [];

      for (const w of parsedSyllabus.weeks) {
        const weekId = `week-${courseId}-${w.weekNumber}`;
        const readingsArr = w.readings.map((r, rIdx) => ({
          id: `reading-${weekId}-${rIdx}`,
          week_id: weekId,
          title: r.title,
          media_type: r.mediaType,
          is_completed: false
        }));

        readingsArr.forEach(r => memoryDb.readings.set(r.id, r));

        const weekObj = {
          id: weekId,
          course_id: courseId,
          week_number: w.weekNumber,
          start_date: w.startDate,
          theme: w.theme,
          readings: readingsArr
        };
        memoryDb.weeks.set(weekId, weekObj);
        weeksArr.push(weekObj);
      }

      for (const [idx, a] of parsedSyllabus.assignments.entries()) {
        const assignId = `assign-${courseId}-${idx}`;
        const assignObj = {
          id: assignId,
          course_id: courseId,
          title: a.title,
          due_date: a.dueDate,
          full_instructions: a.fullInstructions,
          points_possible: a.pointsPossible,
          weight_percentage: a.weightPercentage,
          note_text: ''
        };
        memoryDb.assignments.set(assignId, assignObj);
        assignmentsArr.push(assignObj);
      }

      return res.json({
        ...course,
        weeks: weeksArr,
        assignments: assignmentsArr
      });
    }

  } catch (err: any) {
    res.status(500).json({ error: 'Syllabus parsing failed', details: err.message });
  }
});

// Helper to assemble course details
async function getFullCourseDetails(courseId: string, userId: string) {
  const courseRes = await query(`SELECT * FROM courses WHERE id = $1`, [courseId]);
  if (courseRes.rows.length === 0) return null;
  const course = courseRes.rows[0];

  const weeksRes = await query(
    `SELECT * FROM weeks WHERE course_id = $1 ORDER BY week_number ASC`,
    [courseId]
  );

  const weeks = [];
  for (const w of weeksRes.rows) {
    const readingsRes = await query(
      `SELECT r.*, COALESCE(up.is_completed, false) as is_completed
       FROM readings r
       LEFT JOIN user_progress up ON r.id = up.reading_id AND up.user_id = $2
       WHERE r.week_id = $1`,
      [w.id, userId]
    );
    weeks.push({
      ...w,
      readings: readingsRes.rows
    });
  }

  const assignmentsRes = await query(
    `SELECT a.*, an.note_text
     FROM assignments a
     LEFT JOIN assignment_notes an ON a.id = an.assignment_id AND an.user_id = $2
     WHERE a.course_id = $1
     ORDER BY a.due_date ASC`,
    [courseId, userId]
  );

  return {
    ...course,
    weeks,
    assignments: assignmentsRes.rows
  };
}

// 3. Get Enrolled Courses for User
app.get('/api/courses', async (req, res) => {
  const userId = (req.query.userId as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const result = await query(
      `SELECT c.* FROM courses c
       JOIN user_course_enrollments e ON c.id = e.course_id
       WHERE e.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    const courses = [];
    for (const c of result.rows) {
      const full = await getFullCourseDetails(c.id, userId);
      if (full) courses.push(full);
    }
    res.json(courses);
  } catch (err) {
    // Memory DB fallback
    const enrolledIds = Array.from(memoryDb.userCourseEnrollments.values())
      .filter(e => e.user_id === userId)
      .map(e => e.course_id);

    const courses = Array.from(memoryDb.courses.values())
      .filter(c => enrolledIds.includes(c.id))
      .map(c => {
        const weeks = Array.from(memoryDb.weeks.values()).filter(w => w.course_id === c.id);
        const assignments = Array.from(memoryDb.assignments.values()).filter(a => a.course_id === c.id);
        return { ...c, weeks, assignments };
      });

    res.json(courses);
  }
});

// 4. Join Course by Sharing Code
app.post('/api/courses/join', async (req, res) => {
  const { userId, sharingCode } = req.body;
  if (!sharingCode) {
    return res.status(400).json({ error: 'Sharing code is required' });
  }
  const uid = userId || '00000000-0000-0000-0000-000000000001';

  try {
    const courseRes = await query(`SELECT * FROM courses WHERE UPPER(sharing_code) = UPPER($1)`, [sharingCode]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid course sharing code' });
    }
    const course = courseRes.rows[0];

    await query(
      `INSERT INTO user_course_enrollments (user_id, course_id)
       VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING`,
      [uid, course.id]
    );

    const fullCourse = await getFullCourseDetails(course.id, uid);
    res.json(fullCourse);
  } catch (err) {
    const course = Array.from(memoryDb.courses.values()).find(
      c => c.sharing_code?.toUpperCase() === sharingCode.toUpperCase()
    );
    if (!course) {
      return res.status(404).json({ error: 'Invalid course sharing code' });
    }

    memoryDb.userCourseEnrollments.set(`${uid}-${course.id}`, {
      id: `enroll-${Date.now()}`,
      user_id: uid,
      course_id: course.id,
      joined_at: new Date().toISOString()
    });

    const weeks = Array.from(memoryDb.weeks.values()).filter(w => w.course_id === course.id);
    const assignments = Array.from(memoryDb.assignments.values()).filter(a => a.course_id === course.id);

    res.json({ ...course, weeks, assignments });
  }
});

// 5. Toggle Reading Completion (User Progress)
app.post('/api/progress/toggle', async (req, res) => {
  const { userId, readingId, isCompleted } = req.body;
  const uid = userId || '00000000-0000-0000-0000-000000000001';

  if (!readingId) {
    return res.status(400).json({ error: 'Reading ID is required' });
  }

  try {
    const result = await query(
      `INSERT INTO user_progress (user_id, reading_id, is_completed, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, reading_id)
       DO UPDATE SET is_completed = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [uid, readingId, isCompleted]
    );
    res.json(result.rows[0]);
  } catch (err) {
    const key = `${uid}-${readingId}`;
    const progressObj = {
      id: `up-${Date.now()}`,
      user_id: uid,
      reading_id: readingId,
      is_completed: Boolean(isCompleted),
      updated_at: new Date().toISOString()
    };
    memoryDb.userProgress.set(key, progressObj);

    if (memoryDb.readings.has(readingId)) {
      memoryDb.readings.get(readingId).is_completed = Boolean(isCompleted);
    }
    res.json(progressObj);
  }
});

// 6. Save Personal Assignment Scratchpad Note
app.post('/api/notes', async (req, res) => {
  const { userId, assignmentId, noteText } = req.body;
  const uid = userId || '00000000-0000-0000-0000-000000000001';

  if (!assignmentId) {
    return res.status(400).json({ error: 'Assignment ID is required' });
  }

  try {
    const result = await query(
      `INSERT INTO assignment_notes (user_id, assignment_id, note_text, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, assignment_id)
       DO UPDATE SET note_text = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [uid, assignmentId, noteText || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    const key = `${uid}-${assignmentId}`;
    const noteObj = {
      id: `an-${Date.now()}`,
      user_id: uid,
      assignment_id: assignmentId,
      note_text: noteText || '',
      updated_at: new Date().toISOString()
    };
    memoryDb.assignmentNotes.set(key, noteObj);

    if (memoryDb.assignments.has(assignmentId)) {
      memoryDb.assignments.get(assignmentId).note_text = noteText || '';
    }

    res.json(noteObj);
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, host, () => {
    console.log(`[ClassPal Server] Running on http://${host}:${port}`);
  });
}

export default app;
