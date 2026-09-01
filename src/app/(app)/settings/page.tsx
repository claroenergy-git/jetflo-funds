import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { GovernanceSettingsForm } from "@/components/governance-settings-form";

export default async function SettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== "leadership") {
    redirect("/dashboard");
  }

  const supabase = await getSupabase();
  const { data: settings } = await supabase.from("jetflo_settings").select("key, value");

  const getSetting = (key: string, defaultVal: number) => {
    const s = settings?.find((x) => x.key === key);
    return s ? Number(s.value) : defaultVal;
  };

  const secondApproverAbove = getSetting("second_approver_above", 500000);
  const quotationMandatoryAbove = getSetting("quotation_mandatory_above", 50000);
  const duplicateWindowDays = getSetting("duplicate_window_days", 7);

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
        />
      </Card>
    </div>
  );
}
