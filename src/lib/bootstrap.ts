import { db } from "@/db";
import {
  announcements,
  blacklistedScripts,
  forumPosts,
  forumThreads,
  games,
  siteSettings,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/security";
import { sql } from "drizzle-orm";

export const DEFAULT_TOS = `# CDN_SS Terms of Service

**Last updated:** launch build

By creating a CDN_SS account you accept the following terms. Read them carefully — they are enforced.

## 1. Eligibility
- You must be 13 years or older.
- One account per person. Alt accounts are removed on sight.

## 2. Purchases
- Standard and Premium access are **lifetime, non-transferable** grants tied to your account.
- Access may be revoked without refund if you break the rules.
- Chargebacks result in a permanent blacklist.

## 3. Acceptable use
- Do not resell, share, or leak CDN_SS payloads, loaders, or modules.
- Do not attempt to bypass tier restrictions, rate limits, or the script filter.
- Do not attack CDN_SS infrastructure (API abuse, scraping, credential stuffing).

## 4. Liability
CDN_SS is provided "as is". We are not responsible for Roblox moderation actions taken against your account, including bans on experiences you use the executor in.

## 5. Termination
Staff may suspend, freeze, or blacklist any account at any time for rule violations. Blacklists are permanent.

## 6. Changes
These terms may change. Continued use after an update means you accept the new terms.`;

export const DEFAULT_RULES = `# CDN_SS Community & Usage Rules

## Global rules
1. **No leaking** — never share loaders, modules, or saved payloads publicly.
2. **No malicious scripts** — no token grabbers, cookie stealers, IP loggers, or real-world doxxing payloads.
3. **No crashing servers for fun** — mass-lag and full shutdown payloads must stay in private testing games.
4. **No harassment** — keep the forum and in-experience behaviour civil.
5. **No impersonation** — do not pretend to be staff or another user.
6. **English only** in staff reports so moderators can review them.
7. **No marketplace transactions** outside the official Store links set by the Owner.

## Script rules
- Every executed script is logged and reviewed by the moderation team.
- Flagged scripts are escalated: a Moderator can **freeze** your account while an Admin reviews the case.
- Scripts matching the blacklist filter auto-suspend or auto-blacklist the executing account.

## Enforcement ladder
| Step | Action |
| --- | --- |
| 1 | Warning + 1 strike |
| 2 | 2 strikes — 3 day suspension |
| 3 | 3 strikes — 14 day suspension |
| 4 | Freeze pending Admin review |
| 5 | Permanent blacklist |

## Appeals
Post in the **Support** forum section with your username and the reason shown on your dashboard. Staff respond within 72 hours.`;

const GAMES = [
  { name: "Blox Fruits", placeId: "2753915549", creator: "Gamer Robot Inc", tier: "standard", players: 412_000, visits: 44_000_000_000 },
  { name: "Brookhaven RP", placeId: "4924922222", creator: "Wolfpaq", tier: "standard", players: 238_000, visits: 61_000_000_000 },
  { name: "Da Hood", placeId: "4495685098", creator: "Da Hood Entertainment", tier: "standard", players: 121_000, visits: 9_800_000_000 },
  { name: "Murder Mystery 2", placeId: "142823291", creator: "Nikilis", tier: "standard", players: 88_000, visits: 12_400_000_000 },
  { name: "Pet Simulator 99", placeId: "8737899170", creator: "BIG Games Pets", tier: "standard", players: 64_000, visits: 8_100_000_000 },
  { name: "Natural Disaster Survival", placeId: "189707", creator: "Stickmasterluke", tier: "standard", players: 21_000, visits: 2_100_000_000 },
  { name: "Arsenal", placeId: "286090429", creator: "ROLVe Community", tier: "standard", players: 34_000, visits: 3_900_000_000 },
  { name: "Jailbreak", placeId: "606849621", creator: "Badimo", tier: "standard", players: 45_000, visits: 6_700_000_000 },
  { name: "Grow a Garden", placeId: "126884695634066", creator: "Grow a Garden", tier: "premium", players: 512_000, visits: 18_200_000_000 },
  { name: "Steal a Brainrot", placeId: "10449761463", creator: "Steal a Brainrot", tier: "premium", players: 388_000, visits: 11_500_000_000 },
  { name: "Rivals", placeId: "17625359962", creator: "Nosniy Games", tier: "premium", players: 96_000, visits: 2_400_000_000 },
  { name: "Bee Swarm Simulator", placeId: "1537690962", creator: "Onett", tier: "premium", players: 42_000, visits: 4_200_000_000 },
  { name: "Doors", placeId: "6516141723", creator: "LSPLASH", tier: "premium", players: 57_000, visits: 6_100_000_000 },
  { name: "CDNWARE Private Test Lab", placeId: "999000111", creator: "CDNWARE", tier: "private", players: 12, visits: 8_400 },
  { name: "Sandbox Payload Arena", placeId: "999000222", creator: "CDNWARE", tier: "private", players: 7, visits: 3_120 },
  { name: "Untitled Combat Arena", placeId: "778899001", creator: "pendingCreator", tier: "standard", players: 3_400, visits: 980_000 },
  { name: "Anime Clash Legends", placeId: "778899002", creator: "pendingCreator2", tier: "standard", players: 1_900, visits: 240_000 },
] as const;

let seedPromise: Promise<void> | null = null;

async function seed() {
  const settingsRows = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  if (settingsRows.length === 0) {
    await db.insert(siteSettings).values({
      id: 1,
      tosContent: DEFAULT_TOS,
      rulesContent: DEFAULT_RULES,
      tosVersion: 1,
      rulesVersion: 1,
      standardLink: "https://pay.example.com/cdn-ss-standard",
      premiumLink: "https://pay.example.com/cdn-ss-premium",
      standardPrice: "$9.99",
      premiumPrice: "$24.99",
    });
  }

  const ownerRows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.role} = 'owner'`)
    .limit(1);

  let ownerId = ownerRows[0]?.id;
  if (!ownerId) {
    const inserted = await db
      .insert(users)
      .values({
        username: "CDNWARE",
        usernameLower: "cdnware",
        email: "owner@cdnware.dev",
        passwordHash: await hashPassword("Owner#2026"),
        role: "owner",
        tier: "premium",
        bio: "Founder & Owner of CDN_SS.",
        acceptedTos: true,
        acceptedTosVersion: 1,
        acceptedRulesVersion: 1,
        onboardingComplete: true,
        scriptsExecuted: 2481,
        lastIp: "127.0.0.1",
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    ownerId = inserted[0]?.id;
  }

  if (ownerId) {
    const staff = [
      { username: "AdminKai", email: "admin@cdnware.dev", password: "Admin#2026", role: "admin" as const, tier: "premium" as const, bio: "Admin — reviews flagged scripts.", exec: 812 },
      { username: "ModSera", email: "mod@cdnware.dev", password: "Mod#2026", role: "moderator" as const, tier: "standard" as const, bio: "Moderator — script logs.", exec: 264 },
      { username: "PremiumPax", email: "premium@cdnware.dev", password: "Premium#2026", role: "member" as const, tier: "premium" as const, bio: "Premium enjoyer.", exec: 918 },
      { username: "StandardSam", email: "standard@cdnware.dev", password: "Standard#2026", role: "member" as const, tier: "standard" as const, bio: "Standard tier user.", exec: 143 },
      { username: "NewbieNate", email: "member@cdnware.dev", password: "Member#2026", role: "member" as const, tier: "none" as const, bio: "Just joined CDN_SS.", exec: 0 },
    ];
    for (const member of staff) {
      await db
        .insert(users)
        .values({
          username: member.username,
          usernameLower: member.username.toLowerCase(),
          email: member.email,
          passwordHash: await hashPassword(member.password),
          role: member.role,
          tier: member.tier,
          bio: member.bio,
          acceptedTos: true,
          acceptedTosVersion: 1,
          acceptedRulesVersion: 1,
          onboardingComplete: true,
          scriptsExecuted: member.exec,
          lastIp: "127.0.0.1",
        })
        .onConflictDoNothing();
    }

    const gameCount = await db.select({ count: sql<number>`count(*)::int` }).from(games);
    if ((gameCount[0]?.count ?? 0) === 0) {
      await db.insert(games).values(
        GAMES.map((game, index) => ({
          name: game.name,
          placeId: game.placeId,
          creator: game.creator,
          tier: game.tier,
          approved: index < 14,
          playerCount: game.players,
          visits: game.visits,
          submittedBy: index >= 14 ? ownerId : null,
        })),
      ).onConflictDoNothing();
    }

    const announcementCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(announcements);
    if ((announcementCount[0]?.count ?? 0) === 0) {
      await db.insert(announcements).values([
        {
          title: "CDN_SS v2.4 — Fast attach + server search",
          body: "**Live server search is here.**\n\nOpen any game, type a username into the search box, and CDN_SS returns the exact server that player is in. Attach times dropped by ~40ms after the loader rewrite.\n\n```\nrequire(id).ehhsdiweew\n```",
          authorId: ownerId,
          authorName: "CDNWARE",
          pinned: true,
        },
        {
          title: "Script filter update",
          body: "Token grabbers and cookie stealers are now auto-blacklisted on execution. Moderators still review every flagged log — appeals go to the *Support* forum.",
          authorId: ownerId,
          authorName: "CDNWARE",
          pinned: false,
        },
      ]);
    }

    const blacklistCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blacklistedScripts);
    if ((blacklistCount[0]?.count ?? 0) === 0 && ownerId) {
      await db.insert(blacklistedScripts).values([
        {
          pattern: ".ROBLOSECURITY",
          matchType: "contains",
          action: "blacklist",
          reason: "Cookie stealing payload",
          createdBy: ownerId,
        },
        {
          pattern: "HttpService:GetAsync",
          matchType: "contains",
          action: "suspend",
          reason: "Unapproved external payload download",
          createdBy: ownerId,
        },
        {
          pattern: "^local msg = 'i was here'$",
          matchType: "regex",
          action: "suspend",
          reason: "Vandalism payload (defaces server instances)",
          createdBy: ownerId,
        },
      ]);
    }

    const threadCount = await db.select({ count: sql<number>`count(*)::int` }).from(forumThreads);
    if ((threadCount[0]?.count ?? 0) === 0) {
      const threads = [
        {
          section: "scripts" as const,
          title: "[SHARE] Silent walkspeed + jump boost payload",
          body: "Runs on the CDN_SS server executor, no client injection needed.\n\n```\nlocal Players = game:GetService('Players')\nfor _, p in ipairs(Players:GetPlayers()) do\n    p.Character.Humanoid.WalkSpeed = 42\nend\n```\nTested on **Blox Fruits** and **Da Hood**.",
          author: "PremiumPax",
          replies: [
            { author: "StandardSam", body: "Works. Saved it to my scripts as `speed.lua`." },
            { author: "ModSera", body: "Approved — nothing here trips the filter." },
          ],
        },
        {
          section: "support" as const,
          title: "Executor says 'Executed' but nothing happens",
          body: "I ran a simple `print('hi')` payload and got the green indicator, but nothing shows in the game. Using the loader from the docs. Anyone else?",
          author: "StandardSam",
          replies: [{ author: "AdminKai", body: "`print` goes to the server console, not your client. Try spawning a part instead." }],
        },
        {
          section: "suggestions" as const,
          title: "Add a scheduled executor queue",
          body: "It would be great to queue payloads per server with a delay so we do not have to babysit the executor.",
          author: "PremiumPax",
          replies: [{ author: "CDNWARE", body: "On the roadmap for v2.6. 👀" }],
        },
        {
          section: "talk" as const,
          title: "Best game to test in right now?",
          body: "Looking for a low-population server so I can test without getting reported. Drop your spots.",
          author: "NewbieNate",
          replies: [],
        },
      ];

      for (const thread of threads) {
        const authorRows = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(sql`${users.usernameLower} = ${thread.author.toLowerCase()}`)
          .limit(1);
        const author = authorRows[0] ?? { id: ownerId, role: "owner" as const };
        const [created] = await db
          .insert(forumThreads)
          .values({
            section: thread.section,
            title: thread.title,
            authorId: author.id,
            authorName: thread.author,
            replyCount: thread.replies.length,
            views: 40 + thread.replies.length * 23,
          })
          .returning({ id: forumThreads.id });
        if (!created) continue;
        await db.insert(forumPosts).values({
          threadId: created.id,
          authorId: author.id,
          authorName: thread.author,
          authorRole: author.role,
          body: thread.body,
        });
        for (const reply of thread.replies) {
          const replyRows = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(sql`${users.usernameLower} = ${reply.author.toLowerCase()}`)
            .limit(1);
          const replyAuthor = replyRows[0] ?? { id: ownerId, role: "owner" as const };
          await db.insert(forumPosts).values({
            threadId: created.id,
            authorId: replyAuthor.id,
            authorName: reply.author,
            authorRole: replyAuthor.role,
            body: reply.body,
          });
        }
      }
    }
  }
}

/** Idempotent bootstrap of demo/reference data. Runs at most once per process. */
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seed().catch((err) => {
      console.error("[bootstrap] seed failed", err);
      seedPromise = null;
    });
  }
  return seedPromise;
}
