import { filterCompositePhantomAssignments } from '../src/utils/readingDisplayHelper';
import { SyllabusImportManager } from '../src/services/SyllabusImportManager';
import { LocalSyllabusParser } from '../src/services/LocalSyllabusParser';
import path from 'path';
import { execSync } from 'child_process';

describe('Composite Phantom Assignment Deduplication Rule', () => {
  it('drops phantom overview assignment whose title concatenates 2+ component assignments and duplicates weight/due without unique data', () => {
    const rawAssignments = [
      {
        title: 'Sexuality Reflection Assignment Peer Review Practice Sexuality Research Paper Professionalism, Collaboration, Engagement',
        weightPercentage: '30%',
        dueDate: '2026-07-31',
        pointsPossible: null,
        rubricCriteria: [],
        fullInstructions: ''
      },
      {
        title: 'Sexuality Reflection Assignment',
        weightPercentage: '30%',
        dueDate: '2026-07-31',
        pointsPossible: null,
        rubricCriteria: [],
        fullInstructions: 'Reflection paper instructions.'
      },
      {
        title: 'Peer Review Practice',
        weightPercentage: '10%',
        dueDate: '2026-08-21',
        pointsPossible: '100 Points',
        rubricCriteria: [{ criterionName: 'Organization', points: 10 }],
        fullInstructions: 'Peer review instructions.'
      },
      {
        title: 'Group Sexuality Research Paper',
        weightPercentage: '40%',
        dueDate: '2026-09-04',
        pointsPossible: '100 Points',
        rubricCriteria: [{ criterionName: 'Evidence', points: 20 }],
        fullInstructions: 'Research paper instructions.'
      },
      {
        title: 'Professionalism, Collaboration, and Engagement',
        weightPercentage: '20%',
        dueDate: '2026-09-04',
        pointsPossible: '100 Points',
        rubricCriteria: [{ criterionName: 'Presence', points: 20 }],
        fullInstructions: 'Engagement criteria.'
      }
    ];

    const result = filterCompositePhantomAssignments(rawAssignments);
    expect(result.length).toBe(4);
    expect(result.map(a => a.title)).toEqual([
      'Sexuality Reflection Assignment',
      'Peer Review Practice',
      'Group Sexuality Research Paper',
      'Professionalism, Collaboration, and Engagement'
    ]);
  });

  it('keeps composite assignment if its weight/due is NOT duplicated by a component assignment and reports why', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const rawAssignments = [
      {
        title: 'Midterm Essay and Final Presentation Combined Project',
        weightPercentage: '50%', // Not duplicated by either component
        dueDate: '2026-11-15',
        pointsPossible: null,
        rubricCriteria: [],
        fullInstructions: ''
      },
      {
        title: 'Midterm Essay',
        weightPercentage: '25%',
        dueDate: '2026-10-15',
        pointsPossible: '100 Points',
        rubricCriteria: [],
        fullInstructions: 'Midterm instructions.'
      },
      {
        title: 'Final Presentation',
        weightPercentage: '25%',
        dueDate: '2026-12-01',
        pointsPossible: '100 Points',
        rubricCriteria: [],
        fullInstructions: 'Presentation instructions.'
      }
    ];

    const result = filterCompositePhantomAssignments(rawAssignments);
    expect(result.length).toBe(3); // Kept because 50% is not duplicated!
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AssignmentDedup] Kept composite assignment')
    );

    warnSpy.mockRestore();
  });

  it('preserves genuine individual assignments that do not contain 2+ other assignment titles', () => {
    const rawAssignments = [
      {
        title: 'Assignment 1: Reflection Paper',
        weightPercentage: '20%',
        dueDate: '2026-09-15',
        pointsPossible: '100 Points'
      },
      {
        title: 'Assignment 2: Literature Review',
        weightPercentage: '30%',
        dueDate: '2026-10-15',
        pointsPossible: '100 Points'
      },
      {
        title: 'Assignment 3: Final Project',
        weightPercentage: '50%',
        dueDate: '2026-11-15',
        pointsPossible: '100 Points'
      }
    ];

    const result = filterCompositePhantomAssignments(rawAssignments);
    expect(result.length).toBe(3);
  });
});
