"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiX, FiPaperclip, FiFile } from "react-icons/fi";

// Analyst broadcast composer. Sends one message to all active subscribers, each
// delivered into their private chat. See MESSAGES-CHANGES.md.
export default function BroadcastComposer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [services, setServices] = useState<{ id: number; name: string; subscriberCount: number }[]>([]);
  // Empty selection = All subscribers.
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [delivery, setDelivery] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [attachment, setAttachment] = useState<{ url: string; type: "image" | "file"; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the analyst's services for the recipient groups.
  useEffect(() => {
    fetch("/api/v1/advisor/services")
      .then((r) => r.json())
      .then((d) => setServices(d.data ?? []))
      .catch(() => setServices([]));
  }, []);

  // Recipient count updates as the selection changes.
  useEffect(() => {
    const qs = selectedServices.length ? `?serviceIds=${selectedServices.join(",")}` : "";
    setRecipientCount(null);
    fetch(`/api/v1/advisor/broadcasts${qs}`)
      .then((r) => r.json())
      .then((d) => setRecipientCount(d.recipientCount ?? 0))
      .catch(() => setRecipientCount(0));
  }, [selectedServices]);

  const toggleService = (id: number) =>
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/messages/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.status === false) {
        setError(json.error || "Upload failed");
        return;
      }
      setAttachment({ url: json.url, type: json.type, name: json.name });
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (loading || uploading) return;
    setError("");
    setDone("");
    if (delivery === "schedule" && !scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/advisor/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || undefined,
          scheduledAt: delivery === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          serviceIds: selectedServices.length ? selectedServices : undefined,
          attachmentUrl: attachment?.url,
          attachmentType: attachment?.type,
          attachmentName: attachment?.name,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status === false) {
        setError(json.error || "Failed to send broadcast");
        setLoading(false);
        return;
      }
      setDone(
        json.sent
          ? `Broadcast delivered to ${json.recipientCount} subscribers.`
          : `Broadcast scheduled for ${json.recipientCount} subscribers.`,
      );
      setContent("");
      setAttachment(null);
      router.refresh();
      setTimeout(onClose, 1200);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="bc-overlay" role="dialog" aria-label="New broadcast" onClick={onClose}>
      <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bc-head">
          <h3>New Broadcast</h3>
          <button type="button" className="bc-close" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="bc-body">
          {/* Recipient groups (dynamic from the analyst's services) */}
          {services.length > 0 && (
            <div>
              <label className="metric-label">Recipients</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedServices([])}
                  className={`bc-recip-chip${selectedServices.length === 0 ? " active" : ""}`}
                >
                  All Subscribers
                </button>
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`bc-recip-chip${selectedServices.includes(s.id) ? " active" : ""}`}
                  >
                    {s.name} ({s.subscriberCount})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bc-recipients">
            <span>Sending to</span>
            <strong>
              {recipientCount == null ? "…" : `${recipientCount.toLocaleString("en-IN")} Subscribers`}
            </strong>
          </div>

          <textarea
            className="bc-textarea"
            placeholder="Write a message to all your subscribers…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />

          {attachment && (
            <div className="bc-attachment">
              {attachment.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.url} alt="" />
              ) : (
                <FiFile size={18} />
              )}
              <span>{attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} aria-label="Remove">
                <FiX size={14} />
              </button>
            </div>
          )}

          <div className="bc-toolbar">
            <button type="button" className="bc-attach" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FiPaperclip size={15} /> {uploading ? "Uploading…" : "Attach"}
            </button>
            <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onChange={onPick} />
          </div>

          <div className="bc-delivery">
            <label className={delivery === "now" ? "active" : ""}>
              <input type="radio" checked={delivery === "now"} onChange={() => setDelivery("now")} /> Send Now
            </label>
            <label className={delivery === "schedule" ? "active" : ""}>
              <input type="radio" checked={delivery === "schedule"} onChange={() => setDelivery("schedule")} /> Schedule
            </label>
          </div>
          {delivery === "schedule" && (
            <input
              className="bc-schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          )}

          {error && <p className="bc-error">{error}</p>}
          {done && <p className="bc-done">{done}</p>}
        </div>

        <footer className="bc-foot">
          <button type="button" className="bc-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="bc-send" onClick={send} disabled={loading || uploading || recipientCount === 0}>
            {loading ? "Sending…" : delivery === "schedule" ? "Schedule Broadcast" : "Send Broadcast"}
          </button>
        </footer>
      </div>
    </div>
  );
}
