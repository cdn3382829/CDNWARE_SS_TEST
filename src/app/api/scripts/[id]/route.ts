import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedScripts } from "@/db/schema";
import { ApiError, ok, parseBody, requireCompleteUser, route } from "@/lib/api";
import { savedScriptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCompleteUser();
  const { id } = await ctx.params;
  const scriptId = Number(id);
  const body = await parseBody(req, savedScriptSchema);
  const [updated] = await db
    .update(savedScripts)
    .set({ name: body.name, content: body.content, updatedAt: new Date() })
    .where(and(eq(savedScripts.id, scriptId), eq(savedScripts.userId, user.id)))
    .returning();
  if (!updated) throw new ApiError(404, "Script not found.");
  return ok({ script: updated });
});

export const DELETE = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCompleteUser();
  const { id } = await ctx.params;
  const scriptId = Number(id);
  const deleted = await db
    .delete(savedScripts)
    .where(and(eq(savedScripts.id, scriptId), eq(savedScripts.userId, user.id)))
    .returning({ id: savedScripts.id });
  if (deleted.length === 0) throw new ApiError(404, "Script not found.");
  return ok({ deleted: scriptId });
});
