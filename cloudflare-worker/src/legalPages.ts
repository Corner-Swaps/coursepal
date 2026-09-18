/**
 * CoursePal Official Legal & Privacy Web Pages
 * Compliant with Apple App Store Guideline 5.1, Canadian PIPEDA, CASL, and Canadian Copyright Act.
 */

const BASE_CSS = `
  :root {
    --bg: #F8FAFC;
    --card-bg: #FFFFFF;
    --text: #0F172A;
    --text-muted: #64748B;
    --primary: #2470F5;
    --border: #E2E8F0;
    --accent: #10B981;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0B0F19;
      --card-bg: #131B2E;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --primary: #3B82F6;
      --border: #1E293B;
      --accent: #10B981;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
    background-color: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 24px 16px 64px;
  }
  .container {
    max-width: 780px;
    margin: 0 auto;
  }
  header {
    text-align: center;
    margin-bottom: 32px;
    padding: 24px 0 16px;
  }
  .brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(36, 112, 245, 0.1);
    color: var(--primary);
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  h1 {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .subtitle {
    color: var(--text-muted);
    font-size: 14px;
  }
  .nav-links {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin: 18px 0;
    font-size: 14px;
  }
  .nav-links a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
  }
  .nav-links a:hover {
    text-decoration: underline;
  }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .card h2 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 12px;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card p, .card li {
    font-size: 15px;
    color: var(--text);
    margin-bottom: 10px;
  }
  .card ul {
    padding-left: 20px;
    margin-bottom: 10px;
  }
  .card li {
    margin-bottom: 6px;
  }
  .highlight-box {
    background: rgba(16, 185, 129, 0.08);
    border-left: 4px solid var(--accent);
    padding: 14px 16px;
    border-radius: 8px;
    margin: 14px 0;
    font-size: 14px;
  }
  .warning-box {
    background: rgba(234, 88, 12, 0.08);
    border-left: 4px solid #EA580C;
    padding: 14px 16px;
    border-radius: 8px;
    margin: 14px 0;
    font-size: 14px;
  }
  footer {
    text-align: center;
    margin-top: 40px;
    font-size: 13px;
    color: var(--text-muted);
  }
`;

