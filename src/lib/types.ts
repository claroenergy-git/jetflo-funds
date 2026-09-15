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

export type PoStatus =
  | "draft"
  | "pending_second_approval"
  | "open"
  | "partially_billed"
  | "fully_billed"
  | "cancelled";

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: "Draft",
  pending_second_approval: "Awaiting 2nd approval",
  open: "Open",
  partially_billed: "Partially billed",
  fully_billed: "Fully billed",
  cancelled: "Cancelled",
};

export const PO_STATUS_STYLE: Record<PoStatus, string> = {
  draft: "bg-[#f0ebd9] text-[#536658] border border-[#dcd4c0]",
  pending_second_approval: "bg-[#f3e8ff] text-[#6b21a8] border border-[#e9d5ff]",
  open: "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
  partially_billed: "bg-[#ccfbf1] text-[#115e59] border border-[#99f6e4]",
  fully_billed: "bg-[#d1fae5] text-[#065f46] font-bold border border-[#a7f3d0] shadow-sm",
  cancelled: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
};

export type ReceiveStatus = "pending" | "partially_received" | "received";

export const RECEIVE_STATUS_LABEL: Record<ReceiveStatus, string> = {
  pending: "GRN Pending",
  partially_received: "Partially Received",
  received: "Goods Received (100%)",
};

export const RECEIVE_STATUS_STYLE: Record<ReceiveStatus, string> = {
  pending: "bg-[#fef3c7] text-[#92400e] border border-[#fde68a]",
  partially_received: "bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]",
  received: "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
};

export type PaymentTerms =
  | "due_on_receipt"
  | "advance_100"
  | "split_30_70"
  | "net_15"
  | "net_30"
  | "net_45"
  | "net_60";

export const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  due_on_receipt: "Due on Receipt / Delivery",
  advance_100: "100% Advance (against PI)",
  split_30_70: "30% Advance + 70% against Dispatch",
  net_15: "Net 15 Days from Invoice",
  net_30: "Net 30 Days from Invoice",
  net_45: "Net 45 Days from Invoice",
  net_60: "Net 60 Days from Invoice",
};

export function formatPaymentTerms(term?: string | null): string {
  if (!term) return "Due on Receipt / Delivery";
  if (term in PAYMENT_TERMS_LABEL) return PAYMENT_TERMS_LABEL[term as PaymentTerms];
  return term;
}

export const DESTINATION_PLANTS = [
  "Hyderabad Plant",
  "Coimbatore Plant",
  "Solar Pump Project Site",
  "Central Warehouse",
];
