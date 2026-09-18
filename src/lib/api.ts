import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, type DbUserRow } from "@/lib/auth";
import { effectiveStatus } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import { clientIp } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const unauthorized = (msg = "Authentication required.") => new ApiError(401, msg);
export const forbidden = (msg = "You do not have permission to do that.") => new ApiError(403, msg);
export const badRequest = (msg = "Invalid request.") => new ApiError(400, msg);

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, ...(data as object) }, { status: init ?? 200 });
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/**
 * Wrapper that gives every route handler: same-origin enforcement on unsafe
 * methods, structured error handling, and optional rate limiting.
 */
export function route<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>,
  options: { limit?: { key: string; max: number; windowMs: number } } = {},
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const method = req.method.toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin) {
          const host = req.headers.get("host");
          try {
            const originHost = new URL(origin).host;
            if (host && originHost !== host) {
              return fail(403, "Cross-origin request blocked.");
            }
          } catch {
            return fail(403, "Invalid origin.");
          }
        }
      }
      if (options.limit) {
        const ip = clientIp(req);
        const result = rateLimit(`${options.limit.key}:${ip}:${method}`, options.limit.max, options.limit.windowMs);
        if (!result.ok) {
          return fail(429, `Too many requests. Try again in ${result.retryAfter}s.`);
        }
      }
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message);
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return fail(400, first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.");
      }
      console.error("[api-error]", err);
      return fail(500, "Unexpected server error.");
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (user.status === "suspended") {
    throw forbidden(
      `Your account is suspended${user.suspendedUntil ? ` until ${new Date(user.suspendedUntil).toUTCString()}` : ""}. Reason: ${user.suspensionReason ?? "No reason provided"}`,
    );
  }
  return user;
}

export async function requireCompleteUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboardingComplete) {
    throw new ApiError(403, "Finish the onboarding steps before continuing.");
  }
  return user;
}

export async function requireUserRow(): Promise<DbUserRow> {
  const sessionUser = await requireUser();
  const rows = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  const row = rows[0];
  if (!row) throw unauthorized();
  if (effectiveStatus({ status: row.status, suspendedUntil: row.suspendedUntil }) === "suspended") {
    throw forbidden("Your account is suspended.");
  }
  return row;
}