export function renderPrivacyPolicyHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy | CoursePal</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-badge">🛡️ CoursePal Privacy & Data Governance</div>
      <h1>Privacy Policy</h1>
      <p class="subtitle">Effective Date: September 2026 • Jurisdiction: Canada & Global</p>
      <div class="nav-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </div>
    </header>

    <div class="card">
      <h2>1. Overview & Canadian Privacy Commitment</h2>
      <p>CoursePal ("we", "our", or "the App") is developed in <strong>Canada</strong>. We are committed to protecting student and user privacy in full accordance with Canada's <em>Personal Information Protection and Electronic Documents Act</em> (<strong>PIPEDA</strong>), provincial privacy legislation (such as British Columbia's <em>Personal Information Protection Act</em> - <strong>PIPA</strong>), the European Union General Data Protection Regulation (<strong>GDPR</strong>), and the California Consumer Privacy Act (<strong>CCPA</strong>).</p>
      <div class="highlight-box">
        <strong>The Local-First Rule:</strong> CoursePal does not require account creation, passwords, student IDs, or credit cards. Your personal courses, notes, and schedules live directly on your iPhone inside Apple's hardware-encrypted application sandbox.
      </div>
    </div>

    <div class="card">
      <h2>2. Information We Do NOT Collect</h2>
      <ul>
        <li><strong>No Account Sign-Ups:</strong> You do not register an account or provide your name, phone number, or student ID to use the App.</li>
        <li><strong>No Location Tracking:</strong> CoursePal does not access GPS or physical location.</li>
        <li><strong>No Behavioral or Advertising Tracking:</strong> CoursePal contains zero advertising SDKs, cross-app tracking beacons, or commercial data broker trackers.</li>
        <li><strong>No Third-Party Cookies or Session Replay:</strong> We do not use session recording or wiretapping software (such as LogRocket or Hotjar).</li>
        <li><strong>No Selling of Personal Data:</strong> We never sell, monetize, rent, or trade student data under any circumstances.</li>
      </ul>
    </div>

    <div class="card">
      <h2>3. Document Parsing & Multimodal AI Processing</h2>
      <p>When you use CoursePal's automated syllabus upload feature:</p>
      <ul>
        <li><strong>Transient Processing:</strong> Syllabus documents or page images are transmitted via encrypted HTTPS (TLS 1.3) solely for real-time extraction of course schedules, chapter readings, and assignment dates.</li>
        <li><strong>Zero Model Training:</strong> Your uploaded syllabi and course materials are <strong>NEVER used to train public or foundation AI models</strong>.</li>
        <li><strong>No Cloud Retention:</strong> Extracted data is sent directly back to your device and is not retained in a persistent public database.</li>
        <li><strong>Offline Freedom:</strong> Document parsing is completely optional. You can create, organize, and manage all courses and assignments 100% offline without connecting to any AI service.</li>
      </ul>
    </div>

    <div class="card">
      <h2>4. Age Requirement & Children's Privacy (COPPA & Canadian Standards)</h2>
      <p>CoursePal is designed exclusively for secondary (high school) and post-secondary (college and university) students. CoursePal is not directed to children under 13 years of age.</p>
      <p>In compliance with the U.S. <em>Children's Online Privacy Protection Act</em> (<strong>COPPA</strong>) and Canadian privacy principles, we do not knowingly collect personal information from individuals under the age of 13. If you are under the age of majority in your province or state (e.g., under 19 in British Columbia, or under 18 in other jurisdictions), you may only use CoursePal with the consent of a parent or legal guardian.</p>
    </div>

    <div class="card">
      <h2>5. Data Sovereignty & Right to Erasure</h2>
      <p>Because your data resides on your physical device, you retain absolute data sovereignty at all times:</p>
      <ul>
        <li>You may edit, export, or delete any course, reading, or assignment with a single tap.</li>
        <li>Deleting a course immediately removes all corresponding files and caches from your device.</li>
        <li>Uninstalling CoursePal permanently erases 100% of your stored data from your device.</li>
      </ul>
    </div>

    <div class="card">
      <h2>6. Privacy Inquiries & Contact</h2>
      <p>If you have questions about this Privacy Policy, your privacy rights under PIPEDA, or data governance, please contact our privacy representative:</p>
      <p><strong>CoursePal Legal & Privacy Officer</strong><br>
      Email: <a href="mailto:privacy@coursepal.app" style="color:var(--primary);">privacy@coursepal.app</a><br>
      Location: Vancouver, British Columbia, Canada</p>
    </div>

    <footer>
      <p>&copy; 2026 CoursePal. All rights reserved. Made in Canada 🇨🇦</p>
    </footer>
  </div>
