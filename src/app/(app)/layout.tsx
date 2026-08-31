import Link from "next/link";
import Image from "next/image";
import { requireProfile } from "@/lib/data"; 
import { signOut } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
 
  const links: { href: string; label: string }[] =
    profile.role === "requester"
      ? [
          { href: "/requests", label: "My Requests" },
          { href: "/requests/new", label: "+ New Request" },
          { href: "/closures", label: "Pending Closures" },
          { href: "/finance/vendors", label: "Vendors & Onboarding" },
        ]
      : profile.role === "finance"
        ? [
            { href: "/finance/queue", label: "Approval Queue" },
            { href: "/finance/payments", label: "Record Payments" },
            { href: "/requests", label: "All Requests" },
            { href: "/dashboard", label: "Executive Dashboard" },
            { href: "/finance/vendors", label: "Vendors" },
            { href: "/finance/budget-heads", label: "Budget Heads" },
          ]
        : [
            { href: "/dashboard", label: "Executive Dashboard" },
            { href: "/requests", label: "All Requests" },
            { href: "/settings", label: "Governance Limits" },
          ];


  return (
    <div className="min-h-screen relative bg-[#07080B] text-slate-100">
      {/* Radiant Background Glowing Auras */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-[650px] w-[650px] rounded-full bg-[#E88C38]/10 blur-[160px]" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-[650px] w-[650px] rounded-full bg-[#F5A623]/10 blur-[160px]" />
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[750px] rounded-full bg-[#10B981]/05 blur-[180px]" />
      <div className="pointer-events-none fixed inset-0 bg-grid-dots opacity-40" />

      {/* Ambient Center-Fixed Background Typographic Branding with Soft Glow */}
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none z-0">
        <div className="absolute h-64 w-[600px] max-w-[90vw] rounded-full bg-amber-500/10 blur-[100px]" />
        <span className="text-[16vw] font-black uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-b from-white/15 via-amber-200/10 to-transparent drop-shadow-[0_0_45px_rgba(245,166,35,0.12)] font-sans leading-none pl-6">
          JETFLO
        </span>
      </div>

      {/* Permanent Locked / Sticky Header & Tabs */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090C10]/95 backdrop-blur-2xl shadow-[0_12px_35px_-10px_rgba(0,0,0,0.9)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* Enhanced High-Visibility Logo with Circular Transparent Badge */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-black/60 to-black p-1 shadow-[0_0_20px_rgba(245,166,35,0.3)] transition-all duration-300 group-hover:scale-105 group-hover:border-amber-400 group-hover:shadow-[0_0_25px_rgba(245,166,35,0.5)]">
              <Image
                src="/jetflo-logo.jpeg"
                alt="JetFlo"
                width={48}
                height={48}
                className="h-full w-full object-cover rounded-full mix-blend-lighten"
                priority
              />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                JetFlo <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,166,35,0.25)]">Funds</span>
              </div>
              <p className="text-[11px] text-[#8E9CA6] font-semibold tracking-wide">Claro Energy Limited</p>
            </div>
          </Link>

          {/* User Profile & 3D Luxury Logout Button */}
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-bold text-white tracking-wide">{profile.name}</div>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-[#8E9CA6] font-medium">
                <span className="capitalize font-bold text-amber-400">{profile.role}</span>
                <span>•</span>
                <span className="truncate max-w-[140px]">{profile.plant}</span>
              </div>
            </div>

            {/* 3D Logout Button from Uiverse.io by Spacious74 */}
            <form action={signOut}>
              <button type="submit" className="logout-3d-button" title="Sign out of JetFlo">
                <div className="inner">
                  <div className="svgs">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5 text-amber-400"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </div>
                  <span>Logout</span>
                </div>
              </button>
            </form>
          </div>
        </div>

        {/* Locked Navigation Tab Row */}
        <nav className="mx-auto max-w-6xl border-t border-white/5 px-4 sm:px-6">
          <NavLinks links={links} />
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
