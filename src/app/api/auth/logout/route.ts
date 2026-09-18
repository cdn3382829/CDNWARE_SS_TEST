import { destroySession } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  await destroySession();
  return ok({ redirect: "/" });
});
