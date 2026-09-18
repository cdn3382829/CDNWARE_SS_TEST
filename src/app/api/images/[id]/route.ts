import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-f0-9]{8,32}$/;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return new Response("Not found", { status: 404 });
  const rows = await db.select().from(images).where(eq(images.id, id)).limit(1);
  const row = rows[0];
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = Buffer.from(row.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": row.mime,
      "content-length": String(bytes.byteLength),
      "cache-control": "private, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}
