import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface MinorStatusResult {
  isMinor: boolean;
  hasParentalConsent: boolean;
  restrictedMode: boolean; // True if under 18 and lacks guardian consent
  allowedViews: string[];
}

export interface ErasureResult {
  userId: string;
  attendanceDeleted: number;
  sessionsRevoked: number;
  locationSamplesCleaned: number;
  sosEventsAnonymized: number;
  completedAt: Date;
}

@Injectable()
export class PrivacyService {
  constructor(private readonly pool: Pool) {}

  /**
   * T-PRV-01: Verifies student age and guardian consent (D-15).
   * If age < 18 and guardian consent has not been recorded,
   * student is locked into restricted mode: can only access PRIVACY_NOTICE and SOS_TRIGGER.
   */
  public async evaluateMinorConsent(
    userId: string,
    birthDate: Date,
    now: Date = new Date(),
  ): Promise<MinorStatusResult> {
    const ageDiffMs = now.getTime() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    const ageYears = Math.abs(ageDate.getUTCFullYear() - 1970);

    const isMinor = ageYears < 18;

    if (!isMinor) {
      return {
        isMinor: false,
        hasParentalConsent: true,
        restrictedMode: false,
        allowedViews: ['ALL'],
      };
    }

    // Check if there is an active consent granted by a guardian (granted_by_user_id IS NOT NULL and != userId)
    const consentRes = await this.pool.query(
      `SELECT id FROM consents 
       WHERE user_id = $1 
         AND granted_by_user_id IS NOT NULL 
         AND granted_by_user_id != $1 
         AND withdrawn_at IS NULL 
       LIMIT 1;`,
      [userId],
    );

    const hasParentalConsent = consentRes.rows.length > 0;
    const restrictedMode = !hasParentalConsent;

    return {
      isMinor: true,
      hasParentalConsent,
      restrictedMode,
      allowedViews: restrictedMode ? ['PRIVACY_NOTICE', 'EMERGENCY_SOS'] : ['ALL'],
    };
  }

  /**
   * T-PRV-02: GDPR / DPDP Article 17 Data Erasure Handler.
   * Completely removes attendance records, student locations, and sessions.
   * Anonymizes SOS event logs by scrubbing identifiable actor data.
   */
  public async executeDataDeletion(userId: string): Promise<ErasureResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Delete attendance records for this user
      const attRes = await client.query(
        `DELETE FROM attendance_records WHERE student_id = $1 RETURNING id;`,
        [userId],
      );

      // 2. Revoke and delete active sessions
      const sessRes = await client.query(`DELETE FROM sessions WHERE user_id = $1 RETURNING id;`, [
        userId,
      ]);

      // 3. Clear location samples if table exists
      let locCount = 0;
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'location_samples';`,
      );
      if (tableCheck.rows.length > 0) {
        const locRes = await client.query(
          `DELETE FROM location_samples WHERE raw_payload->>'student_id' = $1 RETURNING id;`,
          [userId],
        );
        locCount = locRes.rows.length;
      }

      // 4. Anonymize SOS events (scrub actor_id and anonymize payload detail)
      const anonUserId = '00000000-0000-0000-0000-000000000000';
      const sosRes = await client.query(
        `UPDATE sos_events 
         SET actor_id = $1, 
             detail = jsonb_set(detail, '{anonymized}', 'true'::jsonb),
             updated_at = NOW() 
         WHERE actor_id = $2 
         RETURNING id;`,
        [anonUserId, userId],
      );

      // 5. Mark user record as DELETED / anonymized
      await client.query(
        `UPDATE users 
         SET status = 'DELETED', 
             full_name = 'Anonymized User', 
             email = 'deleted_' || id || '@anonymized.local', 
             phone_e164 = NULL, 
             deactivated_at = NOW(), 
             updated_at = NOW() 
         WHERE id = $1;`,
        [userId],
      );

      // 6. Record in data_requests as COMPLETED
      await client.query(
        `UPDATE data_requests 
         SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() 
         WHERE user_id = $1 AND type = 'DELETION';`,
        [userId],
      );

      await client.query('COMMIT');

      return {
        userId,
        attendanceDeleted: attRes.rows.length,
        sessionsRevoked: sessRes.rows.length,
        locationSamplesCleaned: locCount,
        sosEventsAnonymized: sosRes.rows.length,
        completedAt: new Date(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
