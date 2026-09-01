"use client";

import { useState, useActionState, useEffect } from "react";
import { changeUserPassword, type ActionResult } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, btnSecondary, Alert } from "@/components/ui";

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    changeUserPassword,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#d5cbba] bg-white px-3 py-1.5 text-xs font-bold text-[#1e3e30] shadow-2xs hover:bg-[#f2ece0] hover:border-[#1e3e30] transition-all cursor-pointer"
        title="Change your account password securely"
      >
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
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>Change Password</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#e2dbcc] bg-white p-6 shadow-2xl animate-entrance-3d">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e5decb]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf3ed] text-[#1e3e30]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#14261c]">Change Password</h3>
                  <p className="text-xs text-[#536658]">Update your account security credentials</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-[#7a8d80] hover:bg-[#f0ebd9] hover:text-[#14261c] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form action={action} className="space-y-4">
              {state?.error && <Alert kind="error">{state.error}</Alert>}
              {state?.ok && <Alert kind="success">Password updated successfully!</Alert>}

              <div>
                <label className={labelCls}>New Password</label>
                <input
                  name="new_password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className={labelCls}>Confirm New Password</label>
                <input
                  name="confirm_password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="Re-type new password"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={btnPrimary}
                >
                  {pending ? "Updating…" : "Save New Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
