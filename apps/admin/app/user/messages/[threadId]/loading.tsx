// Shown immediately while the thread's server component fetches. Without this
// Next.js blocks on the whole dynamic render before painting anything, which
// made opening a chat feel like it hung.
export default function ChatLoading() {
  return (
    <div className="dm-chat-root">
      <div className="dm-skel-header">
        <span className="dm-skel dm-skel-avatar" />
        <div style={{ flex: 1 }}>
          <span className="dm-skel" style={{ width: 140, height: 13, display: "block" }} />
          <span
            className="dm-skel"
            style={{ width: 70, height: 10, display: "block", marginTop: 6 }}
          />
        </div>
      </div>

      <div className="dm-skel-body">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="dm-skel-row"
            style={{ justifyContent: i % 2 ? "flex-end" : "flex-start" }}
          >
            {i % 2 === 0 && <span className="dm-skel dm-skel-bubble-av" />}
            <span
              className="dm-skel dm-skel-bubble"
              style={{ width: `${45 + ((i * 13) % 30)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="dm-skel-footer">
        <span className="dm-skel" style={{ width: 44, height: 44, borderRadius: 10 }} />
        <span className="dm-skel" style={{ width: 44, height: 44, borderRadius: 10 }} />
        <span className="dm-skel" style={{ flex: 1, height: 44, borderRadius: 10 }} />
        <span className="dm-skel" style={{ width: 44, height: 44, borderRadius: 10 }} />
      </div>
    </div>
  );
}
