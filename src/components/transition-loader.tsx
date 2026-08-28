"use client";

export function FollowTheLeaderLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07080B]/90 dark:bg-[#07080B]/90 backdrop-blur-xl transition-all duration-300">
      <div className="relative flex items-center justify-center p-8">
        {/* Soft background ambient glow */}
        <div className="pointer-events-none absolute h-32 w-32 rounded-full bg-amber-500/20 dark:bg-amber-500/25 blur-3xl" />
        <div className="pointer-events-none absolute h-28 w-28 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 blur-2xl" />

        {/* Pure 5-dot Follow-The-Leader Orbiting Loader */}
        <div className="follow-the-leader-line">
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    </div>
  );
}
