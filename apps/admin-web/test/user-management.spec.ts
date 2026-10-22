import { describe, it, expect } from 'vitest';
import {
  UserImportManager,
  UserDirectoryManager,
} from '../src/users/user-management';

describe('P4-T5: User Management, CSV Bulk Import & Deactivation (Part 11.8)', () => {
  describe('AC-COR-02: CSV Import Dry Run & Commit Gate', () => {
    it('blocks commit when bad rows exist and lists exact row numbers and errors (AC-COR-02)', async () => {
      const importManager = new UserImportManager();

      // Create a CSV with 400 rows, exactly 3 of which are invalid (e.g. rows 12, 150, 399)
      const rows: string[] = ['name,email,phone,role,college_id'];
      for (let i = 1; i <= 400; i++) {
        if (i === 12) {
          // Invalid email
          rows.push(`Student Twelve,invalid-email-at-college,+919876543210,STUDENT,COL12`);
        } else if (i === 150) {
          // Missing college_id
          rows.push(`Student OneFifty,s150@college.edu,+919876543210,STUDENT,`);
        } else if (i === 399) {
          // Invalid phone
          rows.push(`Student ThreeNinetyNine,s399@college.edu,bad-phone,STUDENT,COL399`);
        } else {
          rows.push(`Student ${i},s${i}@college.edu,+919876543210,STUDENT,COL${i}`);
        }
      }
      const csvContent = rows.join('\n');

      const dryRunResult = await importManager.dryRunCsv(csvContent);

      expect(dryRunResult.totalRows).toBe(400);
      expect(dryRunResult.validRows).toBe(397);
      expect(dryRunResult.invalidRows).toBe(3);
      expect(dryRunResult.canCommit).toBe(false);

      // Verify the 3 specific row numbers are reported
      const errorRowNumbers = dryRunResult.errors.map((e) => e.rowNumber).sort((a, b) => a - b);
      expect(errorRowNumbers).toEqual([12, 150, 399]);

      // Attempting to commit a run with errors must throw an error
      await expect(importManager.commitImport(dryRunResult)).rejects.toThrow(
        /Cannot commit import with validation errors/,
      );
    });

    it('approves clean CSV and commits in chunks up to 500 rows', async () => {
      const importManager = new UserImportManager();

      const rows: string[] = ['name,email,phone,role,college_id'];
      for (let i = 1; i <= 550; i++) {
        rows.push(`User ${i},user${i}@college.edu,+919876543210,STUDENT,STU${i}`);
      }
      const csvContent = rows.join('\n');

      const dryRunResult = await importManager.dryRunCsv(csvContent);
      expect(dryRunResult.totalRows).toBe(550);
      expect(dryRunResult.validRows).toBe(550);
      expect(dryRunResult.invalidRows).toBe(0);
      expect(dryRunResult.canCommit).toBe(true);

      const commitResult = await importManager.commitImport(dryRunResult);
      expect(commitResult.committedCount).toBe(550);
      expect(commitResult.batchesCount).toBe(2); // 500 in batch 1, 50 in batch 2
    });
  });

  describe('AC-COR-03: User Deactivation and Session Invalidation', () => {
    it('deactivates user with reason and makes user immediately disappear from live views (within 60s)', () => {
      const userDir = new UserDirectoryManager();

      userDir.registerUser({
        id: 'usr-student-1',
        name: 'Jane Doe',
        email: 'jane@college.edu',
        role: 'STUDENT',
        college_id: 'JANE01',
        status: 'ACTIVE',
      });

      expect(userDir.isUserVisibleInLiveViews('usr-student-1')).toBe(true);

      // Deactivate user
      const deactivation = userDir.deactivateUser({
        userId: 'usr-student-1',
        deactivatedAt: new Date().toISOString(),
        reason: 'Student graduated and left college fleet service',
        revokeActiveSessions: true,
      });

      expect(deactivation.userId).toBe('usr-student-1');
      expect(deactivation.revokeActiveSessions).toBe(true);

      // Verify immediate disappearance from live views
      expect(userDir.isUserVisibleInLiveViews('usr-student-1')).toBe(false);
      expect(userDir.getUserStatus('usr-student-1')).toBe('DEACTIVATED');
    });

    it('rejects deactivation without a valid reason', () => {
      const userDir = new UserDirectoryManager();
      userDir.registerUser({
        id: 'usr-student-2',
        name: 'John Doe',
        email: 'john@college.edu',
        role: 'STUDENT',
        college_id: 'JOHN02',
        status: 'ACTIVE',
      });

      expect(() => {
        userDir.deactivateUser({
          userId: 'usr-student-2',
          deactivatedAt: new Date().toISOString(),
          reason: 'abc', // < 5 chars
          revokeActiveSessions: true,
        });
      }).toThrow(/Reason must be at least 5 characters/);
    });
  });
});
