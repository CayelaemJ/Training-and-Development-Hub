import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Require exactly 32 secret bytes. Do not derive from a password. */
export function readOutboxKey(env:NodeJS.ProcessEnv=process.env): Buffer {
  const text=env.CABO_NOTIFICATION_OUTBOX_KEY?.trim();
  if (!text || !/^[A-Za-z0-9+/]{43}=$/.test(text)) throw new Error("Encrypted outbox key is missing");
  const key=Buffer.from(text,"base64");
  if (key.length!==32 || key.toString("base64")!==text) throw new Error("Encrypted outbox key is invalid");
  return key;
}
export function encryptRecipient(
  recipient:string,
  eventId:string,
  key:Buffer,
):string {
  if(!UUID.test(eventId) || key.length!==32 ||
      !/^[^\s@<>]{1,64}@[a-zA-Z0-9.-]{1,190}\.[a-zA-Z]{2,30}$/.test(recipient)){
    throw new Error("Recipient encryption requirements not met");
  }
  const nonce=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,nonce);
  cipher.setAAD(Buffer.from(eventId.toLowerCase()));
  const payload=Buffer.concat([cipher.update(recipient,"utf8"),cipher.final()]);
  return ["v1",nonce.toString("base64url"),payload.toString("base64url"),cipher.getAuthTag().toString("base64url")].join(".");
}
export function decryptRecipient(
  encoded:string,
  eventId:string,
  key:Buffer,
):string {
  if(key.length!==32 || !UUID.test(eventId) || encoded.length>2048) throw new Error("Invalid protected recipient");
  const parts=encoded.split(".");
  if(parts.length!==4 || parts[0]!=="v1") throw new Error("Unsupported recipient encoding");
  const [nonce,content,tag]=parts.slice(1).map(x=>Buffer.from(x,"base64url"));
  if(nonce.length!==12 || tag.length!==16 || content.length===0) throw new Error("Invalid protected recipient");
  try {
    const decipher=createDecipheriv("aes-256-gcm",key,nonce);
    decipher.setAAD(Buffer.from(eventId.toLowerCase()));
    decipher.setAuthTag(tag);
    const plain=Buffer.concat([decipher.update(content),decipher.final()]).toString("utf8");
    if(!/^[^\s@<>]{1,64}@[a-zA-Z0-9.-]{1,190}\.[a-zA-Z]{2,30}$/.test(plain)) throw Error();
    return plain;
  } catch { throw new Error("Protected recipient authentication failed"); }
}
