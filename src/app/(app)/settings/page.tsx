import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card, Alert } from "@/components/ui";
import { GovernanceSettingsForm } from "@/components/governance-settings-form";
import {
  NotificationRecipientsForm,
  type NotificationRecipient,
} from "@/components/notification-recipients-form";

export default async function SettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== "leadership") {
    redirect("/dashboard");
  }

  const supabase = await getSupabase();
  const [{ data: settings }, { data: recipients, error: recipientsError }, { data: financeUsers }] =
    await Promise.all([
      supabase.from("jetflo_settings").select("key, value"),
      supabase
        .from("jetflo_notification_recipients")
        .select("id, team, name, email")
        .order("created_at", { ascending: true }),
      supabase.from("jetflo_users").select("email").eq("role", "finance").eq("active", true),
    ]);

  const getSetting = (key: string, defaultVal: number) => {
    const s = settings?.find((x) => x.key === key);
    return s ? Number(s.value) : defaultVal;
  };

  const secondApproverAbove = getSetting("second_approver_above", 500000);
  const quotationMandatoryAbove = getSetting("quotation_mandatory_above", 50000);
  const duplicateWindowDays = getSetting("duplicate_window_days", 7);
  const poSecondApproverAbove = getSetting("po_second_approver_above", 1000000);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageTitle
        title="Leadership Governance & Threshold Controls"
        sub="Configure company-wide financial authorization limits, dual-approval ceilings, and fraud controls."
      />

      <Card variant="amber">
        <div className="mb-6 pb-4 border-b border-[#ebdcc4] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#14261c] flex items-center gap-2">
              <span className="text-[#1e3e30]">⚖️</span>
              Approval Matrix & Threshold Policies
            </h2>
            <p className="text-xs text-[#536658] mt-0.5 font-medium">
              Modifications take effect immediately across all active approval queues and payment dispatches.
            </p>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
            Leadership Only
          </span>
        </div>

        <GovernanceSettingsForm
          secondApproverAbove={secondApproverAbove}
          quotationMandatoryAbove={quotationMandatoryAbove}
          duplicateWindowDays={duplicateWindowDays}
          poSecondApproverAbove={poSecondApproverAbove}
        />
      </Card>

      <Card>
        <div className="mb-5 pb-4 border-b border-[#f0ebd9]">
          <h2 className="text-base font-bold text-[#14261c] flex items-center gap-2">
            <span>✉️</span>
            Email Notification Recipients
          </h2>
          <p className="text-xs text-[#536658] mt-0.5 font-medium">
            Employees added here are copied on workflow emails for their team. They don&apos;t need a portal login.
          </p>
        </div>

        {recipientsError ? (
          <Alert kind="warning">
            Recipient list is unavailable — the <code>012_notification_recipients</code> migration has not been applied yet.
          </Alert>
        ) : (
          <NotificationRecipientsForm
            recipients={(recipients ?? []) as NotificationRecipient[]}
            financeLogins={(financeUsers ?? []).map((u: { email: string }) => u.email)}
          />
        )}
      </Card>
    </div>
  );
}
