import { GamesBrowser } from "@/components/games-browser";

export const dynamic = "force-dynamic";

export default function GamesPage() {
  return (
    <div className="space-y-5">
      <header className="anim-fade-up">
        <h1 className="text-xl font-bold text-white">Games</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Pick a game, browse its live servers, locate a player and attach the executor.
        </p>
      </header>
      <GamesBrowser />
    </div>
  );
}
