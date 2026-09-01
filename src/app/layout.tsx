import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "JetFlo Funds Portal — Claro Energy",
  description: "Executive Fund Request & Spend Governance Portal for JetFlo Manufacturing Unit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="font-sans antialiased bg-[#f7f4ed] text-[#14261c] min-h-screen">
        {children}
      </body>
    </html>
  );
}
