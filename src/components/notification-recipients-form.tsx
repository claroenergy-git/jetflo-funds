"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addNotificationRecipient,
  removeNotificationRecipient,
  type ActionResult,
} from "@/app/actions";
import { inputCls, btnPrimary, Alert } from "@/components/ui";

export type NotificationRecipient = {
  id: string;
  team: "ground" | "accounts";
  name: string | null;
  email: string;
};

const TEAMS = [
  {
    team: "ground" as const,
    title: "Ground team",
    events: "Approved · Partially approved · Rejected · Sent back · Payment recorded",
    alwaysLabel: "The person who raised the request",
  },
  {
    team: "accounts" as const,
    title: "Accounts team",
    events: "New request submitted · Needs second approver · Currency amended",
    alwaysLabel: "Finance logins",
  },
];

export function NotificationRecipientsForm({
  recipients,
  financeLogins,
}: {
  recipients: NotificationRecipient[];
  financeLogins: string[];
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {TEAMS.map((t) => (
        <TeamList
          key={t.team}
          {...t}
          always={t.team === "accounts" ? financeLogins.join(", ") : t.alwaysLabel}
          recipients={recipients.filter((r) => r.team === t.team)}
        />
      ))}
    </div>
  );
}

function TeamList({
  team,
  title,
  events,
  always,
  recipients,
}: {
  team: "ground" | "accounts";
  title: string;
  events: string;
  always: string;
  recipients: NotificationRecipient[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    addNotificationRecipient,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="rounded-2xl border border-[#d8e8dc] bg-[#f4f9f5] p-5 shadow-xs">
      <h3 className="text-sm font-bold text-[#14261c]">{title}</h3>
      <p className="mt-0.5 text-[11px] font-medium text-[#536658]">{events}</p>
      <p className="mt-2 text-[11px] text-[#536658]">
        <b>Always notified:</b> {always || "—"}
      </p>

      <ul className="mt-4 divide-y divide-[#d8e8dc] rounded-xl border border-[#d8e8dc] bg-white">
        {recipients.length === 0 ? (
          <li className="px-3.5 py-3 text-xs italic text-[#7a8d80]">No extra recipients yet.</li>
        ) : (
          recipients.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                {r.name && <div className="truncate text-sm font-bold text-[#14261c]">{r.name}</div>}
                <div className="truncate font-mono text-xs text-[#536658]">{r.email}</div>
              </div>
              <RemoveButton id={r.id} email={r.email} />
            </li>
          ))
        )}
      </ul>

      <form ref={formRef} action={formAction} className="mt-4 space-y-2">
        <input type="hidden" name="team" value={team} />
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        <input name="name" placeholder="Name (optional)" className={inputCls} />
        <div className="flex gap-2">
          <input name="email" type="email" required placeholder="name@claroenergy.in" className={inputCls} />
          <button type="submit" disabled={isPending} className={`${btnPrimary} shrink-0`}>
            {isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RemoveButton({ id, email }: { id: string; email: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    removeNotificationRecipient,
    null
  );
  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        title={state?.error ?? `Stop emailing ${email}`}
        className="rounded-lg border border-[#fecaca] bg-white px-2.5 py-1 text-[11px] font-bold text-[#991b1b] transition hover:bg-[#fef2f2] disabled:opacity-50 cursor-pointer"
      >
        {isPending ? "…" : "Remove"}
      </button>
    </form>
  );
}
