import { getD1 } from '@/seed/db/client';
import type { ContentProject, ContentStatus } from '@/seed/types/creative-domain';
import {
  ContentGraphError,
  newProjectId,
  projectRowToDomain,
  type ProjectRow,
} from './common';

export async function createProject(project: ContentProject): Promise<ContentProject> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  project.id = project.id || newProjectId();
  project.createdAt = now;
  project.updatedAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO content_projects
           (id, workspace_id, mission_id, creator_id, brand_id, title, description,
            format, status, budget_cents, actual_cost_cents, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        project.id,
        project.workspaceId,
        project.missionId ?? null,
        project.creatorId,
        project.brandId ?? null,
        project.title,
        project.description,
        project.format,
        project.status,
        project.budgetCents,
        project.actualCostCents,
        JSON.stringify(project.metadata ?? {}),
        now,
        now,
      )
      .run();
  } catch (err) {
    throw new ContentGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return project;
}

export async function getProject(id: string): Promise<ContentProject | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(`SELECT * FROM content_projects WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<ProjectRow>();
  return row ? projectRowToDomain(row) : null;
}

export async function listProjects(
  workspaceId: string,
  missionId?: string
): Promise<ContentProject[]> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  let sql = `SELECT * FROM content_projects WHERE workspace_id = ?1`;
  const params: unknown[] = [workspaceId];
  if (missionId) {
    sql += ` AND mission_id = ?${params.length + 1}`;
    params.push(missionId);
  }
  sql += ` ORDER BY created_at DESC`;

  const result = await db.prepare(sql).bind(...params).all<ProjectRow>();
  return (result.results ?? []).map(projectRowToDomain);
}

export async function updateProjectStatus(
  id: string,
  status: ContentStatus
): Promise<ContentProject | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE content_projects SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, id)
    .run();

  const row = await db
    .prepare(`SELECT * FROM content_projects WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<ProjectRow>();
  return row ? projectRowToDomain(row) : null;
}
