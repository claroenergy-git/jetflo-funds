"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { signIn } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, Alert } from "@/components/ui";
import { FollowTheLeaderLoader } from "@/components/transition-loader";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [showLoader, setShowLoader] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 3D Card Interactive Tilt State
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glossX: 50, glossY: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    setTilt({
      x: rotateX,
      y: rotateY,
      glossX: (x / rect.width) * 100,
      glossY: (y / rect.height) * 100,
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowLoader(true);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const minDisplayPromise = new Promise((resolve) => setTimeout(resolve, 800));
      const authPromise = signIn(null, formData);

      const [, result] = await Promise.all([minDisplayPromise, authPromise]);

      if (result && !result.ok) {
        setShowLoader(false);
        setErrorMsg("Invalid email or password. Please check your credentials.");
      }
    });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#07080B]">
      {/* Follow-The-Leader Transition Loader */}
      {showLoader && <FollowTheLeaderLoader />}

      {/* Radiant Glowing Amber Aura Backgrounds */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[650px] w-[650px] rounded-full bg-[#E88C38]/12 blur-[160px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[650px] w-[650px] rounded-full bg-[#F5A623]/12 blur-[160px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[750px] rounded-full bg-[#10B981]/05 blur-[180px]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-dots opacity-40" />

      {/* Ambient Center-Fixed Background Typographic Branding with Soft Glow */}
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none z-0">
        <div className="absolute h-64 w-[600px] max-w-[90vw] rounded-full bg-amber-500/10 blur-[100px]" />
        <span className="text-[16vw] font-black uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-b from-white/15 via-amber-200/10 to-transparent drop-shadow-[0_0_45px_rgba(245,166,35,0.12)] font-sans leading-none pl-6">
          JETFLO
        </span>
      </div>


      {/* Main 3D Container */}
      <div className="perspective-1000 w-full max-w-md z-10">
        <div
          ref={cardRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: isHovered
              ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.01)`
              : `rotateX(0deg) rotateY(0deg) scale(1)`,
            transition: isHovered ? "transform 0.08s ease-out" : "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="animate-entrance-3d bento-card relative p-8 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_35px_0_rgba(232,140,56,0.15)] transition-all"
        >
          {/* Dynamic 3D Gloss Highlight */}
          {isHovered && (
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-30 transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${tilt.glossX}% ${tilt.glossY}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 65%)`,
              }}
            />
          )}

          {/* Golden Corner Accent Glows */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-3/4 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          {/* Logo & Header Section with Circular Luxury Badge */}
          <div className="relative mb-8 text-center flex flex-col items-center">
            <div className="relative mb-4 flex items-center justify-center">
              {/* Radar rings */}
              <div className="absolute h-32 w-32 rounded-full border border-amber-500/25 animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-black/80 to-black p-1.5 shadow-[0_0_30px_rgba(245,166,35,0.4)]">
                <Image
                  src="/jetflo-logo.jpeg"
                  alt="JetFlo Logo"
                  width={80}
                  height={80}
                  priority
                  className="h-full w-full object-cover rounded-full mix-blend-lighten"
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 shadow-[0_0_15px_rgba(245,166,35,0.15)]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              Dual-Control Funds Portal
            </div>

            <h1 className="mt-3.5 text-2xl font-black tracking-tight text-white">
              JetFlo <span className="font-light text-[#8E9CA6]">Manufacturing</span>
            </h1>
            <p className="mt-1 text-xs text-[#8E9CA6] font-medium">
              Subsidiary of <span className="font-bold text-white">Claro Energy Limited</span>
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && <Alert kind="error">{errorMsg}</Alert>}

            <div>
              <label className={labelCls}>Work Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputCls}
                placeholder="name@claroenergy.in"
              />
            </div>

            <div>
              <label className={labelCls}>Password</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={inputCls}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={showLoader || isPending}
              className={`${btnPrimary} w-full mt-3 py-3 text-sm font-bold tracking-wide`}
            >
              Enter Executive Workspace
            </button>
          </form>

          {/* Security Badge */}
          <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-center text-[11px] text-[#8E9CA6]">
            <span className="text-amber-400">🛡️</span>
            <span>256-Bit Encrypted Financial Governance Ledger</span>
          </div>
        </div>
      </div>
    </main>
  );
}
