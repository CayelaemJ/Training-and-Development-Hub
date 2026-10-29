import { createHash } from "node:crypto";

/**
 * Small, consent-gated transactional delivery primitive.
 * No public send endpoint is mounted: callers must validate recipient,
 * lawful purpose and organisation membership before invoking this module.
 */
export type NoticeKind = "guardian_review_requested" | "learner_support_updated" | "account_security";
export type NoticeOutcome = "accepted" | "deduplicated" | "disabled" | "limit_reached";
export type NoticeInput = {
  to: string;
  eventId: string;
  kind: NoticeKind;
  /** Caller confirms server-side consent and permitted notification policy. */
  deliveryApproved: boolean;
};
type Env = NodeJS.ProcessEnv;
const EMAIL_API = "https://api.resend.com/emails";
const EMAIL_RE = /^[^\s@<>]{1,64}@[a-zA-Z0-9.-]{1,190}\.[a-zA-Z]{2,30}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const subjects: Record<NoticeKind,{subject:string;body:string}> = {
  guardian_review_requested: {
    subject:"CABO Learning Hub — action in your account",
    body:"A request needs your attention in CABO Learning Hub. Sign in directly using your usual CABO application link to review it. Do not reply with identity documents or sensitive information.",
  },
  learner_support_updated: {
    subject:"CABO Learning Hub — learning support update",
    body:"An update is available in your CABO Learning Hub account. Open the application directly and sign in to review it. No learner details are included in this email.",
  },
  account_security: {
    subject:"CABO Learning Hub — security notification",
    body:"A security-related update is available in your CABO Learning Hub account. Open the application directly to review your account. Never share passwords, one-time codes or identity documents by email.",
  },
};

export function noticesEnabled(env:Env=process.env):boolean {
  return env.CABO_TRANSACTIONAL_EMAIL_ENABLED==="true" &&
    !!env.RESEND_API_KEY?.trim() &&
    !!env.CABO_FROM_EMAIL?.trim() &&
    EMAIL_RE.test(env.CABO_FROM_EMAIL.trim()) &&
    !!env.UPSTASH_REDIS_REST_URL?.startsWith("https://") &&
    !!env.UPSTASH_REDIS_REST_TOKEN?.trim();
}
export function composeSafeNotice(input:NoticeInput) {
  if (!EMAIL_RE.test(input.to) || !UUID_RE.test(input.eventId) ||
      !Object.hasOwn(subjects,input.kind) || !input.deliveryApproved) {
    throw new Error("Notification eligibility or delivery consent is missing");
  }
  return {to:input.to.trim(),...subjects[input.kind]};
}

const RESERVE = [
  "if redis.call('EXISTS',KEYS[1])==1 then return 2 end",
  "if tonumber(redis.call('GET',KEYS[2]) or '0')>=tonumber(ARGV[1]) then return 0 end",
  "if tonumber(redis.call('GET',KEYS[3]) or '0')>=tonumber(ARGV[2]) then return 0 end",
  "redis.call('SET',KEYS[1],'1','EX',172800)",
  "local d=redis.call('INCR',KEYS[2]); if d==1 then redis.call('EXPIRE',KEYS[2],172800) end",
  "local m=redis.call('INCR',KEYS[3]); if m==1 then redis.call('EXPIRE',KEYS[3],3024000) end",
  "return 1",
].join("\n");

export async function sendTransactionalNotice(
  input: NoticeInput,
  fetcher:typeof fetch=fetch,
  env:Env=process.env,
  now:Date=new Date(),
):Promise<NoticeOutcome> {
  if (!noticesEnabled(env)) return "disabled";
  const notice=composeSafeNotice(input);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid send clock");
  const origin=new URL(env.UPSTASH_REDIS_REST_URL!);
  if (origin.protocol!=="https:" || origin.username || origin.password || origin.pathname!=="/" ||
      origin.search || origin.hash) throw new Error("Invalid Redis endpoint");
  const date=now.toISOString();
  const month=date.slice(0,7),day=date.slice(0,10);
  // No recipient email, user ID, name or school enters a Redis key or a log.
  const fingerprint=createHash("sha256").update(input.eventId).update("\0")
    .update(input.to.trim().toLowerCase()).digest("hex");
  const prefix=(env.CABO_REDIS_PREFIX||"cabo-learning").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,48);
  const keys=[prefix+":notice:"+fingerprint,prefix+":notice-day:"+day,prefix+":notice-month:"+month];
  const reserve=await fetcher(origin.toString(),{
    method:"POST",
    headers:{"Authorization":"Bearer "+env.UPSTASH_REDIS_REST_TOKEN!.trim(),"Content-Type":"application/json"},
    body:JSON.stringify(["EVAL",RESERVE,"3",...keys,"75","1500"]),
    signal:AbortSignal.timeout(1800),
  });
  if (!reserve.ok) throw new Error("Notification protection unavailable");
  const result:unknown=await reserve.json();
  if (!result || typeof result!=="object" || !("result" in result)) throw new Error("Invalid notification quota response");
  const allowance=(result as {result:unknown}).result;
  if (allowance===0) return "limit_reached";
  if (allowance===2) return "deduplicated"; // Already reserved; never claim a new send.
  if (allowance!==1) throw new Error("Unverified notification quota state");

  const sent=await fetcher(EMAIL_API,{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+env.RESEND_API_KEY!.trim(),
      "Content-Type":"application/json",
      "Idempotency-Key":"cabo-"+fingerprint,
    },
    body:JSON.stringify({
      from:env.CABO_FROM_EMAIL!.trim(),to:[notice.to],
      subject:notice.subject,text:notice.body,
    }),
    signal:AbortSignal.timeout(4500),
  });
  if (!sent.ok) {
    // Quota reservation intentionally remains, to avoid surprise retries.
    // A durable outbox and operator-reviewed retry path are still required.
    throw new Error("Transactional email provider unavailable");
  }
  return "accepted";
}
