import { z } from "zod";
import { FORUM_SECTION_KEYS } from "@/lib/permissions";

const usernameRule = z
  .string()
  .trim()
  .min(3, "must be at least 3 characters")
  .max(20, "must be at most 20 characters")
  .regex(/^[A-Za-z0-9_]+$/, "may only contain letters, numbers and underscores");

// Strong, but not hostile, password policy.
const passwordRule = z
  .string()
  .min(8, "must be at least 8 characters")
  .max(128, "must be at most 128 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "must contain a letter and a number");

export const signupSchema = z.object({
  username: usernameRule,
  email: z.string().trim().email("must be a valid email").max(254),
  password: passwordRule,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

export const onboardingSchema = z.object({
  step: z.enum(["tos", "rules"]),
  version: z.number().int().min(1).max(9999),
});

export const profileSchema = z.object({
  username: usernameRule.optional(),
  bio: z.string().trim().max(280).optional(),
  avatarUrl: z
    .string()
    .trim()
    .max(600)
    .refine((v) => v === "" || /^https:\/\/[\w.-]+(\/[\w\-./%?=&#]*)?$/.test(v), {
      message: "avatar must be a valid https:// image URL",
    })
    .optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: passwordRule.optional(),
});

export const savedScriptSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(64),
  content: z.string().max(200_000, "script is too large"),
});

export const executeSchema = z.object({
  gameId: z.number().int().positive(),
  serverId: z.string().trim().min(1).max(40),
  script: z.string().min(1, "script is empty").max(200_000),
});

export const forumThreadSchema = z.object({
  section: z.enum(["scripts", "support", "suggestions", "talk"]),
  title: z.string().trim().min(3, "title is too short").max(120),
  body: z.string().trim().min(3, "body is too short").max(20_000),
  attachments: z.array(z.string().regex(/^[a-f0-9]{8,32}$/)).max(4).optional(),
});

export const forumReplySchema = z.object({
  body: z.string().trim().min(2, "reply is too short").max(20_000),
  attachments: z.array(z.string().regex(/^[a-f0-9]{8,32}$/)).max(4).optional(),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(3).max(8000),
  pinned: z.boolean().optional(),
});

export const ownerSettingsSchema = z.object({
  tosContent: z.string().min(20).max(40_000).optional(),
  rulesContent: z.string().min(20).max(40_000).optional(),
  standardLink: z.string().trim().max(600).optional(),
  premiumLink: z.string().trim().max(600).optional(),
  standardPrice: z.string().trim().max(24).optional(),
  premiumPrice: z.string().trim().max(24).optional(),
});

export const blacklistScriptSchema = z.object({
  pattern: z.string().trim().min(2).max(4000),
  matchType: z.enum(["contains", "exact", "regex"]),
  action: z.enum(["suspend", "blacklist"]),
  reason: z.string().trim().min(3).max(200),
});

export const staffActionSchema = z.object({
  action: z.enum([
    "suspend",
    "unsuspend",
    "freeze",
    "unfreeze",
    "blacklist",
    "unblacklist",
    "strike",
    "note",
    "grant_tier",
    "revoke_tier",
    "set_role",
    "grant_private_game",
    "revoke_private_game",
  ]),
  reason: z.string().trim().max(300).optional(),
  days: z.number().int().min(0).max(3650).optional(),
  tier: z.enum(["none", "standard", "premium"]).optional(),
  role: z.enum(["member", "moderator", "admin"]).optional(),
  gameId: z.number().int().positive().optional(),
});

export const reviewDecisionSchema = z.object({
  logId: z.number().int().positive(),
  decision: z.enum(["clear", "suspend", "blacklist", "escalate", "freeze"]),
  reason: z.string().trim().min(3).max(240),
  days: z.number().int().min(0).max(3650).optional(),
});

export const gameReviewSchema = z.object({
  gameId: z.number().int().positive(),
  tier: z.enum(["standard", "premium", "private"]),
  approve: z.boolean(),
});

export const submitGameSchema = z.object({
  name: z.string().trim().min(3).max(96),
  placeId: z.string().trim().regex(/^\d{4,20}$/, "place ID must be numeric"),
  creator: z.string().trim().max(64).optional(),
});

export const markReadSchema = z.object({ announcementId: z.number().int().positive() });

export const isForumSection = (value: string): boolean =>
  (FORUM_SECTION_KEYS as string[]).includes(value);
