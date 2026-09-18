import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboardingComplete) redirect("/onboarding/tos");

  return (
    <div className="min-h-screen">
      <DashboardNav
        initial={{
          username: user.username,
          role: user.role,
          tier: user.tier,
          avatarUrl: user.avatarUrl,
        }}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
