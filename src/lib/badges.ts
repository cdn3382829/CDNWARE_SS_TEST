import { db } from "@/db";
import { userBadges } from "@/db/schema";

/** Idempotently award a badge to a user. Returns true when it is newly awarded. */
export async function awardBadge(userId: number, code: string): Promise<boolean> {
  try {
    const inserted = await db
      .insert(userBadges)
      .values({ userId, code })
      .onConflictDoNothing()
      .returning({ id: userBadges.id });
    return inserted.length > 0;
  } catch {
    return false;
  }
}

export async function awardExecutionBadges(userId: number, totalExecutions: number) {
  await awardBadge(userId, "first_exec");
  if (totalExecutions >= 100) await awardBadge(userId, "veteran");
}
