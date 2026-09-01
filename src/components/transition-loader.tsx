"use client";

export function FollowTheLeaderLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f7f4ed]/85 backdrop-blur-md transition-all duration-300">
      <div className="relative flex items-center justify-center p-8">
        {/* Soft background ambient glow */}
        <div className="pointer-events-none absolute h-32 w-32 rounded-full bg-[#1e3e30]/15 blur-3xl" />
        <div className="pointer-events-none absolute h-28 w-28 rounded-full bg-[#d97706]/10 blur-2xl" />

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
