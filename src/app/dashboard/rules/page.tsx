import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { renderMarkup } from "@/lib/markup";
import { RulesAccept } from "@/components/rules-accept";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const user = await getSessionUser();
  const settings = await getSettings();
  const outdated = user ? user.acceptedRulesVersion < settings.rulesVersion : false;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="anim-fade-up flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Rules</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Version {settings.rulesVersion} · updated {settings.rulesUpdatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
          </p>
        </div>
        {outdated && (
          <span className="tag anim-blink border-[#5a1414] bg-[#1b0808] text-[#ff6b6b]">
            Updated — re-read required
          </span>
        )}
      </header>

      <div className="card anim-fade-up delay-1 p-5">{renderMarkup(settings.rulesContent)}</div>

      {outdated && (
        <div className="anim-fade-up delay-2">
          <RulesAccept version={settings.rulesVersion} />
        </div>
      )}
    </div>
  );
}
