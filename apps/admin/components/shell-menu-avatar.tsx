/**
 * The 42px avatar in a shell's account-menu header. The advisor, super-admin and
 * moderator dropdowns showed only name + email, so an uploaded profile picture
 * appeared in the topbar button and then vanished one row below it. This renders
 * the photo when there is one and falls back to initials on the shell's own
 * brand gradient.
 */
export default function ShellMenuAvatar({
  src,
  initials,
  gradient,
}: {
  src?: string | null;
  initials: string;
  gradient: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        flexShrink: 0,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: gradient,
        color: "#fff",
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        initials
      )}
    </div>
  );
}
