import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f7f4ed] text-[#14261c] text-center">
      <div className="bento-card p-8 sm:p-10 max-w-md w-full shadow-lg bg-white border border-[#ded5c2]">
        <div className="text-4xl font-extrabold text-[#1e3e30] mb-2">404</div>
        <h1 className="text-lg font-bold text-[#14261c] mb-2">Page / Resource Not Found</h1>
        <p className="text-xs text-[#536658] mb-6">
          The requested page or downloadable file could not be located.
        </p>
        <Link href="/" className={`${btnPrimary} w-full py-2.5`}>
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
