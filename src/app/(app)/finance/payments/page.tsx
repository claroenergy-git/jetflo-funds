import { requireProfile, getFundRequests } from "@/lib/data";
import { PageTitle, Alert } from "@/components/ui";
import { RequestTable } from "@/components/request-table";
import { inr } from "@/lib/format";

export default async function PaymentsPage() {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;

  const rows = await getFundRequests(profile, {
    statusIn: ["approved", "partially_approved"],
    orderBy: "fr.decided_at ASC",
  });

  const due = rows.filter((r: any) => Number(r.amount_approved) > Number(r.amount_paid));
  const total = due.reduce((s, r) => s + Number(r.amount_approved) - Number(r.amount_paid), 0);

  return (
    <div>
      <PageTitle
        title="Payments due"
        sub={`${due.length} approved requests awaiting transfer · ${inr(total, { compact: true })} payable — open a request to record the transfer`}
      />
      <RequestTable rows={due} showRequester />
    </div>
  );
}
