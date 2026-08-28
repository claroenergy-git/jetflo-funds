export type Role = "requester" | "finance" | "leadership";

export type Status =
  | "draft"
  | "submitted"
  | "sent_back"
  | "awaiting_second_approval"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "paid"
  | "closed";

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  submitted: "Submitted",
  sent_back: "Sent back",
  awaiting_second_approval: "Awaiting 2nd approval",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  paid: "Paid",
  closed: "Closed",
};

export const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-white/5 text-[#94A3B8] border border-white/10",
  submitted: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
  sent_back: "bg-orange-500/10 text-orange-300 border border-orange-500/30",
  awaiting_second_approval: "bg-purple-500/10 text-purple-300 border border-purple-500/30",
  approved: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
  partially_approved: "bg-teal-500/10 text-teal-300 border border-teal-500/30",
  rejected: "bg-red-500/10 text-red-300 border border-red-500/30",
  paid: "bg-emerald-400/15 text-emerald-200 font-semibold border border-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  closed: "bg-slate-800/60 text-slate-400 border border-slate-700/60",
};



export const CATEGORY_LABEL: Record<string, string> = {
  capex: "CAPEX — Plant Setup",
  raw_material: "Raw Material",
};

export const URGENCY_STYLE: Record<string, string> = {
  normal: "text-slate-500",
  urgent: "text-amber-600 font-medium",
  critical: "text-red-600 font-semibold",
};

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  plant: string;
}
