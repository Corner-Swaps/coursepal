/**
 * Faculty & Contact Information Extractor
 * 1:1 match with Swift FacultyExtractor
 */

export interface FacultyInfo {
  name?: string;
  email?: string;
}

export class FacultyExtractor {
  public static extractFaculty(rawText: String): FacultyInfo {
    let detectedName: string | undefined = undefined;
    let detectedEmail: string | undefined = undefined;

    const lines = rawText.split(/\r?\n/);
    const searchLines = lines.slice(0, 150);

    // 1. Email Extraction
    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    for (const line of searchLines) {
      const trimmed = line.trim();
      const match = trimmed.match(emailRegex);
      if (match) {
        const candidate = match[0];
        const lower = candidate.toLowerCase();
        if (
          !lower.includes('helpdesk') &&
          !lower.includes('support@') &&
          !lower.includes('info@') &&
          !lower.includes('registrar@')
        ) {
          detectedEmail = candidate;
          break;
        } else if (!detectedEmail) {
          detectedEmail = candidate;
        }
      }
    }

    // 2. Faculty Name Extraction via Prefix Patterns
    const namePrefixPatterns = [
      /^\s*(?:Primary\s+Faculty|Faculty\s+Information|Course\s+Faculty|Faculty\s+Member|Primary\s+Instructor|Course\s+Instructor|Instructor\s+Name|Instructor|Professor|Faculty)\s*[:\-–]\s*(.+)$/i,
      /^\s*(?:Dr\.|Prof\.|Professor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+.*)$/i
    ];

    for (const line of searchLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      for (const pat of namePrefixPatterns) {
        const match = trimmed.match(pat);
        if (match && match[1]) {
          const cleanName = this.cleanFacultyName(match[1]);
          if (this.isValidFacultyName(cleanName)) {
            detectedName = cleanName;
            break;
          }
        }
      }
      if (detectedName) break;
    }

    // Fallback: If header line indicates faculty details, check succeeding lines
    if (!detectedName) {
      for (let idx = 0; idx < searchLines.length; idx++) {
        const lower = searchLines[idx].trim().toLowerCase();
        if (
          lower === 'faculty & contact information' ||
          lower === 'faculty information' ||
          lower === 'instructor information' ||
          lower === 'instructor details' ||
          lower === 'course faculty'
        ) {
          for (let offset = 1; offset <= 3; offset++) {
            if (idx + offset < searchLines.length) {
              const nextLine = searchLines[idx + offset].trim();
              const nextLower = nextLine.toLowerCase();
              if (
                nextLine.length > 0 &&
                !nextLower.includes('email') &&
                !nextLower.includes('phone') &&
                !nextLower.includes('office')
              ) {
                const clean = this.cleanFacultyName(nextLine);
                if (this.isValidFacultyName(clean)) {
                  detectedName = clean;
                  break;
                }
              }
            }
          }
          if (detectedName) break;
        }
      }
    }

    return { name: detectedName, email: detectedEmail };
  }

  public static cleanFacultyName(raw: string): string {
    let name = raw.replace(/\s*(?:Email|Phone|Office|E-mail)\s*[:\-].*$/i, '');
    name = name.replace(/^[ ,;:\t\n]+|[ ,;:\t\n]+$/g, '');
    return name;
  }

  public static isValidFacultyName(name: string): boolean {
    if (name.length < 3 || name.length > 75) return false;
    const lower = name.toLowerCase();
    if (
      lower.includes('syllabus') ||
      lower.includes('schedule') ||
      lower.includes('description') ||
      lower.includes('objective') ||
      lower.includes('school of') ||
      lower.includes('university') ||
      lower.includes('credits')
    ) {
      return false;
    }
    return true;
  }
}
