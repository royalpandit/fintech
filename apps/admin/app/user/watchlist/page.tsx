import { cookies } from "next/headers";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import WatchlistPageClient from "@/components/watchlist/watchlist-page-client";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  if (!isAuthed) {
    return (
      <section>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Watchlist</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
            Sign in to save your watchlists
          </p>
        </div>
        <AuthGate
          isAuthenticated={false}
          promptTitle="Sign in to save your watchlist"
          promptDescription="Track stocks and options you care about — the same lists appear in Markets and here."
        >
          <span />
        </AuthGate>
      </section>
    );
  }

  return <WatchlistPageClient />;
}