</body>
</html>`;
}

export function renderTermsOfServiceHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Terms of Service | CoursePal</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-badge">⚖️ CoursePal Terms & Academic Disclaimers</div>
      <h1>Terms of Service</h1>
      <p class="subtitle">Effective Date: September 2026 • Governing Law: British Columbia, Canada</p>
      <div class="nav-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </div>
    </header>

    <div class="card">
      <h2>1. Acceptance of Terms & Eligibility</h2>
      <p>By downloading, installing, or using CoursePal ("the App"), you agree to be legally bound by these Terms of Service. If you do not agree, do not use the App.</p>
      <p><strong>Age & Eligibility:</strong> You must be at least 13 years of age to use CoursePal. If you are between 13 and the age of majority in your jurisdiction of residence (e.g., 19 in British Columbia, 18 in Ontario, Alberta, and most U.S. states), you represent that you have reviewed these Terms with your parent or legal guardian and have obtained their consent.</p>
    </div>

    <div class="card">
      <h2>2. Auxiliary Academic Aid & Duty to Verify</h2>
      <div class="warning-box">
        <strong>CRITICAL ACADEMIC NOTICE:</strong> CoursePal is an auxiliary personal study planner. Your professor's official syllabus document and your institution's official Learning Management System (Canvas, Blackboard, Brightspace, Moodle, D2L) remain the <strong>sole, final, and authoritative sources of truth</strong> for all course requirements, class meetings, and assignment due dates.
      </div>
      <p>You acknowledge and agree that:</p>
      <ul>
        <li>You are solely and unconditionally responsible for confirming all dates, assignment rubrics, textbook editions, and grading criteria against your university's official LMS and instructor announcements.</li>
        <li>Optical Character Recognition (OCR) and Artificial Intelligence (AI) parsing may occasionally misread, misinterpret, omit, or misalign dates, times, or instructions due to complex document formatting or document scan quality.</li>
      </ul>
    </div>

    <div class="card">
      <h2>3. Complete Limitation of Liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE CANADIAN AND INTERNATIONAL LAWS:</p>
      <ul>
        <li>CoursePal and its creators, developers, operators, and affiliates shall not be liable for any direct, indirect, incidental, consequential, special, punitive, or academic damages.</li>
        <li>This includes, without limitation: missed assignment deadlines, late submission penalties, missed quizzes or examinations, grade reductions, academic probation, loss of financial aid, suspension, or expulsion.</li>
        <li>Your sole and exclusive remedy for any issue or dissatisfaction with CoursePal is to stop using and uninstall the application.</li>
      </ul>
    </div>

    <div class="card">
      <h2>4. Intellectual Property, Fair Dealing & DMCA</h2>
      <p><strong>Educational Fair Dealing & Fair Use:</strong> CoursePal is intended strictly for personal, non-commercial educational time-management. Uploading and organizing your course materials for private study constitutes protected <em>Fair Dealing for Education and Private Study</em> under Section 29 of the <strong>Copyright Act of Canada</strong> (R.S.C., 1985, c. C-42) and <em>Fair Use</em> under 17 U.S.C. § 107 in the United States.</p>
      <p>All syllabi, course outlines, and textbook materials remain the intellectual property of their respective creators and educational institutions. CoursePal does not operate a public document marketplace or publicly redistribute course files.</p>
      <p><strong>Copyright Agent / Notice-and-Notice:</strong> For copyright inquiries or notices pursuant to Canada's Notice-and-Notice regime or the U.S. Digital Millennium Copyright Act (DMCA), contact: <a href="mailto:legal@coursepal.app" style="color:var(--primary);">legal@coursepal.app</a>.</p>
    </div>

    <div class="card">
      <h2>5. Academic Integrity & Honor Codes</h2>
      <p>CoursePal is designed to foster organization, focus, and academic discipline. You agree to use CoursePal in strict compliance with your school's student code of conduct and academic integrity policies. CoursePal does not generate student work, write essays, or facilitate academic dishonesty.</p>
    </div>

    <div class="card">
      <h2>6. Non-Affiliation Statement</h2>
      <p>CoursePal is an independent application and is not endorsed by, sponsored by, or officially affiliated with any university, college, school board, or third-party LMS provider (including Canvas, Blackboard, Instructure, or D2L Brightspace).</p>
    </div>

    <div class="card">
      <h2>7. Governing Law & Dispute Resolution</h2>
      <p>These Terms are governed by, and construed in accordance with, the laws of the <strong>Province of British Columbia</strong> and the <strong>federal laws of Canada</strong> applicable therein, without giving effect to any principles of conflicts of law. Any dispute arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the courts located in British Columbia, Canada.</p>
    </div>

    <div class="card">
      <h2>8. Contact Information</h2>
      <p>For legal notices, inquiries, or support:</p>
      <p><strong>CoursePal Legal Department</strong><br>
      Email: <a href="mailto:legal@coursepal.app" style="color:var(--primary);">legal@coursepal.app</a><br>
      Support: <a href="mailto:support@coursepal.app" style="color:var(--primary);">support@coursepal.app</a><br>
      Vancouver, BC, Canada</p>
    </div>

    <footer>
      <p>&copy; 2026 CoursePal. All rights reserved. Made in Canada 🇨🇦</p>
    </footer>
  </div>
</body>
</html>`;
}
