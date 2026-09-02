import Link from "next/link";
import Image from "next/image";
import { requireProfile } from "@/lib/data"; 
import { signOut } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { ChangePasswordModal } from "@/components/change-password-modal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
 
  const links: { href: string; label: string }[] =
    profile.role === "requester"
      ? [
          { href: "/requests", label: "My Requests" },
          { href: "/finance/vendors", label: "Vendors & Onboarding" },
        ]
      : profile.role === "finance"
        ? [
            { href: "/finance/queue", label: "Approval Queue" },
            { href: "/finance/payments", label: "Record Payments" },
            { href: "/requests", label: "All Requests" },
            { href: "/dashboard", label: "Executive Dashboard" },
            { href: "/finance/vendors", label: "Vendors" },
          ]
        : [
            { href: "/dashboard", label: "Executive Dashboard" },
            { href: "/requests", label: "All Requests" },
            { href: "/settings", label: "Governance Limits" },
          ];

  return (
    <div className="min-h-screen relative bg-[#f7f4ed] text-[#14261c]">
      {/* Radiant Background Soft Glowing Auras */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-[650px] w-[650px] rounded-full bg-[#1e3e30]/05 blur-[140px]" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-[650px] w-[650px] rounded-full bg-[#d97706]/05 blur-[140px]" />
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[750px] rounded-full bg-[#2d5a44]/04 blur-[160px]" />
      <div className="pointer-events-none fixed inset-0 bg-grid-dots opacity-50" />

      {/* Ambient Background Typographic Watermark */}
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none z-0">
        <span className="text-[16vw] font-black uppercase tracking-[0.22em] text-[#1e3e30]/[0.025] font-sans leading-none pl-6">
          JETFLO
        </span>
      </div>

      {/* Sticky Header & Tabs */}
      <header className="sticky top-0 z-40 border-b border-[#e5decb] bg-white/90 backdrop-blur-xl shadow-[0_4px_20px_-5px_rgba(26,40,31,0.06)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* High-Visibility Logo with Circular Badge */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative flex h-14 w-14 sm:h-15 sm:w-15 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c8bd9f] bg-gradient-to-br from-[#f2ece0] to-white p-1 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-[#1e3e30]">
              <Image
                src="/jetflo-logo.jpeg"
                alt="JetFlo Logo"
                width={64}
                height={64}
                className="h-full w-full object-cover rounded-full"
                priority
              />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-[#14261c] flex items-center gap-2">
                JetFlo <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4]">Funds</span>
              </div>
              <p className="text-xs text-[#536658] font-bold tracking-wide">Claro Manufacturing Pvt. Ltd.</p>
            </div>
          </Link>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-bold text-[#14261c] tracking-wide">{profile.name}</div>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-[#536658] font-semibold">
                <span className="capitalize text-[#1e3e30] font-extrabold">{profile.role}</span>
                <span>•</span>
                <span className="truncate max-w-[140px]">{profile.plant}</span>
              </div>
            </div>

            {/* Change Password Modal */}
            <ChangePasswordModal />

            {/* Logout Button */}
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
                      className="h-3.5 w-3.5 text-[#1e3e30]"
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

        {/* Navigation Tab Row */}
        <nav className="mx-auto max-w-6xl border-t border-[#f0ebd9] px-4 sm:px-6">
          <NavLinks links={links} />
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
