import { query } from '../../libs/db';
import { Activity } from '../../domain/types';

/**
 * Create activity record (sets company_id from actorId's user)
 */
export async function createActivity(data: {
  entity: string;
  refId: string;
  actorId: string | null;
  action: string;
  meta: Record<string, unknown>;
}): Promise<Activity> {
  // Get company_id from actor's user
  let companyId: string | null = null;
  if (data.actorId) {
    const userResult = await query(
      'SELECT company_id FROM users WHERE id = $1',
      [data.actorId]
    );
    if (userResult.rows.length > 0) {
      companyId = userResult.rows[0].company_id;
    }
  }

  const result = await query(
    `INSERT INTO activity (entity, ref_id, actor_id, action, meta, company_id) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id, entity, ref_id, actor_id, action, meta, company_id, created_at`,
    [
      data.entity,
      data.refId,
      data.actorId || null,
      data.action,
      JSON.stringify(data.meta || {}),
      companyId,
    ]
  );
  
  const row = result.rows[0];
  return {
    id: parseInt(row.id, 10),
    entity: row.entity,
    refId: row.ref_id,
    actorId: row.actor_id,
    action: row.action,
    meta: row.meta || {},
    createdAt: row.created_at,
  };
}

/**
 * Get latest activities (filtered by company)
 */
export async function getLatestActivities(companyId: string, limit: number = 50, entity?: string): Promise<Activity[]> {
  let sql = 'SELECT id, entity, ref_id, actor_id, action, meta, company_id, created_at FROM activity WHERE company_id = $1';
  const params: any[] = [companyId];
  
  if (entity) {
    sql += ` AND entity = $${params.length + 1}`;
    params.push(entity);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  
  const result = await query(sql, params);
  
  return result.rows.map((row) => ({
    id: parseInt(row.id, 10),
    entity: row.entity,
    refId: row.ref_id,
    actorId: row.actor_id,
    action: row.action,
    meta: row.meta || {},
    createdAt: row.created_at,
  }));
}

/**
 * Get activities by entity and ref ID (filtered by company)
 */
export async function getActivitiesByEntity(entity: string, refId: string, companyId: string): Promise<Activity[]> {
  const result = await query(
    `SELECT id, entity, ref_id, actor_id, action, meta, company_id, created_at 
     FROM activity 
     WHERE entity = $1 AND ref_id = $2 AND company_id = $3
     ORDER BY created_at DESC`,
    [entity, refId, companyId]
  );
  
  return result.rows.map((row) => ({
    id: parseInt(row.id, 10),
    entity: row.entity,
    refId: row.ref_id,
    actorId: row.actor_id,
    action: row.action,
    meta: row.meta || {},
    createdAt: row.created_at,
  }));
}

export const activityRepo = {
  create: createActivity,
  getLatest: getLatestActivities,
  getByEntity: getActivitiesByEntity,
};
