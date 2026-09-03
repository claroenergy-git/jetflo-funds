"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App boundary error caught:", error);
  }, [error]);

  const isPayloadError =
    error?.message?.toLowerCase().includes("payload") ||
    error?.message?.toLowerCase().includes("body") ||
    error?.message?.toLowerCase().includes("size");

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="bento-card p-6 sm:p-8 space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fee2e2] text-[#991b1b] text-2xl shadow-xs">
          ⚠️
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-extrabold text-[#14261c] tracking-tight">
            Unable to Complete Operation
          </h1>
          <p className="text-sm text-[#536658]">
            {isPayloadError
              ? "The uploaded file exceeds the server payload limit. Please compress or optimize the file and try again."
              : "An unexpected error occurred while processing this page or request."}
          </p>
        </div>

        {error?.message && (
          <Alert kind="error">
            <span className="font-mono text-xs break-all">{error.message}</span>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button onClick={() => reset()} className={btnPrimary}>
            Try Again
          </button>
          <Link href="/requests" className={btnSecondary}>
            Back to Fund Requests
          </Link>
        </div>
      </div>
    </div>
  );
}
