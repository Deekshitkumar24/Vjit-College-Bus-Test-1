import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface SubmitStopRequestParams {
  requestedBy: string;
  routeId: string;
  proposedName: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class StopRequestsService {
  constructor(private readonly pool: Pool) {}

  public async submitRequest(params: SubmitStopRequestParams): Promise<{ id: string; status: string; voteCount: number }> {
    if (!params.proposedName || params.proposedName.trim().length === 0) {
      throw new Error('PROPOSED_NAME_REQUIRED');
    }

    if (params.proposedName.length > 60) {
      throw new Error('PROPOSED_NAME_TOO_LONG_MAX_60');
    }

    const res = await this.pool.query(
      `INSERT INTO stop_requests (
        id, requested_by, route_id, proposed_name, latitude, longitude,
        status, vote_count, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        'PENDING', 1, NOW(), NOW()
      ) RETURNING id, status, vote_count;`,
      [params.requestedBy, params.routeId, params.proposedName.trim(), params.latitude, params.longitude],
    );

    const record = res.rows[0];

    // Requester automatically casts first vote
    await this.pool.query(
      `INSERT INTO stop_request_votes (id, request_id, student_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
       ON CONFLICT (request_id, student_id) DO NOTHING;`,
      [record.id, params.requestedBy],
    );

    return {
      id: record.id,
      status: record.status,
      voteCount: record.vote_count,
    };
  }

  public async vote(requestId: string, studentId: string): Promise<{ voteCount: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Attempt to register vote
      try {
        await client.query(
          `INSERT INTO stop_request_votes (id, request_id, student_id, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, NOW(), NOW());`,
          [requestId, studentId],
        );
      } catch (err: any) {
        if (err.code === '23505') {
          throw new Error('DUPLICATE_VOTE');
        }
        throw err;
      }

      const upd = await client.query(
        `UPDATE stop_requests SET vote_count = vote_count + 1, updated_at = NOW()
         WHERE id = $1 RETURNING vote_count;`,
        [requestId],
      );

      await client.query('COMMIT');
      return { voteCount: upd.rows[0].vote_count };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
