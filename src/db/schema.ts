import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  bigint,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["member", "moderator", "admin", "owner"]);
export const tierEnum = pgEnum("tier", ["none", "standard", "premium"]);
export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
  "frozen",
  "blacklisted",
]);
export const gameTierEnum = pgEnum("game_tier", ["standard", "premium", "private"]);
export const matchTypeEnum = pgEnum("match_type", ["contains", "exact", "regex"]);
export const autoActionEnum = pgEnum("auto_action", ["suspend", "blacklist"]);
export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "cleared",
  "actioned",
  "escalated",
]);
export const forumSectionEnum = pgEnum("forum_section", [
  "scripts",
  "support",
  "suggestions",
  "talk",
]);

/* ------------------------------------------------------------------ */
/* Core accounts                                                       */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 24 }).notNull(),
    usernameLower: varchar("username_lower", { length: 24 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("member"),
    tier: tierEnum("tier").notNull().default("none"),
    status: accountStatusEnum("status").notNull().default("active"),
    bio: varchar("bio", { length: 280 }).notNull().default(""),
    avatarUrl: text("avatar_url").notNull().default(""),
    scriptsExecuted: integer("scripts_executed").notNull().default(0),
    strikes: integer("strikes").notNull().default(0),
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    blacklistedBy: integer("blacklisted_by"),
    blacklistReason: text("blacklist_reason"),
    frozenBy: integer("frozen_by"),
    freezeReason: text("freeze_reason"),
    acceptedTos: boolean("accepted_tos").notNull().default(false),
    acceptedTosVersion: integer("accepted_tos_version").notNull().default(0),
    acceptedRulesVersion: integer("accepted_rules_version").notNull().default(0),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    lastIp: varchar("last_ip", { length: 64 }).notNull().default(""),
    lastUserAgent: text("last_user_agent").notNull().default(""),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_username_lower_idx").on(table.usernameLower),
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userId: integer("user_id").notNull(),
    ip: varchar("ip", { length: 64 }).notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Games & presence                                                    */
/* ------------------------------------------------------------------ */

export const games = pgTable(
  "games",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 96 }).notNull(),
    placeId: varchar("place_id", { length: 32 }).notNull(),
    creator: varchar("creator", { length: 64 }).notNull().default(""),
    tier: gameTierEnum("tier").notNull().default("standard"),
    approved: boolean("approved").notNull().default(false),
    playerCount: integer("player_count").notNull().default(0),
    visits: bigint("visits", { mode: "number" }).notNull().default(0),
    submittedBy: integer("submitted_by"),
    reviewedBy: integer("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("games_place_id_idx").on(table.placeId)],
);

export const privateGameAccess = pgTable(
  "private_game_access",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    gameId: integer("game_id").notNull(),
    grantedBy: integer("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("private_access_idx").on(table.userId, table.gameId)],
);

export const executorPresence = pgTable(
  "executor_presence",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    username: varchar("username", { length: 24 }).notNull(),
    gameId: integer("game_id").notNull(),
    serverId: varchar("server_id", { length: 40 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("presence_idx").on(table.userId, table.gameId, table.serverId)],
);

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  body: text("body").notNull(),
  authorId: integer("author_id").notNull(),
  authorName: varchar("author_name", { length: 24 }).notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const announcementReads = pgTable(
  "announcement_reads",
  {
    id: serial("id").primaryKey(),
    announcementId: integer("announcement_id").notNull(),
    userId: integer("user_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("announcement_read_idx").on(table.announcementId, table.userId)],
);

/* ------------------------------------------------------------------ */
/* Scripts, executions & moderation queues                             */
/* ------------------------------------------------------------------ */

export const savedScripts = pgTable(
  "saved_scripts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("saved_scripts_user_idx").on(table.userId)],
);

export const executionLogs = pgTable(
  "execution_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    username: varchar("username", { length: 24 }).notNull(),
    gameId: integer("game_id"),
    gameName: varchar("game_name", { length: 96 }).notNull().default(""),
    serverId: varchar("server_id", { length: 40 }).notNull().default(""),
    scriptContent: text("script_content").notNull(),
    scriptLength: integer("script_length").notNull().default(0),
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("pending"),
    reviewedBy: integer("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    outcome: varchar("outcome", { length: 64 }).notNull().default("executed"),
    ip: varchar("ip", { length: 64 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("execution_logs_user_idx").on(table.userId),
    index("execution_logs_status_idx").on(table.reviewStatus),
  ],
);

export const blacklistedScripts = pgTable("blacklisted_scripts", {
  id: serial("id").primaryKey(),
  pattern: text("pattern").notNull(),
  matchType: matchTypeEnum("match_type").notNull().default("contains"),
  action: autoActionEnum("action").notNull().default("suspend"),
  reason: varchar("reason", { length: 200 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const strikes = pgTable(
  "strikes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    issuedBy: integer("issued_by").notNull(),
    issuerName: varchar("issuer_name", { length: 24 }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("strikes_user_idx").on(table.userId)],
);

export const suspensions = pgTable(
  "suspensions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    issuedBy: integer("issued_by").notNull(),
    issuerName: varchar("issuer_name", { length: 24 }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    liftedAt: timestamp("lifted_at", { withTimezone: true }),
    liftedBy: integer("lifted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("suspensions_user_idx").on(table.userId)],
);

export const blacklists = pgTable(
  "blacklists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    blacklistedBy: integer("blacklisted_by").notNull(),
    blacklistedByName: varchar("blacklisted_by_name", { length: 24 }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("blacklists_user_idx").on(table.userId)],
);

export const staffNotes = pgTable(
  "staff_notes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    authorId: integer("author_id").notNull(),
    authorName: varchar("author_name", { length: 24 }).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("staff_notes_user_idx").on(table.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").notNull(),
    actorName: varchar("actor_name", { length: 24 }).notNull(),
    actorRole: varchar("actor_role", { length: 16 }).notNull(),
    action: varchar("action", { length: 48 }).notNull(),
    targetId: integer("target_id"),
    targetName: varchar("target_name", { length: 24 }).notNull().default(""),
    details: text("details").notNull().default(""),
    ip: varchar("ip", { length: 64 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export const userBadges = pgTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    code: varchar("code", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_badge_idx").on(table.userId, table.code)],
);

/* ------------------------------------------------------------------ */
/* Forum                                                               */
/* ------------------------------------------------------------------ */

export const forumThreads = pgTable(
  "forum_threads",
  {
    id: serial("id").primaryKey(),
    section: forumSectionEnum("section").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    authorId: integer("author_id").notNull(),
    authorName: varchar("author_name", { length: 24 }).notNull(),
    pinned: boolean("pinned").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    replyCount: integer("reply_count").notNull().default(0),
    views: integer("views").notNull().default(0),
    lastPostAt: timestamp("last_post_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("forum_threads_section_idx").on(table.section)],
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id").notNull(),
    authorId: integer("author_id").notNull(),
    authorName: varchar("author_name", { length: 24 }).notNull(),
    authorRole: varchar("author_role", { length: 16 }).notNull().default("member"),
    body: text("body").notNull(),
    attachments: jsonb("attachments").$type<string[]>().notNull().default([]),
    edited: boolean("edited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("forum_posts_thread_idx").on(table.threadId)],
);

export const images = pgTable("images", {
  id: varchar("id", { length: 32 }).primaryKey(),
  uploaderId: integer("uploader_id").notNull(),
  mime: varchar("mime", { length: 40 }).notNull(),
  bytes: integer("bytes").notNull().default(0),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Site settings (single row, id = 1)                                  */
/* ------------------------------------------------------------------ */

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  tosContent: text("tos_content").notNull(),
  tosVersion: integer("tos_version").notNull().default(1),
  rulesContent: text("rules_content").notNull(),
  rulesVersion: integer("rules_version").notNull().default(1),
  rulesUpdatedAt: timestamp("rules_updated_at", { withTimezone: true }).notNull().defaultNow(),
  standardLink: text("standard_link").notNull().default(""),
  premiumLink: text("premium_link").notNull().default(""),
  standardPrice: varchar("standard_price", { length: 24 }).notNull().default("$9.99"),
  premiumPrice: varchar("premium_price", { length: 24 }).notNull().default("$24.99"),
  maintenance: boolean("maintenance").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
