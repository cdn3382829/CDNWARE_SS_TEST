import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/bootstrap";
import { AuthPanel } from "@/components/auth-panel";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeeded();
  const user = await getSessionUser();
  if (user) redirect(user.onboardingComplete ? "/dashboard" : "/onboarding/tos");

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.imgur.com/4KNDb3R.png"
            alt="CDN_SS"
            className="h-10 w-10 rounded-md ring-1 ring-[#3a1414]"
          />
          <span className="text-lg font-bold tracking-tight text-white">
            CDN<span className="text-[#ff2d2d]">_SS</span>
          </span>
        </Link>

        <div className="card anim-fade-up p-6">
          <h1 className="text-lg font-bold text-white">Welcome back</h1>
          <p className="mt-1 mb-5 text-xs text-zinc-500">
            Log in to reach your dashboard, servers and script library.
          </p>
          <AuthPanel mode="login" />
        </div>

        <div className="card anim-fade-up delay-3 mt-4 border-[#2a1010] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Demo accounts
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-400">
            <li>owner@cdnware.dev · Owner#2026</li>
            <li>admin@cdnware.dev · Admin#2026</li>
            <li>mod@cdnware.dev · Mod#2026</li>
            <li>premium@cdnware.dev · Premium#2026</li>
            <li>standard@cdnware.dev · Standard#2026</li>
            <li>member@cdnware.dev · Member#2026</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
