import fs from 'fs';
import path from 'path';

describe('Course Name Section & Dropdown Review Notice Guarantees', () => {
  const syllabusScreenPath = path.join(__dirname, '../src/screens/SyllabusScreen.tsx');
  let syllabusContent = '';

  beforeAll(() => {
    syllabusContent = fs.readFileSync(syllabusScreenPath, 'utf8');
  });

  it('guarantees Course Name section exists directly above Course & Faculty Details', () => {
    expect(syllabusContent).toContain('<Text style={styles.sectionTitle}>Course Name</Text>');
    expect(syllabusContent).toContain('<Text style={styles.sectionTitle}>Course & Faculty Details</Text>');

    const courseNameIndex = syllabusContent.indexOf('<Text style={styles.sectionTitle}>Course Name</Text>');
    const facultyDetailsIndex = syllabusContent.indexOf('<Text style={styles.sectionTitle}>Course & Faculty Details</Text>');

    expect(courseNameIndex).toBeGreaterThan(-1);
    expect(facultyDetailsIndex).toBeGreaterThan(-1);
    expect(courseNameIndex).toBeLessThan(facultyDetailsIndex);
  });

  it('ensures tapping Course Name card triggers setEditingCourse to allow editing', () => {
    const courseNameBlock = syllabusContent.substring(
      syllabusContent.indexOf('<Text style={styles.sectionTitle}>Course Name</Text>'),
      syllabusContent.indexOf('<Text style={styles.sectionTitle}>Course & Faculty Details</Text>')
    );

    expect(courseNameBlock).toContain('onPress={() => setEditingCourse(course)}');
    expect(courseNameBlock).toContain('{course.courseName}');
    expect(courseNameBlock).toContain('testID={`course-name-card-${course.id}`}');
  });

  it('strictly verifies Review Your Coursework notice is NOT in the course dropdown', () => {
    // In SyllabusScreen, find the expandedContent block
    const expandedStart = syllabusContent.indexOf('{isExpanded && (');
    const expandedEnd = syllabusContent.indexOf('{/* Assignments Section */}');
    expect(expandedStart).toBeGreaterThan(-1);
    expect(expandedEnd).toBeGreaterThan(-1);

    const dropdownContent = syllabusContent.substring(expandedStart, expandedEnd);

    // Make sure accuracy notice banner is NOT in the dropdown
    expect(dropdownContent).not.toContain('courseAccuracyNoticeBanner');
    expect(dropdownContent).not.toContain('accuracy-notice-course-');
    expect(dropdownContent).not.toContain('Review Your Coursework');
  });

  it('ensures top-level accuracy notice banner is preserved outside of any dropdown', () => {
    expect(syllabusContent).toContain('testID="accuracy-notice-banner-top"');
    expect(syllabusContent).toContain('Review Your Coursework');
    expect(syllabusContent).toContain('acceptAccuracyNotice');
  });
});
