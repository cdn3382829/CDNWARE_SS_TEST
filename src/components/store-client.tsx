"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, Notice, Spinner, Tag, useToast } from "@/components/ui";
import { tierLabel, type Tier } from "@/lib/permissions";

type StorePayload = {
  tier: Tier;
  tierLabel: string;
  standard: { price: string; link: string };
  premium: { price: string; link: string };
};

const STANDARD_PERKS = [
  "Executor access to every Standard game",
  "Live server lists + player search",
  "Unlimited saved scripts",
  "Forum access in all sections",
];

const PREMIUM_PERKS = [
  "Everything in Standard",
  "Executor access to Premium games",
  "Priority script review queue",
  "Premium-only badge on the forum",
  "Early access to new loader builds",
];

export function StoreClient() {
  const [data, setData] = useState<StorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, push, clear } = useToast();

  useEffect(() => {
    (async () => {
      try {
        setData(await api<StorePayload>("/api/store"));
      } catch (err) {
        push("error", err instanceof Error ? err.message : "Could not load the store.");
      } finally {
        setLoading(false);
      }
    })();
  }, [push]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const tiers = [
    {
      key: "standard" as const,
      name: "Standard",
      price: data?.standard.price ?? "$9.99",
      link: data?.standard.link ?? "",
      perks: STANDARD_PERKS,
      current: data?.tier === "standard",
    },
    {
      key: "premium" as const,
      name: "Premium",
      price: data?.premium.price ?? "$24.99",
      link: data?.premium.link ?? "",
      perks: PREMIUM_PERKS,
      current: data?.tier === "premium",
      highlight: true,
    },
  ];

  return (
    <div className="space-y-5">
      {toast && <Notice kind={toast.kind} onClose={clear}>{toast.text}</Notice>}
      {data && (
        <div className="card anim-fade-up flex flex-wrap items-center justify-between gap-3 border-[#2a1010] p-4">
          <p className="text-xs text-zinc-400">
            Current tier:{" "}
            <span className="font-semibold text-white">{tierLabel(data.tier)}</span>
          </p>
          <Tag tone={data.tier === "premium" ? "red" : data.tier === "standard" ? "green" : "default"}>
            {data.tier === "none" ? "Free member" : `${tierLabel(data.tier)} access`}
          </Tag>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {tiers.map((tier, index) => (
          <motion.article
            key={tier.key}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={`card card-hover relative overflow-hidden p-6 ${
              tier.highlight ? "border-[#4a1414]" : ""
            }`}
          >
            {tier.highlight && (
              <div className="absolute right-0 top-0 bg-[#ff2d2d] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Best value
              </div>
            )}
            <h3 className="text-lg font-bold text-white">{tier.name}</h3>
            <p className="mt-2 text-3xl font-black text-white">
              {tier.price}
              <span className="ml-1 text-xs font-medium text-zinc-500">one-time</span>
            </p>
            <ul className="mt-5 space-y-2">
              {tier.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="mt-[3px] text-[#ff5a5a]">✓</span>
                  {perk}
                </li>
              ))}
            </ul>
            {tier.current ? (
              <button className="btn btn-ghost mt-6 w-full" disabled>
                Current tier
              </button>
            ) : tier.link ? (
              <a
                href={tier.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-6 w-full"
              >
                Purchase {tier.name}
              </a>
            ) : (
              <button className="btn btn-ghost mt-6 w-full" disabled>
                Purchase link not set
              </button>
            )}
          </motion.article>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Purchase links are configured by the Owner. After payment, an admin grants your account
        access — usually within a few minutes. Chargebacks result in a permanent blacklist.
      </p>
    </div>
  );
}
