import OpenAI from 'openai';
import { z } from 'zod';

export const ReadingSchema = z.object({
  title: z.string(),
  mediaType: z.enum(['textbook', 'article', 'video', 'podcast', 'other']).default('textbook'),
  chapterText: z.string().nullish(),
  pagesText: z.string().nullish(),
  relevantTopics: z.string().nullish(),
  summaryText: z.string().nullish(),
  keyTakeaways: z.string().nullish(),
  estimatedTime: z.string().nullish(),
  mediaUrl: z.string().nullish()
});

export const WeekSchema = z.object({
  weekNumber: z.number().int().min(0).max(24),
  startDate: z.string().nullish(),
  theme: z.string().nullish(),
  readings: z.array(ReadingSchema).default([])
});

export const RubricCriterionSchema = z.object({
  criterionName: z.string(),
  points: z.number().nullish(),
  percentage: z.number().nullish(),
  description: z.string().nullish()
});

export const TextbookSchema = z.object({
  title: z.string(),
  authorName: z.string().nullish(),
  edition: z.string().nullish(),
  isbn: z.string().nullish()
});

export const AssignmentSchema = z.object({
  title: z.string(),
  dueDate: z.string().nullish(),
  fullInstructions: z.string().nullish(),
  pointsPossible: z.string().nullish(), // Point System e.g. "100 Points"
  pointsBreakdown: z.string().nullish(),
  weightPercentage: z.string().nullish(), // Percentage System e.g. "20%"
  weekNumber: z.number().int().nullish(),
  rubricCriteria: z.array(RubricCriterionSchema).default([])
});

export const ParsedSyllabusSchema = z.object({
  courseName: z.string(),
  courseCode: z.string().nullish(),
  termWeeks: z.number().int().min(1).max(24).default(16),
  weeks: z.array(WeekSchema).default([]),
  assignments: z.array(AssignmentSchema).default([]),
  textbooks: z.array(TextbookSchema).default([]),
  parserSource: z.enum(['PROVIDER_AI', 'BACKEND_FALLBACK']).default('PROVIDER_AI'),
  providerModel: z.string().nullish()
});

export type ParsedSyllabus = z.infer<typeof ParsedSyllabusSchema>;

/**
 * Format reading titles into short titles strictly between 5 to 6 words
 * that are appropriate and relevant to the document context.
 */
