import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { ThreadClient } from "@/components/thread-client";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return <p className="text-xs text-zinc-500">Invalid thread.</p>;
  }
  return <ThreadClient id={numeric} canModerate={user ? isStaff(user.role) : false} />;
}
