import { notFound } from "next/navigation";
import { FORUM_SECTION_KEYS } from "@/lib/permissions";
import { ForumClient } from "@/components/forum-client";

export const dynamic = "force-dynamic";

export default async function ForumSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!FORUM_SECTION_KEYS.includes(section as (typeof FORUM_SECTION_KEYS)[number])) notFound();
  return <ForumClient section={section} />;
}
