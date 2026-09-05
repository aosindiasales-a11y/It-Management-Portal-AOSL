/**
 * Runs once when the Next.js server starts. Used here to schedule a daily
 * automatic database backup — the simplest possible "automatic backup"
 * implementation for a single-process app like this one (no cron/queue
 * infrastructure needed).
 *
 * Deliberately does NOT touch the mail service here: this project has
 * middleware.ts (Edge runtime), which makes Next.js also edge-compile
 * instrumentation.ts, and nodemailer's dependency tree (stream/http/...)
 * isn't edge-safe — even a NEXT_RUNTIME-guarded dynamic import still gets
 * pulled into that edge bundle. The SMTP startup check instead lives in
 * src/lib/mail/verify-on-boot.ts, called once from the (Node-only) portal
 * layout — see that file for details.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isRemoteDatabaseConfigured } = await import("@/lib/database-config");
  if (isRemoteDatabaseConfigured()) return;

  const ONE_DAY_MS = 1000 * 60 * 60 * 24;

  const { createBackup } = await import("@/lib/backup");

  const runAutoBackup = () => {
    createBackup("auto").catch((err) => {
      console.error("[auto-backup] failed:", err);
    });
  };

  // Take one shortly after startup (covers "app only runs a few hours a day"
  // usage), then keep repeating every 24 hours for as long as the process is up.
  setTimeout(runAutoBackup, 60_000);
  setInterval(runAutoBackup, ONE_DAY_MS);
}
