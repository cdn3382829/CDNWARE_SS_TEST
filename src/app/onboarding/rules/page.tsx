import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { renderMarkup } from "@/lib/markup";
import { OnboardingAccept } from "@/components/onboarding-accept";

export const dynamic = "force-dynamic";

export default async function RulesOnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.acceptedTos) redirect("/onboarding/tos");
  if (user.onboardingComplete) redirect("/dashboard");

  const settings = await getSettings();

  return (
    <main className="grid-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="anim-fade-up mb-6 flex items-center gap-3">
          <span className="tag border-[#5a1414] bg-[#1b0808] text-[#ff6b6b]">Step 3 of 3</span>
          <h1 className="text-xl font-bold text-white">Community Rules</h1>
        </div>

        <div className="card anim-fade-up delay-1 max-h-[58vh] overflow-y-auto p-5">
          {renderMarkup(settings.rulesContent)}
        </div>

        <div className="anim-fade-up delay-2 mt-4">
          <OnboardingAccept step="rules" version={settings.rulesVersion} nextLabel="Accept & enter CDN_SS" />
        </div>
      </div>
    </main>
  );
}
