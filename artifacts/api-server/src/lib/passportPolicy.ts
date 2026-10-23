import { isIP } from "node:net";

/** User-controlled links: DO NOT fetch these URLs without a reviewed, isolated fetcher. */
export function normalizeExternalEvidenceUrl(value: string): string | null {
 if(value.length>2048 || /[\u0000-\u001f\u007f]/.test(value))return null;
 try{
  const url=new URL(value.trim());
  if(url.protocol!=="https:" || url.username || url.password || (url.port&&url.port!=="443"))return null;
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if(!host || host.length>253 || isIP(host) || !/^[a-z0-9.-]+$/.test(host) || !host.includes("."))return null;
  if(host.split(".").some(part=>!part||part.length>63||part.startsWith("-")||part.endsWith("-")))return null;
  if(["local","localhost","internal","test","invalid","onion"].some(s=>host===s||host.endsWith("."+s)))return null;
  return url.href;
 }catch{return null}
}

export const MASTERY_EXPLANATIONS=[
 "Not yet demonstrated: evidence is missing; this is not a judgement of ability.",
 "Exploring: emerging competence with substantial guidance.",
 "Developing: familiar tasks completed with some assistance.",
 "Independent: competency demonstrated reliably without assistance.",
 "Transferable mastery: skill adapted to unfamiliar situations and explained."
] as const;
