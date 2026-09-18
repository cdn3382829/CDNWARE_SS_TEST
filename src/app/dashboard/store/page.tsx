import { StoreClient } from "@/components/store-client";

export const dynamic = "force-dynamic";

export default function StorePage() {
  return (
    <div className="space-y-5">
      <header className="anim-fade-up">
        <h1 className="text-xl font-bold text-white">Store</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Unlock the executor. Standard and Premium are lifetime grants tied to your account.
        </p>
      </header>
      <StoreClient />
    </div>
  );
}
