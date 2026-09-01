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
  draft: "bg-[#f0ebd9] text-[#536658] border border-[#dcd4c0]",
  submitted: "bg-[#fef3c7] text-[#92400e] border border-[#fde68a]",
  sent_back: "bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]",
  awaiting_second_approval: "bg-[#f3e8ff] text-[#6b21a8] border border-[#e9d5ff]",
  approved: "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
  partially_approved: "bg-[#ccfbf1] text-[#115e59] border border-[#99f6e4]",
  rejected: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
  paid: "bg-[#d1fae5] text-[#065f46] font-bold border border-[#a7f3d0] shadow-sm",
  closed: "bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]",
};

export const CATEGORY_LABEL: Record<string, string> = {
  capex: "CAPEX — Plant Setup",
  raw_material: "Raw Material",
};

export const URGENCY_STYLE: Record<string, string> = {
  normal: "text-[#536658]",
  urgent: "text-[#b45309] font-semibold",
  critical: "text-[#b91c1c] font-bold",
};

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  plant: string;
}
