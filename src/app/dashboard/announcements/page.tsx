import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { AnnouncementsClient } from "@/components/announcements-client";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const user = await getSessionUser();
  return (
    <div className="space-y-5">
      <header className="anim-fade-up">
        <h1 className="text-xl font-bold text-white">Announcements</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Global updates from the CDN_SS team. Unread posts are marked with a red dot.
        </p>
      </header>
      <AnnouncementsClient canPost={user ? isAdmin(user.role) : false} />
    </div>
  );
}
