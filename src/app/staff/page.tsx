import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isStaff, roleLabel } from "@/lib/permissions";
import { StaffDashboard } from "@/components/staff-dashboard";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboardingComplete) redirect("/onboarding/tos");
  if (!isStaff(user.role)) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[#17171d] bg-[#07070999] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.imgur.com/4KNDb3R.png"
              alt="CDN_SS"
              className="h-8 w-8 rounded-md ring-1 ring-[#3a1414]"
            />
            <div>
              <p className="text-sm font-bold text-white">
                CDN<span className="text-[#ff2d2d]">_SS</span> · Staff
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {roleLabel(user.role)} console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn btn-ghost !py-1.5 text-xs">
              ← User dashboard
            </Link>
            <Link href="/dashboard/announcements" className="btn btn-primary !py-1.5 text-xs">
              📢 Post announcement
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        <StaffDashboard role={user.role} />
      </main>
    </div>
  );
}
