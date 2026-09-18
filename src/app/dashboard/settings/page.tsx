import { getSessionUser } from "@/lib/auth";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="space-y-5">
      <header className="anim-fade-up">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Update your username, password, profile picture and bio.
        </p>
      </header>
      <SettingsClient
        initial={{
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
        }}
      />
    </div>
  );
}
