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
            className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold tracking-wide transition-all ${
              active
                ? "bg-[#1e3e30] text-white border border-[#1e3e30] shadow-[0_2px_8px_rgba(30,62,48,0.2)]"
                : "text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c] border border-transparent"
            }`}
          >
            {active && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#a3d9be] mr-2" />
            )}
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
