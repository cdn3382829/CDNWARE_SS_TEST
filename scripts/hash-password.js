#!/usr/bin/env node
/**
 * CDN_SS password hash helper.
 *
 *   node scripts/hash-password.js 'Owner#2026'
 *
 * Prints a `scrypt$N$r$p$salt$hash` string that can be pasted straight into the
 * MySQL seed file (database/cdn_ss_mysql.sql) or applied with an UPDATE query.
 * The API verifies these with the exact same parameters (see src/lib/security.ts).
 */
import { randomBytes, scrypt } from "node:crypto";

const N = 16384;
const r = 8;
const p = 1;
const KEY_LEN = 64;

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

const salt = randomBytes(16);
scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p }, (err, derived) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${derived.toString("hex")}`);
});
