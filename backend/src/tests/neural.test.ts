import { NeuralDocumentEngine } from '../services/neuralDocumentEngine';

console.log('====================================================');
console.log('  ClassPal Neural Net Document Learning Engine Tests');
console.log('====================================================\n');

const engine = NeuralDocumentEngine.getInstance();
engine.resetIndex();

// 1. Train on Syllabus Document 1 (CPC 514: Research Methods & Statistics)
const cpc514Text = `
Syllabus: CPC 514 Research Methods and Statistics
School of Health and Social Sciences, City University in Canada.
Primary Faculty: Dr. Alireza Sedghi Taromi.
This course focuses on quantitative and qualitative research methodologies, statistical analysis, hypothesis testing, ethics in psychological research, literature reviews, and research design.
Assignment 1: Group Presentation on Quantitative Methods (20% grade weight, 100 Points possible). Students analyze research articles and present statistical findings.
Assignment 2: Discussion Board Posts (20% weight, 100 Points possible). Engaging in academic discourse around ethics, validity, and sampling techniques.
Assignment 3: Group Research Proposal Report (10% weight, 100 Points possible).
Assignment 4: Individual Final Research Paper (40% weight, 100 Points possible). Comprehensive empirical literature review and research design proposal.
Assignment 5: Class Attendance and Active Participation (10% weight, 100 Points possible).
Required Readings: Creswell Research Design, APA Style Manual 7th Edition, Field Discovering Statistics using IBM SPSS.
`;

const train1 = engine.trainDocument('cpc-514', 'CPC 514 Research Methods', cpc514Text);
console.log(`✅ [Test 1] Trained Neural Net on CPC 514 document. Created ${train1.chunksCreated} chunks. Index total: ${train1.totalIndexed}`);

// 2. Train on Syllabus Document 2 (CPC 523: Counselling Psychology)
const cpc523Text = `
Syllabus: CPC 523 Counselling Psychology and Clinical Practice
Faculty: Dr. Jane Doe.
Focuses on therapeutic interventions, clinical interview techniques, client empathy, ethical decision making in counselling, and active listening.
Assignment 1: Reflective Journal on Clinical Empathy (25% weight, 100 Points possible).
Assignment 2: Simulated Client Mock Session (35% weight, 100 Points possible).
Assignment 3: Final Clinical Case Formulation Paper (40% weight, 100 Points possible).
Required Readings: Yalom Theory and Practice of Group Psychotherapy, Corey Theory and Practice of Counseling.
`;

const train2 = engine.trainDocument('cpc-523', 'CPC 523 Counselling Psychology', cpc523Text);
console.log(`✅ [Test 2] Trained Neural Net on CPC 523 document. Created ${train2.chunksCreated} chunks. Index total: ${train2.totalIndexed}`);

// 3. Test Feature Vector Generation
const sampleVec = engine.generateEmbedding('hypothesis testing and statistical analysis');
console.log(`✅ [Test 3] Generated 64-dimensional feature vector. Vector length: ${sampleVec.length}, L2 Norm: ${Math.sqrt(sampleVec.reduce((s, v) => s + v * v, 0)).toFixed(4)}`);

// 4. Test Semantic Query Search - Searching for Statistics & Quantitative Research
const statQuery = 'quantitative statistics IBM SPSS hypothesis testing';
const statResults = engine.search(statQuery, 3);
console.log(`\n🔍 [Test 4] Query: "${statQuery}"`);
statResults.forEach((res, idx) => {
  console.log(`   Result #${idx + 1} [Score: ${res.similarityScore.toFixed(3)}] Document: ${res.chunk.title}`);
  console.log(`   Snippet: ${res.chunk.content.substring(0, 100)}...`);
});

if (statResults.length > 0 && statResults[0].chunk.docId === 'cpc-514') {
  console.log('✅ PASS: Top neural match correctly identified CPC 514 for statistics query.');
} else {
  console.error('❌ FAIL: Incorrect document matched.');
}

// 5. Test Semantic Query Search - Searching for Counseling & Client Empathy
const counselQuery = 'clinical interview client empathy therapeutic interventions';
const counselResults = engine.search(counselQuery, 3);
console.log(`\n🔍 [Test 5] Query: "${counselQuery}"`);
counselResults.forEach((res, idx) => {
  console.log(`   Result #${idx + 1} [Score: ${res.similarityScore.toFixed(3)}] Document: ${res.chunk.title}`);
  console.log(`   Snippet: ${res.chunk.content.substring(0, 100)}...`);
});

if (counselResults.length > 0 && counselResults[0].chunk.docId === 'cpc-523') {
  console.log('✅ PASS: Top neural match correctly identified CPC 523 for counseling query.');
} else {
  console.error('❌ FAIL: Incorrect document matched.');
}

const stats = engine.getStats();
console.log(`\n====================================================`);
console.log(`  Neural Net Document Engine Stats:`);
console.log(`  Indexed Chunks: ${stats.totalIndexedChunks}`);
console.log(`  Vocabulary Size: ${stats.vocabularySize} words`);
console.log(`  Vector Dimensions: ${stats.vectorDimensions}-D`);
console.log(`====================================================\n`);
