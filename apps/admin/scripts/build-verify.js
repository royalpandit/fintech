/**
 * `next build` that does not disturb a running `next dev`.
 *
 * Both commands write to the same output directory by default, so building
 * while the dev server is up replaces the dev chunks it is still serving. The
 * browser then 500s on things like
 * /_next/static/chunks/fallback/webpack.js, which only a dev build produces,
 * and the only cure is stopping dev, deleting the directory and starting again.
 *
 * next.config.js reads NEXT_DIST_DIR, so pointing it elsewhere keeps a
 * verification build entirely out of the dev server's way. The variable is set
 * here in JS rather than inline in the npm script because `VAR=x cmd` is not
 * valid syntax in cmd.exe, which is what npm uses on Windows.
 *
 * Next's own entry script is run under the current node binary rather than
 * through `npx`: Node refuses to spawn a `.cmd` shim without a shell (EINVAL,
 * tightened for CVE-2024-27980), and resolving the script sidesteps both that
 * and the cost of starting a shell.
 */
const { spawnSync } = require("node:child_process");

const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-verify" },
});

if (result.error) {
  console.error("[build:verify] could not start next build:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
