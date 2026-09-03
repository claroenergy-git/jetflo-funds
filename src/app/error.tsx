"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f7f4ed] flex items-center justify-center p-4">
      <div className="w-full max-w-md bento-card p-6 sm:p-8 space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fee2e2] text-[#991b1b] text-2xl shadow-xs">
          ⚠️
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-[#14261c] tracking-tight">
            Something Went Wrong
          </h1>
          <p className="text-sm text-[#536658]">
            An unexpected error occurred. You can reload the page or return to the main dashboard.
          </p>
        </div>

        {error?.message && (
          <Alert kind="error">
            <span className="font-mono text-xs break-all">{error.message}</span>
          </Alert>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => reset()} className={btnPrimary}>
            Reload Page
          </button>
          <Link href="/" className={btnSecondary}>
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
