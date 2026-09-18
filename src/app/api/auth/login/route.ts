import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, toSessionUser } from "@/lib/auth";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { clientIp, verifyPassword } from "@/lib/security";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export const POST = route(
  async (req) => {
    await ensureSeeded();
    const body = await parseBody(req, loginSchema);
    const identifier = body.identifier.toLowerCase();

    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.usernameLower, identifier), sql`lower(${users.email}) = ${identifier}`))
      .limit(1);

    const user = rows[0];
    if (!user) throw new ApiError(401, "Invalid credentials.");

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid credentials.");

    if (user.status === "blacklisted") {
      throw new ApiError(403, `Account blacklisted: ${user.blacklistReason ?? "no reason given"}`);
    }
    if (user.status === "frozen") {
      throw new ApiError(
        403,
        `Account frozen pending admin review: ${user.freezeReason ?? "no reason given"}`,
      );
    }
    if (user.status === "suspended") {
      const until = user.suspendedUntil;
      if (!until || until.getTime() > Date.now()) {
        throw new ApiError(
          403,
          `Account suspended${until ? ` until ${until.toUTCString()}` : ""}: ${user.suspensionReason ?? "no reason given"}`,
        );
      }
    }

    await db
      .update(users)
      .set({
        lastIp: clientIp(req),
        lastUserAgent: req.headers.get("user-agent")?.slice(0, 400) ?? "",
        lastLoginAt: new Date(),
        ...(user.status === "suspended" ? { status: "active" as const } : {}),
      })
      .where(eq(users.id, user.id));

    await createSession(user.id, clientIp(req), req.headers.get("user-agent") ?? "");

    const redirect = user.onboardingComplete
      ? "/dashboard"
      : user.acceptedTos
        ? "/onboarding/rules"
        : "/onboarding/tos";

    return ok({ user: toSessionUser(user), redirect });
  },
  { limit: { key: "login", max: 12, windowMs: 60_000 * 5 } },
);
