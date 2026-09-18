import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedScripts } from "@/db/schema";
import { ok, parseBody, requireCompleteUser, route } from "@/lib/api";
import { savedScriptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireCompleteUser();
  const rows = await db
    .select()
    .from(savedScripts)
    .where(eq(savedScripts.userId, user.id))
    .orderBy(desc(savedScripts.updatedAt))
    .limit(200);
  return ok({
    scripts: rows.map((row) => ({
      id: row.id,
      name: row.name,
      content: row.content,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
});

export const POST = route(
  async (req) => {
    const user = await requireCompleteUser();
    const body = await parseBody(req, savedScriptSchema);
    const existing = await db
      .select({ id: savedScripts.id })
      .from(savedScripts)
      .where(and(eq(savedScripts.userId, user.id), eq(savedScripts.name, body.name)))
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(savedScripts)
        .set({ content: body.content, updatedAt: new Date() })
        .where(eq(savedScripts.id, existing[0].id))
        .returning();
      return ok({ script: updated, overwritten: true });
    }
    const [created] = await db
      .insert(savedScripts)
      .values({ userId: user.id, name: body.name, content: body.content })
      .returning();
    return ok({ script: created }, 201);
  },
  { limit: { key: "script-save", max: 60, windowMs: 60_000 } },
);
