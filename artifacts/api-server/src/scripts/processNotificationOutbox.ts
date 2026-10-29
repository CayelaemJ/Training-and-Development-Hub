/**
 * Explicit, ONE-record operational dispatch. Never scheduled automatically.
 * Requires vetted and legally approved notification producer, installed DB
 * migration and verified sender credentials; all flags default OFF.
 */
import { pool } from "@workspace/db";
import { processOneApprovedNotice, quarantineExpiredLeases } from "../lib/notificationOutbox";

async function main() {
  if(process.env.CABO_NOTIFICATION_OUTBOX_ENABLED!=="true" ||
     process.env.CABO_NOTIFICATION_OUTBOX_WORKER_ENABLED!=="true") {
    throw new Error("Notification outbox worker is not approved");
  }
  const quarantined=await quarantineExpiredLeases();
  const status=await processOneApprovedNotice();
  // Only counts and bounded statuses: never print addresses or event IDs.
  process.stdout.write(JSON.stringify({status,quarantined,mode:"manual-single-delivery"})+"\n");
}
main().catch((error:unknown)=>{
  process.stderr.write("Notification outbox worker aborted: "+(error instanceof Error?error.name:"Unknown")+"\n");
  process.exitCode=2;
}).finally(async()=>{ await pool.end().catch(()=>undefined); });