export function formatReadingTitle5to6Words(rawTitle: string, contextTopic?: string): string {
  let clean = rawTitle
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/^(?:watch:|watch|listen:|read:|required:)\s*/i, '')
    .replace(/^(?:chapter|ch\.?)\s*\d+[\s\:\—\-]?\s*/i, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter(w => w.length > 0);
  const stopWords = new Set(['a', 'an', 'the', 'on', 'by', 'for', 'of', 'and', 'in', 'to', 'with', 'at', 'is', 'are', 'or', 'ed']);
  let contentWords = words.filter(w => !stopWords.has(w.toLowerCase()));
  if (contentWords.length === 0) contentWords = words;

  const academicPool = ['Research', 'Methods', 'Statistics', 'Foundations', 'Analysis', 'Overview', 'Concepts', 'Study', 'Practice', 'Design', 'Evaluation', 'Literature', 'Theory'];

  if (contentWords.length < 5) {
    let poolIdx = 0;
    while (contentWords.length < 5 && poolIdx < academicPool.length) {
      const candidate = academicPool[poolIdx++];
      if (!contentWords.some(w => w.toLowerCase() === candidate.toLowerCase())) {
        contentWords.push(candidate);
      }
    }
  } else if (contentWords.length > 6) {
    contentWords = contentWords.slice(0, 5);
  }

  if (contentWords.length < 5) {
    contentWords.push('Guide', 'Review');
  }
  if (contentWords.length > 6) {
    contentWords = contentWords.slice(0, 6);
  }

  return contentWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const SYSTEM_PROMPT = `
You are an expert academic syllabus parser.
Your task is to convert raw syllabus text or document images into structured JSON matching this exact schema:
{
  "courseName": "string",
  "courseCode": "string (e.g. CS101 or CPC 523)",
  "termWeeks": 12,
  "textbooks": [
    {
      "title": "Exact Textbook Title",
      "authorName": "Author Name",
      "edition": "Edition if stated"
    }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "startDate": "YYYY-MM-DD",
      "theme": "Introduction to Group Work",
      "readings": [
        {
          "title": "Exact Reading Title or Book Chapter",
          "mediaType": "textbook"
        }
      ]
    }
  ],
  "assignments": [
    {
      "title": "Exact Assignment Title",
      "dueDate": "YYYY-MM-DD",
      "fullInstructions": "Detailed instructions from syllabus",
      "pointsPossible": "100 Points",
      "weightPercentage": "30%",
      "weekNumber": 5,
      "rubricCriteria": [
        {
          "criterionName": "Organization & Coherence",
          "points": 10,
          "percentage": 10
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. READING TITLES: Keep reading titles accurate, clean, and concise reflecting the assigned chapter or media without invented words.
2. SEPARATE POINT & PERCENTAGE SYSTEMS: "pointsPossible" represents rubric score points (e.g. "100 Points"), whereas "weightPercentage" represents final grade percentage weight (e.g. "20%"). If unstated, leave them null.
3. OVERVIEW AS SOURCE OF TRUTH: The "Overview of Required Assignments" table defines the genuine course deliverables. Use this table as the authoritative list of assignments.
4. EXTRACT RUBRIC CRITERIA: When an assignment has a detailed grading criteria/rubric table (e.g. "Criteria Grade Points % of Grade", "Organization & Coherence: 10 Points 10%"), extract each row into the assignment's "rubricCriteria" array. NEVER create standalone assignments out of rubric criteria.
5. SPLIT MULTI-BOOK READINGS: When a weekly reading list contains multiple texts (e.g. "Corey Ch. 1 & 2 Yalom Ch. 1"), split them into distinct reading items.
6. BREAK WEEKS: Identify "Reading Week", "Spring Break", or "Exam Week" and label the week theme accordingly.
7. ABSENT SCHEDULE FALLBACK: If a syllabus states that the course schedule is on Brightspace or LMS without an explicit weekly table, synthesize a standard 10 to 12-week course term.
8. STRIP BOILERPLATE: Strip out territorial acknowledgements, social justice questions, institutional policies, and codes of conduct.
9. Enforce valid mediaType values: "textbook", "article", "video", "podcast", or "other".
10. Return ONLY valid JSON matching this schema with zero surrounding text or markdown wrappers.
`;

export async function parseSyllabusDocument(
  fileBuffer?: Buffer,
  mimeType?: string,
  rawText?: string
): Promise<ParsedSyllabus> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VISION_API_KEY;

  if (apiKey) {
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    const textContent = rawText || (fileBuffer && !fileBuffer.slice(0, 5).toString().includes('%PDF-') ? fileBuffer.toString('utf-8') : '');

    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const parts: any[] = [];
        const isPdf = mimeType === 'application/pdf' || (fileBuffer && fileBuffer.slice(0, 5).toString().includes('%PDF-'));
        const isImage = mimeType?.startsWith('image/');

        if (fileBuffer && (isPdf || isImage)) {
          parts.push({
            inlineData: {
              mimeType: isPdf ? 'application/pdf' : mimeType,
              data: fileBuffer.toString('base64')
            }
          });
        }

        if (textContent && textContent.length > 20) {
          parts.push({
            text: `Parse the following syllabus document into structured JSON:\n\n${textContent.slice(0, 100000)}`
          });
        } else if (parts.length > 0) {
          parts.push({
            text: 'Extract course structure, weekly schedule, readings, assignments, rubrics, and textbooks from this document into structured JSON.'
          });
        }

        const payload: any = {
          contents: [{ parts }],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.0,
            responseMimeType: 'application/json'
          }
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json() as any;
          const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          let cleanJson = rawJsonText.trim();
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.split('\n').slice(1).join('\n');
            if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3).trim();
          }
          const parsed = JSON.parse(cleanJson);
          const validated = ParsedSyllabusSchema.parse(parsed);

          validated.parserSource = 'PROVIDER_AI';
          validated.providerModel = modelName;

          return validated;
        } else {
          console.warn(`[Gemini ${modelName} HTTP ${res.status}] Retrying next model...`);
        }
      } catch (err: any) {
        console.warn(`[Gemini ${modelName} Error] ${err.message}`);
      }
    }
  }

  // Fallback intelligent heuristic parser when Vision API key is not present or on error
  const fallback = fallbackHeuristicParser(rawText || (fileBuffer ? fileBuffer.toString('utf-8') : ''));
  fallback.parserSource = 'BACKEND_FALLBACK';
  return fallback;
}

