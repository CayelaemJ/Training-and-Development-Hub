/**
 * Explicit, ONE-record operational dispatch. Each send is re-authorized by
 * currentNoticeAuthorization (live recipient, school, consent and source).
 * Automatic delivery is the separate, opt-in lib/outboxDispatcher.ts.
 */
import { pool } from "@workspace/db";
import { processOneApprovedNotice, quarantineExpiredLeases } from "../lib/notificationOutbox";
import { currentNoticeAuthorization } from "../lib/currentNotificationAuthorization";

async function main() {
  if(process.env.CABO_NOTIFICATION_OUTBOX_ENABLED!=="true" ||
     process.env.CABO_NOTIFICATION_OUTBOX_WORKER_ENABLED!=="true") {
    throw new Error("Notification outbox worker is not approved");
  }
  const quarantined=await quarantineExpiredLeases();
  // Every send re-checks recipient, school, guardian consent and source now.
  const status=await processOneApprovedNotice(currentNoticeAuthorization);
  // Only counts and bounded statuses: never print addresses or event IDs.
  process.stdout.write(JSON.stringify({status,quarantined,mode:"manual-single-delivery"})+"\n");
}
main().catch((error:unknown)=>{
  process.stderr.write("Notification outbox worker aborted: "+(error instanceof Error?error.name:"Unknown")+"\n");
  process.exitCode=2;
}).finally(async()=>{ await pool.end().catch(()=>undefined); });
