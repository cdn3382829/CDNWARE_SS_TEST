import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/bootstrap";
import { AuthPanel } from "@/components/auth-panel";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
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
          <h1 className="text-lg font-bold text-white">Create your account</h1>
          <p className="mt-1 mb-5 text-xs text-zinc-500">
            Step 1 of 3 — next you will review the Terms of Service and the rules.
          </p>
          <AuthPanel mode="signup" />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-600">
          Passwords are hashed with scrypt and never stored in plaintext. Emails are stored as
          provided so staff can look up your account.
        </p>
      </div>
    </main>
  );
}
