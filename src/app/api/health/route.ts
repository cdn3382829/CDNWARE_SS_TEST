import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await ensureSeeded();
    return Response.json({ ok: true, service: "cdn_ss", db: "up" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
