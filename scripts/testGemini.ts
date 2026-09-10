import { APIService } from '../src/services/APIService';

async function main() {
  console.log('==================================================');
  console.log('🤖 CoursePal TypeScript ↔ Gemini API Test');
  console.log('==================================================\n');

  console.log('1. Checking Bundled API Key...');
  const key = APIService.bundledAPIKey;
  if (!key) {
    console.error('❌ Error: No API key found in APIService!');
    process.exit(1);
  }
  console.log(`✅ Key found: ${key.substring(0, 8)}...${key.substring(key.length - 4)}`);

  console.log('\n2. Testing Connectivity with Gemini 3.6 Flash...');
  const startTime = Date.now();
  try {
    const prompt = 'Introduce yourself in one sentence and confirm you are connected to CoursePal TypeScript.';
    const response = await APIService.shared.generateContentWithGemini(prompt);
    const elapsedMs = Date.now() - startTime;

    console.log(`✅ Response received in ${elapsedMs}ms:\n`);
    console.log(`   "${response.trim()}"`);
  } catch (error: any) {
    console.error('❌ Connectivity test failed:', error.message);
    process.exit(1);
  }

  console.log('\n3. Testing Structured Syllabus Extraction...');
  const syllabusSnippet = `
Course: Introduction to Machine Learning (CS 229)
Professor: Dr. Andrew Ng
Week 1: Supervised Learning, Linear Regression. Reading: Ch 1-2.
Week 2: Classification, Logistic Regression. Reading: Ch 3.
Assignment 1: Gradient Descent Implementation (Due Oct 12, 100 pts)
`;

  try {
    const extractPrompt = `
Extract the following syllabus snippet into valid JSON with this exact schema:
{
  "courseName": string,
  "courseCode": string,
  "instructor": string,
  "assignments": [{"title": string, "dueDate": string, "points": string}]
}
Only return the raw JSON, no markdown formatting.

Syllabus:
${syllabusSnippet}
`;
    const jsonResponse = await APIService.shared.generateContentWithGemini(extractPrompt);
    const cleaned = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    console.log('✅ Structured JSON parsed successfully:');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (error: any) {
    console.error('❌ Structured extraction test failed:', error.message);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('🎉 ALL TESTS PASSED! TypeScript API is 100% operational.');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
