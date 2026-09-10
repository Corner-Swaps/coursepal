import { CourseSharingService } from '../src/services/CourseSharingService';
import { CourseDTO } from '../src/types/models';

describe('CourseSharingService URL Codecs', () => {
  const service = CourseSharingService.shared;

  const mockCourse: CourseDTO = {
    id: 'course-test123',
    creatorId: 'local-user',
    courseName: 'Cognitive Psychology',
    courseCode: 'PSYC 301',
    instructorName: 'Dr. Jane Doe',
    instructorEmail: 'jdoe@university.edu',
    termWeeks: 12,
    sharingCode: '849201',
    weeks: [
      {
        id: 'week-1',
        weekNumber: 1,
        theme: 'Introduction to Perception',
        readings: [
          {
            id: 'read-1',
            title: 'Foundations of Cognition',
            authorName: 'Goldstein',
            mediaType: 'textbook',
            isCompleted: false,
            summaryText: 'Basic principles of cognitive neuroscience.',
            keyTakeawaysText: 'Neural pathways and sensory memory.',
            estimatedTimeText: '~45 min'
          }
        ]
      }
    ],
    assignments: [
      {
        id: 'assign-1',
        title: 'Perceptual Illusion Lab Report',
        dueDate: '2026-10-15',
        fullInstructions: 'Analyze visual illusions and submit a 5-page report.',
        pointsPossible: '100 Points',
        weightPercentage: '25%'
      }
    ]
  };

  it('encodes course into URL-safe base64url string without +, /, or =', () => {
    const payload = service.encodeCourseToPayload(mockCourse);
    expect(payload).toBeTruthy();
    expect(payload).not.toContain('+');
    expect(payload).not.toContain('/');
    expect(payload).not.toContain('=');
  });

  it('round-trips encode and decode maintaining 100% course data fidelity', () => {
    const payload = service.encodeCourseToPayload(mockCourse);
    const decoded = service.decodeCourse(payload);

    expect(decoded).not.toBeNull();
    expect(decoded?.courseName).toBe(mockCourse.courseName);
    expect(decoded?.courseCode).toBe(mockCourse.courseCode);
    expect(decoded?.instructorName).toBe(mockCourse.instructorName);
    expect(decoded?.sharingCode).toBe(mockCourse.sharingCode);
    expect(decoded?.weeks).toHaveLength(1);
    expect(decoded?.weeks?.[0].readings).toHaveLength(1);
    expect(decoded?.weeks?.[0].readings?.[0].title).toBe('Foundations of Cognition');
    expect(decoded?.assignments).toHaveLength(1);
    expect(decoded?.assignments?.[0].dueDate).toBe('2026-10-15');
    expect(decoded?.assignments?.[0].weightPercentage).toBe('25%');
  });

  it('decodes directly from full join URL containing data= query parameter', () => {
    const link = service.generateShareLink(mockCourse);
    expect(link).toContain('https://classpal.app/join?code=849201&data=');

    const decoded = service.decodeCourse(link);
    expect(decoded).not.toBeNull();
    expect(decoded?.courseName).toBe('Cognitive Psychology');
  });

  it('decodes directly from raw JSON string fallback', () => {
    const jsonStr = JSON.stringify(mockCourse);
    const decoded = service.decodeCourse(jsonStr);
    expect(decoded).not.toBeNull();
    expect(decoded?.courseCode).toBe('PSYC 301');
  });

  it('generates a formatted share message with course stats', () => {
    const msg = service.generateShareMessage(mockCourse);
    expect(msg).toContain("Join 'Cognitive Psychology' on CoursePal!");
    expect(msg).toContain('Course Code: 849201');
    expect(msg).toContain('1 Readings');
    expect(msg).toContain('1 Assignments');
    expect(msg).toContain('https://classpal.app/join');
  });

  it('returns null for empty or corrupted input', () => {
    expect(service.decodeCourse('')).toBeNull();
    expect(service.decodeCourse('corrupted_gibberish_string_not_valid_json_or_zlib')).toBeNull();
  });
});
