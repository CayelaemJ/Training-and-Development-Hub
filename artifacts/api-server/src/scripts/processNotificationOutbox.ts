/**
 * Explicit, ONE-record operational dispatch. Never scheduled automatically.
 * Intentionally cannot send until a trustworthy recipient/guardian consent
 * authorizer is wired. Inspects/quarantines expired leases only, when opted in.
 */
import { pool } from "@workspace/db";
import { processOneApprovedNotice, quarantineExpiredLeases } from "../lib/notificationOutbox";

async function main() {
  if(process.env.CABO_NOTIFICATION_OUTBOX_ENABLED!=="true" ||
     process.env.CABO_NOTIFICATION_OUTBOX_WORKER_ENABLED!=="true") {
    throw new Error("Notification outbox worker is not approved");
  }
  const quarantined=await quarantineExpiredLeases();
  // No trusted recipient/guardian authorizer has been wired yet: dispatch stays disabled.
  const status=await processOneApprovedNotice(undefined);
  // Only counts and bounded statuses: never print addresses or event IDs.
  process.stdout.write(JSON.stringify({status,quarantined,mode:"manual-single-delivery"})+"\n");
}
main().catch((error:unknown)=>{
  process.stderr.write("Notification outbox worker aborted: "+(error instanceof Error?error.name:"Unknown")+"\n");
  process.exitCode=2;
}).finally(async()=>{ await pool.end().catch(()=>undefined); });
