import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { DbUserRow } from "@/lib/auth";

export async function logAudit(params: {
  actor: DbUserRow;
  action: string;
  targetId?: number | null;
  targetName?: string;
  details?: string;
  ip?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: params.actor.id,
      actorName: params.actor.username,
      actorRole: params.actor.role,
      action: params.action,
      targetId: params.targetId ?? null,
      targetName: params.targetName ?? "",
      details: params.details ?? "",
      ip: params.ip ?? "",
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
