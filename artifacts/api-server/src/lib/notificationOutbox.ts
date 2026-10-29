import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, notificationOutboxTable, notificationEventSourcesTable } from "@workspace/db";
import { currentSourceAuthorization } from "./currentNotificationAuthorization";
import type { NoticeSource } from "./notificationEligibility";
import { composeSafeNotice, noticesEnabled, sendTransactionalNotice, type NoticeInput } from "./transactionalNotices";
import { decryptRecipient, encryptRecipient, readOutboxKey } from "./outboxCrypto";

/** No public HTTP route calls this module. Authorization belongs to the producer. */
export async function enqueueApprovedNotice(
  args: NoticeInput & { recipientUserId: string; organizationId: number; source:NoticeSource },
  env: NodeJS.ProcessEnv = process.env,
):Promise<"queued"|"duplicate"|"disabled"> {
  if (env.CABO_NOTIFICATION_OUTBOX_ENABLED!=="true") return "disabled";
  composeSafeNotice(args);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(args.recipientUserId) ||
      (!Number.isSafeInteger(args.organizationId) || args.organizationId<1)) {
    throw new Error("Notification recipient authorization context is invalid");
  }
  if(!await currentSourceAuthorization({eventId:args.eventId,recipientUserId:args.recipientUserId,
    organizationId:args.organizationId,kind:args.kind,to:args.to},args.source)) {
    throw new Error("Current notification recipient or guardian consent is not verified");
  }
  const recipientCiphertext=encryptRecipient(args.to.trim(),args.eventId,readOutboxKey(env));
  return db.transaction(async tx=>{
    const inserted=await tx.insert(notificationOutboxTable).values({
      eventId:args.eventId.toLowerCase(),recipientUserId:args.recipientUserId,
      organizationId:args.organizationId,recipientCiphertext,
      kind:args.kind,status:"queued",
    }).onConflictDoNothing({target:notificationOutboxTable.eventId}).returning({id:notificationOutboxTable.id});
    if(!inserted.length)return "duplicate" as const;
    await tx.insert(notificationEventSourcesTable).values({
      eventId:args.eventId.toLowerCase(),sourceKind:args.source.kind,sourceId:args.source.id,
    });
    return "queued" as const;
  });
}

type Claim = {
  id:number; eventId:string; recipientCiphertext:string; recipientUserId:string; organizationId:number|null;
  kind:NoticeInput["kind"]; leaseToken:string;
};
async function claimOne():Promise<Claim|null> {
  return db.transaction(async tx=>{
    const [candidate]=await tx.select({
      id:notificationOutboxTable.id,eventId:notificationOutboxTable.eventId,
      kind:notificationOutboxTable.kind,
      recipientUserId:notificationOutboxTable.recipientUserId,
      organizationId:notificationOutboxTable.organizationId,
      recipientCiphertext:notificationOutboxTable.recipientCiphertext,
    }).from(notificationOutboxTable)
      .where(eq(notificationOutboxTable.status,"queued"))
      .orderBy(asc(notificationOutboxTable.createdAt),asc(notificationOutboxTable.id))
      .for("update",{skipLocked:true}).limit(1);
    if(!candidate) return null;
    const token=randomUUID(),until=new Date(Date.now()+120_000);
    await tx.update(notificationOutboxTable).set({
      status:"leased",leaseToken:token,leaseUntil:until,
      updatedAt:new Date(),attempts:sql`attempts + 1`,
    }).where(eq(notificationOutboxTable.id,candidate.id));
    if(!["guardian_review_requested","learner_support_updated","account_security"].includes(candidate.kind)) {
      throw new Error("Unexpected outbox event kind");
    }
    return {...candidate,kind:candidate.kind as NoticeInput["kind"],leaseToken:token};
  });
}

async function finish(
  claim:Claim,
  status:"sent"|"needs_review",
  errorCode:string|null,
):Promise<void> {
  const changed=await db.update(notificationOutboxTable).set({
    status,errorCode,leaseToken:null,leaseUntil:null,updatedAt:new Date(),
    sentAt:status==="sent"?new Date():null,
  }).where(and(
    eq(notificationOutboxTable.id,claim.id),
    eq(notificationOutboxTable.status,"leased"),
    eq(notificationOutboxTable.leaseToken,claim.leaseToken),
  )).returning({id:notificationOutboxTable.id});
  if(!changed.length) throw new Error("Notification lease changed; investigate before retry");
}

export type OutboxDeliveryResult="idle"|"sent"|"needs_review"|"disabled";
export type DispatchAuthorization = (row:{ eventId:string; recipientUserId:string; organizationId:number|null; kind:NoticeInput["kind"]; to:string })=>Promise<boolean>;
export async function processOneApprovedNotice(
  authorize:DispatchAuthorization|undefined,
  fetcher:typeof fetch=fetch,
  env:NodeJS.ProcessEnv=process.env,
):Promise<OutboxDeliveryResult> {
  if(!authorize || env.CABO_NOTIFICATION_OUTBOX_WORKER_ENABLED!=="true" ||
     env.CABO_NOTIFICATION_OUTBOX_ENABLED!=="true" ||
     !noticesEnabled(env)) return "disabled";
  const key=readOutboxKey(env);
  const claim=await claimOne();
  if(!claim) return "idle";
  try {
    // Always revalidate tenant, guardian/legal consent and preferences *now*.
    // Missing or revoked authorization cannot send; never trust only enqueue-time approval.
    const address=decryptRecipient(claim.recipientCiphertext,claim.eventId,key);
    const permitted=await authorize({eventId:claim.eventId,recipientUserId:claim.recipientUserId,
      organizationId:claim.organizationId,kind:claim.kind,to:address});
    if(!permitted){await finish(claim,"needs_review","authorization_revoked");return "needs_review";}
    const result=await sendTransactionalNotice({
      to:address,eventId:claim.eventId,kind:claim.kind,deliveryApproved:true,
    },fetcher,env);
    if(result==="accepted") {
      await finish(claim,"sent",null);
      return "sent";
    }
    await finish(claim,"needs_review",result==="deduplicated"?"already_reserved":"quota_or_disabled");
    return "needs_review";
  } catch {
    // Provider may have accepted the request before timeout: never auto-retry.
    await finish(claim,"needs_review","delivery_uncertain");
    return "needs_review";
  }
}

/** Expired leases are quarantined, never automatically retried. */
export async function quarantineExpiredLeases():Promise<number> {
  const expired=await db.update(notificationOutboxTable).set({
    status:"needs_review",errorCode:"lease_expired",leaseToken:null,
    leaseUntil:null,updatedAt:new Date(),
  }).where(and(
    eq(notificationOutboxTable.status,"leased"),
    sql`lease_until < NOW()`,
  )).returning({id:notificationOutboxTable.id});
  return expired.length;
}
