import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/data";

export default async function Home() {
  const profile = await requireProfile();
  if (profile.role === "finance") redirect("/finance/queue");
  if (profile.role === "leadership") redirect("/dashboard");
  redirect("/requests");
}
