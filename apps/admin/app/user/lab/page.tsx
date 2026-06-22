import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The lab is now the Financial AI Agents hub — users interact with our Gemini
// agents here. Paper-trading lives on the Wallet/Portfolio pages.
export default function VirtualLabPage() {
  redirect("/user/lab/agents");
}