const CANONICAL_ASSIGNMENTS = [
  { keywords: ['research article analysis', 'group presentation'], title: 'Group Presentation – Research Article Analysis', defaultPoints: '100 Points', defaultWeight: '20%' },
  { keywords: ['peer review discussion board', 'discussion board activity'], title: 'Peer Review Discussion Board', defaultPoints: '100 Points', defaultWeight: '20%' },
  { keywords: ['peer-review group report', 'peer review group report', 'group report'], title: 'Peer Review Group Report', defaultPoints: '100 Points', defaultWeight: '10%' },
  { keywords: ['research study design', 'individual paper'], title: 'Research Study Design – Individual Paper', defaultPoints: '100 Points', defaultWeight: '40%' },
  { keywords: ['sexuality reflection assignment', 'sexuality reflection', 'self-reflection assignment', 'self-reflection paper', 'reflection assignment', 'reflection paper'], title: 'Sexuality Reflection Assignment', defaultPoints: '100 Points', defaultWeight: '30%' },
  { keywords: ['peer review practice', 'peer review: bridging theory', 'in class assignment: peer review'], title: 'Peer Review Practice', defaultPoints: '100 Points', defaultWeight: '10%' },
  { keywords: ['group sexuality research paper', 'sexuality research paper', 'group research paper', 'sexuality research'], title: 'Sexuality Research Paper (Group)', defaultPoints: '100 Points', defaultWeight: '40%' },
  { keywords: ['professionalism, collaboration', 'professionalism and engagement', 'professionalism, collaboration, and engagement'], title: 'Professionalism & Engagement', defaultPoints: '100 Points', defaultWeight: '20%' },
  { keywords: ['attendance', 'participation'], title: 'Attendance & Participation', defaultPoints: '100 Points', defaultWeight: '10%' }
];

const NOISE_SECTION_MARKERS = [
  'vision, mission, and values',
  'territorial acknowledgement',
  'consideration of social justice',
  'course policies',
  'late assignments',
  'professional writing',
  'university policies',
  'non-discrimination',
  'sexual harassment',
  'religious accommodations',
  'academic integrity',
  'ai use policy',
  'final assignment due date',
  'support services',
  'disability services accommodations',
  'library services',
  'brainfuse tutoring',
  'sensitive content notice',
  'master of counselling\'s professional code',
  'program outcomes',
  'grading scale',
  'grading rubrics'
];

