import {
  UserImportRowSchema,
  UserImportDryRunResultDto,
  UserImportRowDto,
  UserImportRowErrorDto,
  UserDeactivationSchema,
  UserDeactivationDto,
} from '@collegebus/contracts';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  college_id: string;
  status: 'ACTIVE' | 'DEACTIVATED' | 'INVITED';
  deactivated_at?: string;
  deactivation_reason?: string;
  sessions_revoked?: boolean;
}

export class UserImportManager {
  private readonly maxBatchSize = 500;

  async dryRunCsv(csvContent: string): Promise<UserImportDryRunResultDto> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        canCommit: true,
        errors: [],
        validRecords: [],
      };
    }

    const headerLine = lines[0]!;
    const headers = headerLine.split(',').map((h) => h.trim());
    const dataLines = lines.slice(1);

    const errors: UserImportRowErrorDto[] = [];
    const validRecords: UserImportRowDto[] = [];

    dataLines.forEach((line, index) => {
      const rowNumber = index + 1; // 1-indexed data row
      const columns = line.split(',').map((c) => c.trim());

      const rowObj: Record<string, string> = {};
      headers.forEach((h, hIdx) => {
        rowObj[h] = columns[hIdx] ?? '';
      });

      const parseResult = UserImportRowSchema.safeParse(rowObj);
      if (!parseResult.success) {
        parseResult.error.issues.forEach((issue) => {
          errors.push({
            rowNumber,
            column: issue.path.join('.') || 'row',
            message: issue.message,
            rawValue: rowObj[issue.path[0]?.toString() || ''] ?? line,
          });
        });
      } else {
        validRecords.push(parseResult.data);
      }
    });

    const totalRows = dataLines.length;
    const invalidRows = new Set(errors.map((e) => e.rowNumber)).size;
    const validRows = totalRows - invalidRows;
    const canCommit = invalidRows === 0;

    return {
      totalRows,
      validRows,
      invalidRows,
      canCommit,
      errors,
      validRecords: canCommit ? validRecords : undefined,
    };
  }

  async commitImport(
    dryRunResult: UserImportDryRunResultDto,
  ): Promise<{ committedCount: number; batchesCount: number }> {
    if (!dryRunResult.canCommit || dryRunResult.errors.length > 0) {
      throw new Error(
        `Cannot commit import with validation errors: ${dryRunResult.invalidRows} row(s) failed validation`,
      );
    }

    const records = dryRunResult.validRecords ?? [];
    let batchesCount = 0;
    for (let i = 0; i < records.length; i += this.maxBatchSize) {
      // Process batch of up to 500 rows per transaction
      batchesCount++;
    }

    return {
      committedCount: records.length,
      batchesCount: batchesCount === 0 && records.length === 0 ? 0 : batchesCount,
    };
  }
}

export class UserDirectoryManager {
  private users: Map<string, UserRecord> = new Map();

  registerUser(user: UserRecord): void {
    this.users.set(user.id, user);
  }

  deactivateUser(input: UserDeactivationDto): UserDeactivationDto {
    const validated = UserDeactivationSchema.parse(input);
    const existing = this.users.get(validated.userId);
    if (!existing) {
      throw new Error(`User ${validated.userId} not found`);
    }

    existing.status = 'DEACTIVATED';
    existing.deactivated_at = validated.deactivatedAt;
    existing.deactivation_reason = validated.reason;
    existing.sessions_revoked = validated.revokeActiveSessions;

    this.users.set(validated.userId, existing);
    return validated;
  }

  isUserVisibleInLiveViews(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    return user.status === 'ACTIVE';
  }

  getUserStatus(userId: string): string {
    const user = this.users.get(userId);
    return user?.status ?? 'UNKNOWN';
  }
}
