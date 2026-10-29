import { isRecentVerifiedMfa } from "./mfaAssurance";

/**
 * Explicit adult/guardian opt-in, never based on a browser boolean alone.
 * Missing provider evidence, wrong role, old SSO or child account -> deny.
 */
export type PreferenceKind="guardian_review_requested"|"learner_support_updated";
export type PreferenceActor="verified_guardian"|"assigned_educator";

export function isPreferenceKindAllowed(actor:PreferenceActor,kind:PreferenceKind):boolean{
  return (actor==="verified_guardian"&&kind==="guardian_review_requested") ||
    (actor==="assigned_educator"&&kind==="learner_support_updated");
}

export function canConfirmEmailPreference(args:{
  accountEmail:string|null;
  verifiedSessionEmail:string|undefined;
  recentMfa:unknown;
  actor:PreferenceActor;
  kind:PreferenceKind;
  acknowledge:boolean;
  nowSeconds?:number;
}):boolean{
  const current=(args.accountEmail??"").trim().toLowerCase();
  const trusted=(args.verifiedSessionEmail??"").trim().toLowerCase();
  return !!current && current===trusted &&
    args.acknowledge===true &&
    isPreferenceKindAllowed(args.actor,args.kind) &&
    isRecentVerifiedMfa(args.recentMfa,args.nowSeconds);
}