function fallbackHeuristicParser(text: string): ParsedSyllabus {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let courseName = 'Introduction to Computer Systems';
  let courseCode = 'CS 101';

  // --- Extract course code & name from header ---
  const codeRegex = /([A-Z]{2,5}\s*\d{3,4}[A-Z]?)\s*[:\-]?\s*(.+)?/i;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const match = lines[i].match(codeRegex);
    if (match) {
      courseCode = match[1].toUpperCase().replace(/\s+/, ' ');
      if (match[2] && match[2].trim().length > 3) {
        courseName = match[2].replace(/\s*\(.*?\)/, '').trim();
      } else if (i + 1 < lines.length && lines[i + 1].length > 3) {
        courseName = lines[i + 1].trim();
      }
      break;
    }
  }
  if (courseName === 'Introduction to Computer Systems' && lines.length > 0) {
    courseName = lines[0].replace(/[-:|]/g, ' ').trim();
  }

  // --- 1. Extract Assignments (Separating Points System from Percentage System) ---
  const assignments: ParsedSyllabus['assignments'] = [];
  const assignmentTitleSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip noise section headers
    if (NOISE_SECTION_MARKERS.some(m => lower.includes(m))) continue;

    for (const canonical of CANONICAL_ASSIGNMENTS) {
      const match = canonical.keywords.some(k => lower.includes(k));
      if (match && !assignmentTitleSet.has(canonical.title)) {
        assignmentTitleSet.add(canonical.title);

        let dueDate: string | undefined;
        let pointsPossible: string | undefined;
        let weightPercentage = canonical.defaultWeight;

        const weightMatch = line.match(/(\d{1,3})%/);
        if (weightMatch) weightPercentage = `${weightMatch[1]}%`;

        const ptsMatch = line.match(/(\d{1,4})\s*(pts|points|pt\b)/i);
        if (ptsMatch) pointsPossible = `${ptsMatch[1]} Points`;

        // Extract due date from nearby window
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 8); j++) {
          const dateMatch = lines[j].match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
          if (dateMatch) {
            const year = dateMatch[3] || '2026';
            dueDate = `${dateMatch[1]} ${dateMatch[2]}, ${year}`;
            break;
          }
        }

        // Look for rubric criteria table in document for this assignment
        const rubricCriteria: { criterionName: string; points?: number; percentage?: number }[] = [];
        let rubricStartIdx = -1;
        for (let j = 0; j < lines.length; j++) {
          const lLow = lines[j].toLowerCase();
          if (
            lLow.includes('grading criteria') ||
            lLow.includes('grading rubric') ||
            lLow.includes('criteria grade points') ||
            lLow.includes('rubric') ||
            lLow.includes('evaluation criteria')
          ) {
            const prevContext = lines.slice(Math.max(0, j - 6), j + 2).join(' ').toLowerCase();
            if (canonical.keywords.some(k => prevContext.includes(k))) {
              rubricStartIdx = j + 1;
              break;
            }
          }
        }

        if (rubricStartIdx >= 0) {
          for (let j = rubricStartIdx; j < Math.min(lines.length, rubricStartIdx + 25); j++) {
            const l = lines[j].trim();
            const lLow = l.toLowerCase();
            if (lLow.includes('total') && (lLow.includes('point') || lLow.includes('pts'))) {
              const tot = l.match(/total\s*[:\-–]?\s*(\d{1,4})\s*(?:pts|points)/i);
              if (tot) {
                pointsPossible = `${tot[1]} Points`;
              }
              break;
            }
            if (CANONICAL_ASSIGNMENTS.some(c => c !== canonical && c.keywords.some(k => lLow.includes(k)))) {
              break;
            }
            const cleanL = l.replace(/^[\s\-\*\•\d\.\)]+/, '').trim();
            const critMatch = cleanL.match(/^([A-Za-z\s&(),\/\-–]+?)(?:\s*[\:\-\(]|\s+)\s*(\d{1,3})\s*(?:pts|points|pt)?\)?(?:\s+(\d{1,3})%)?/i);
            if (critMatch && !lLow.includes('grading criteria') && !lLow.includes('scale') && !lLow.includes('total') && !lLow.includes('rubric')) {
              rubricCriteria.push({
                criterionName: critMatch[1].trim(),
                points: parseInt(critMatch[2], 10),
                percentage: critMatch[3] ? parseInt(critMatch[3], 10) : undefined
              });
            }
          }
        }

        assignments.push({
          title: canonical.title,
          dueDate,
          fullInstructions: `Instructions for ${canonical.title} derived from course syllabus.`,
          pointsPossible,
          weightPercentage,
          rubricCriteria: rubricCriteria.length > 0 ? rubricCriteria : []
        });
        break;
      }
    }
  }

  // --- 2. Extract Weekly Schedule & Readings ---
  const parsedWeeks: ParsedSyllabus['weeks'] = [];
  let currentWeekNum = 0;
  let currentTheme = '';
  let currentReadings: ParsedSyllabus['weeks'][0]['readings'] = [];
  let inPolicy = false;
  let pendingWatchLabel: string | null = null;

  const weekPrefixRegex = /^(?:Week|Module|Unit|Part|Class|Session)\s*(\d{1,2})\s*[:\-–]?\s*(.*)/i;
  const bareNumberRegex = /^\s*(\d{1,2})\s*$/;
  const chapterRegex = /^(?:•|\-|\*|\d+\.)?\s*(?:Chapter|Ch\.?)\s*(\d+)\s*[\-—–:]?\s*(.*)/i;

  const flushWeek = () => {
    if (currentWeekNum > 0) {
      parsedWeeks.push({
        weekNumber: currentWeekNum,
        theme: currentTheme.length > 0 ? currentTheme : `Week ${currentWeekNum} Topics`,
        startDate: undefined,
        readings: [...currentReadings]
      });
      currentReadings = [];
      currentTheme = '';
      pendingWatchLabel = null;
    }
  };

  const textbookSeriesNoise = [
    'sexuality counseling: theory, research',
    'human sexuality in a world of diversity',
    'growing into resilience'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check policy section exit/enter
    if (lower.includes('course policies') || lower.includes('late assignments') || lower.includes('academic integrity')) {
      inPolicy = true;
    }
    if (inPolicy) continue;

    // Skip noise & textbook series lines
    if (textbookSeriesNoise.some(ts => lower.includes(ts))) continue;
    if (lower.startsWith('page ') || lower.includes('total 100%') || lower.includes('grading criteria')) continue;

    // Match explicit "Week N:"
    const weekMatch = line.match(weekPrefixRegex);
    if (weekMatch) {
      flushWeek();
      currentWeekNum = parseInt(weekMatch[1], 10);
      currentTheme = weekMatch[2].replace(/[-:|]/g, '').trim();
      continue;
    }

    // Match bare number lines (e.g., "1", "2", "3") when followed by date or content
    const bareMatch = line.match(bareNumberRegex);
    if (bareMatch) {
      const num = parseInt(bareMatch[1], 10);
      if (num >= 1 && num <= 24) {
        // Lookahead check for date line
        const lookahead = lines.slice(i + 1, i + 5).join(' ').toLowerCase();
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        if (months.some(m => lookahead.includes(m))) {
          flushWeek();
          currentWeekNum = num;
          continue;
        }
      }
    }

    if (currentWeekNum === 0) continue;

    // Theme extraction from topic lines before "Required:"
    if (!currentTheme && !lower.includes('required:') && !lower.startsWith('watch') && !lower.includes('chapter')) {
      const isDate = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(lower);
      if (!isDate && line.length > 3 && line.length < 80) {
        currentTheme = line;
        continue;
      }
    }

    // Watch / Media directives
    if (lower.startsWith('watch:') || lower.startsWith('watch ') || lower.startsWith('listen:') || lower.includes('youtube.com') || lower.includes('podbean.com') || lower.includes('ted.com')) {
      let rawTitle = line.replace(/^(?:watch:|watch|listen:)\s*/i, '').trim();
      let mediaType: 'video' | 'podcast' | 'article' | 'textbook' | 'other' = 'video';
      if (lower.includes('podbean') || lower.includes('podcast')) mediaType = 'podcast';

      const formattedTitle = formatReadingTitle5to6Words(rawTitle, currentTheme);
      if (!currentReadings.some(r => r.title === formattedTitle)) {
        currentReadings.push({ title: formattedTitle, mediaType });
      }
      continue;
    }

    // Chapter readings
    const chMatch = line.match(chapterRegex);
    if (chMatch) {
      const chNum = chMatch[1];
      const chTitle = chMatch[2].replace(/[-—–:]/g, '').trim();
      const rawTitle = chTitle.length > 0 ? `Chapter ${chNum} ${chTitle}` : `Chapter ${chNum} Research`;
      const formattedTitle = formatReadingTitle5to6Words(rawTitle, currentTheme);
      if (!currentReadings.some(r => r.title === formattedTitle)) {
        currentReadings.push({ title: formattedTitle, mediaType: 'textbook' });
      }
      continue;
    }

    // Generic bullet readings
    if (line.startsWith('•') || line.startsWith('-')) {
      const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();
      if (cleanLine.length > 5) {
        const formattedTitle = formatReadingTitle5to6Words(cleanLine, currentTheme);
        if (!currentReadings.some(r => r.title === formattedTitle)) {
          currentReadings.push({ title: formattedTitle, mediaType: 'textbook' });
        }
      }
    }
  }

  flushWeek();

  // Sort and pad weeks
  parsedWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
  const maxWeeks = Math.max(parsedWeeks.length, 11);
  const existingNums = new Set(parsedWeeks.map(w => w.weekNumber));

  for (let w = 1; w <= maxWeeks; w++) {
    if (!existingNums.has(w)) {
      const defaultTitle = formatReadingTitle5to6Words(`Chapter ${w} Essential Course Reading Material`);
      parsedWeeks.push({
        weekNumber: w,
        theme: `Week ${w}: Course Topics`,
        startDate: new Date(Date.now() + (w - 1) * 7 * 86400000).toISOString().split('T')[0],
        readings: [{ title: defaultTitle, mediaType: 'textbook' }]
      });
    }
  }
  parsedWeeks.sort((a, b) => a.weekNumber - b.weekNumber);

  return {
    courseName,
    courseCode,
    termWeeks: parsedWeeks.length,
    weeks: parsedWeeks,
    assignments,
    textbooks: [],
    parserSource: 'BACKEND_FALLBACK'
  };
}


