"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function UsersFilters({
  initialQ,
  initialRole,
  initialStatus,
}: {
  initialQ: string;
  initialRole: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);

  const apply = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    const query = params.toString();
    router.push(`/super-admin/users${query ? `?${query}` : ""}`);
  };

  const reset = () => {
    setQ("");
    setRole("");
    setStatus("");
    router.push("/super-admin/users");
  };

  return (
    <form onSubmit={apply}>
      <article className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 150px 160px auto auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="Filter by name, email, or phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="advisor">Advisor</option>
            <option value="user">User</option>
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <button
            type="button"
            className="input"
            style={{ width: "auto", padding: "12px 18px" }}
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </article>
    </form>
  );
}
