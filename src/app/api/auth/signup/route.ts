import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, toSessionUser } from "@/lib/auth";
import { ok, parseBody, route, fail, ApiError } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { clientIp, hashPassword } from "@/lib/security";
import { ensureSeeded } from "@/lib/bootstrap";
import { awardBadge } from "@/lib/badges";

export const dynamic = "force-dynamic";

export const POST = route(
  async (req) => {
    await ensureSeeded();
    const body = await parseBody(req, signupSchema);
    const usernameLower = body.username.toLowerCase();
    const emailLower = body.email.toLowerCase();

    const existing = await db
      .select({ id: users.id, usernameLower: users.usernameLower, email: users.email })
      .from(users)
      .where(or(eq(users.usernameLower, usernameLower), sql`lower(${users.email}) = ${emailLower}`))
      .limit(1);

    if (existing[0]) {
      const clash = existing[0].usernameLower === usernameLower ? "username" : "email";
      throw new ApiError(409, `That ${clash} is already registered.`);
    }

    const passwordHash = await hashPassword(body.password);
    const inserted = await db
      .insert(users)
      .values({
        username: body.username,
        usernameLower,
        email: body.email,
        passwordHash,
        lastIp: clientIp(req),
        lastUserAgent: req.headers.get("user-agent")?.slice(0, 400) ?? "",
        lastLoginAt: new Date(),
      })
      .returning();

    const created = inserted[0];
    if (!created) throw new ApiError(500, "Could not create the account.");

    await awardBadge(created.id, "early");
    await createSession(created.id, clientIp(req), req.headers.get("user-agent") ?? "");

    return ok({ user: toSessionUser(created), redirect: "/onboarding/tos" }, 201);
  },
  { limit: { key: "signup", max: 8, windowMs: 60_000 * 10 } },
);

export const GET = () => fail(405, "Method not allowed.");
