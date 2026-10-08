import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';

describe('Repeated Weekly Readings (Skipped-Weeks Bug)', () => {
  const cpc512Text = `
CityUniversity | CityU.edu of Seattle
School of Health & Social Sciences
CPC 512: Family Systems Approaches to Counselling

course Schedule – *No ClassEs DURING Reading Week (August 6-7)
Please note that this schedule can change based on the discretion of faculty and/or student learning.

Course Session/Date\tTopics, Modules, and Assignments\tReadings
Week 1 July 2/3\tCreating a caring community
Introduction to Family Systems
Course overview\tGehart chapters 1-3

Week 2 July 9/10\tIntroduction to Systems Thinking
Introduction to Mapping Tools\tGehart chapter 5
Articles

Week 3 July 16/17\tFrom Theory to Practice
Structural Family Systems\tGehart chapters 5 & 7

Week 4 July 23/24\tEvidence Based Practice and Empirically Supported Models (TBD)\tGehart chapter 7

Week 5 July 30/31\tEvidenced-Based Practice and Empirically Supported Models
(group presentations)\tGehart chapters 4-10
Due: Family Mapping Papers

Week 6 August 6/7\tREADING WEEK\tNo classes

Week 7 August 13/14\tEvidence Based Practice and Empirically Supported Models
(group presentations)\tGehart chapters 4-10

Week 8 August 20/21\tEvidence Based Practice and Empirically Supported Models
(group presentations)\tGehart Chapters 4-10

Week 9 August 27/28\tCase Conceptualization\tGehart Chapter 11

Week 10 September 3/4\tCase Conceptualization
*Students will complete an in-class case conceptualization worth 20% of their final mark\tGehart chapter 11
• Review sample comprehensive exam cases in Van General Course Shell

Week 11 September 10/11\t• Feedback Case Conceptualizations
• Addressing Clinical Issues
• Counselling Practice\tGehart chapters 8

Week 12 September 17/18\tFlex Week\t

The following modules and topics will be integrated throughout the duration of our learning experience together:

Modules\tTopics\tRelated Readings
Module 1\tSystems Theory and the History of Family Therapy\tGehart (Chapters 1-3)
Module 2\tFamily of Origin/ Genograms\tGehart (Chapter 2)
Module 3\tDiverse Populations and Family Therapy Case Conceptualization and Application\tGehart (Chapters 11-15)
Module 4\tBowen Family Systems\tGehart (Chapter 7)
Module 5\tStructural Family Therapy\tGehart (Chapter 5)
Module 6\tStrategic Family Therapy\tGehart (Chapter 4)
Module 7\tExperiential Family Therapy\tGehart (Chapter 6)
Module 8\tPsychoanalytic Family Therapy\tGehart (Chapter 7)
Module 9\tCognitive Behavioural Family Therapy
Clinical issues in Family Counselling\tGehart (Chapter 8)
Module 10\tSocial Constructionist Family Therapy
Future Research and Critiques\tGehart (Chapter 10)

*NICHOLS & DAVIS READINGS = RELATED BUT NOT REQUIRED*
`;

  it('preserves repeated weekly readings across distinct calendar weeks (weeks 7, 8, 10)', () => {
    const parser = LocalSyllabusParser.shared;
    const importManager = SyllabusImportManager.shared;

    const dto = parser.parseText(cpc512Text);
    const norm = importManager.normalizeAndValidateSyllabusPayload(dto, cpc512Text);
    const cleanReadings = importManager.deduplicateReadings(norm.candidateReadings, norm.textbooks, norm.termYear);

    const weekNumbers = cleanReadings.map(r => r.weekNumber);
    console.log('Clean readings count:', cleanReadings.length);
    console.log('Clean readings weeks:', weekNumbers);

    // Week 7: Gehart chapters 4-10
    const w7Readings = cleanReadings.filter(r => r.weekNumber === 7);
    expect(w7Readings.length).toBeGreaterThan(0);
    expect(w7Readings.some(r => /4\s*[-–—]\s*10/i.test(r.chapterText || r.title))).toBe(true);

    // Week 8: Gehart chapters 4-10
    const w8Readings = cleanReadings.filter(r => r.weekNumber === 8);
    expect(w8Readings.length).toBeGreaterThan(0);
    expect(w8Readings.some(r => /4\s*[-–—]\s*10/i.test(r.chapterText || r.title))).toBe(true);

    // Week 10: Gehart chapter 11
    const w10Readings = cleanReadings.filter(r => r.weekNumber === 10);
    expect(w10Readings.length).toBeGreaterThan(0);
    expect(w10Readings.some(r => /11/i.test(r.chapterText || r.title))).toBe(true);
  });
});
