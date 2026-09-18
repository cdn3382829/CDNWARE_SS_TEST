import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { DEFAULT_RULES, DEFAULT_TOS, ensureSeeded } from "@/lib/bootstrap";

export type SiteSettings = typeof siteSettings.$inferSelect;

export async function getSettings(): Promise<SiteSettings> {
  await ensureSeeded();
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(siteSettings)
    .values({ id: 1, tosContent: DEFAULT_TOS, rulesContent: DEFAULT_RULES })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const retry = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return (
    retry[0] ?? {
      id: 1,
      tosContent: DEFAULT_TOS,
      tosVersion: 1,
      rulesContent: DEFAULT_RULES,
      rulesVersion: 1,
      rulesUpdatedAt: new Date(),
      standardLink: "",
      premiumLink: "",
      standardPrice: "$9.99",
      premiumPrice: "$24.99",
      maintenance: false,
      updatedAt: new Date(),
    }
  );
}
