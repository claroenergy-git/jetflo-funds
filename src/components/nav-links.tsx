"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all ${
              active
                ? "bg-gradient-to-r from-amber-500/20 to-amber-500/10 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(232,140,56,0.15)]"
                : "text-[#8E9CA6] hover:bg-white/5 hover:text-white border border-transparent"
            }`}
          >
            {active && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 shadow-[0_0_8px_#f5a623]" />
            )}
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
