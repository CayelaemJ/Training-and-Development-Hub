import { processOneApprovedNotice, quarantineExpiredLeases } from "./notificationOutbox";
import { currentNoticeAuthorization } from "./currentNotificationAuthorization";
import { logger } from "./logger";

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Optional in-process delivery: every minute, send up to `batch` queued
 * notices, each re-authorized at send time (recipient, school, guardian
 * consent and source). Off unless CABO_NOTIFICATION_OUTBOX_AUTODISPATCH=true
 * in addition to the existing outbox, worker and email-provider switches.
 */
export function startOutboxDispatcher(env: NodeJS.ProcessEnv = process.env, batch = 10) {
  if (timer || env.CABO_NOTIFICATION_OUTBOX_AUTODISPATCH !== "true") return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await quarantineExpiredLeases();
      const counts: Record<string, number> = {};
      for (let i = 0; i < batch; i++) {
        const status = await processOneApprovedNotice(currentNoticeAuthorization);
        counts[status] = (counts[status] ?? 0) + 1;
        if (status === "idle" || status === "disabled") break;
      }
      if (counts.sent || counts.needs_review) logger.info({ counts }, "notification outbox dispatched");
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.name : "unknown" }, "notification outbox dispatch failed");
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref();
}
