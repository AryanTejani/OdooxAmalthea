import { query } from '../../libs/db';
import { Activity } from '../../domain/types';

/**
 * Create activity record
 */
export async function createActivity(data: {
  entity: string;
  refId: string;
  actorId: string | null;
  action: string;
  meta: Record<string, unknown>;
}): Promise<Activity> {
  const result = await query(
    `INSERT INTO activity (entity, ref_id, actor_id, action, meta) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, entity, ref_id, actor_id, action, meta, created_at`,
    [
      data.entity,
      data.refId,
      data.actorId || null,
      data.action,
      JSON.stringify(data.meta || {}),
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
 * Get latest activities
 */
export async function getLatestActivities(limit: number = 50, entity?: string): Promise<Activity[]> {
  let sql = 'SELECT id, entity, ref_id, actor_id, action, meta, created_at FROM activity';
  const params: any[] = [];
  
  if (entity) {
    sql += ' WHERE entity = $1';
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
 * Get activities by entity and ref ID
 */
export async function getActivitiesByEntity(entity: string, refId: string): Promise<Activity[]> {
  const result = await query(
    `SELECT id, entity, ref_id, actor_id, action, meta, created_at 
     FROM activity 
     WHERE entity = $1 AND ref_id = $2 
     ORDER BY created_at DESC`,
    [entity, refId]
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
