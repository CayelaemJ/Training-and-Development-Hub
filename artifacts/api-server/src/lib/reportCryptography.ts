import {createHash,createPrivateKey,createPublicKey,sign,verify} from "node:crypto";
const context="CABO-SCHOOL-REPORT-V1";
export function canonicalJson(value:unknown):string{
 if(value===null||typeof value!=="object")return JSON.stringify(value);
 if(Array.isArray(value))return "["+value.map(canonicalJson).join(",")+"]";
 const record=value as Record<string,unknown>;
 const pairs=Object.keys(record).sort().filter(key=>record[key]!==undefined).map(key=>JSON.stringify(key)+":"+canonicalJson(record[key]));
 return "{"+pairs.join(",")+"}";
}
export function contentDigest(snapshot:unknown):string{
 return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}
export function signingPayload(org:number,learner:string,year:number,version:number,digest:string):Buffer{
 if(!Number.isSafeInteger(org)||!Number.isSafeInteger(year)||!Number.isSafeInteger(version)||!learner||!(/^[a-f0-9]{64}$/i.test(digest)))throw Error("Invalid signing payload");
 return Buffer.from([context,String(org),JSON.stringify(learner),String(year),String(version),digest.toLowerCase()].join("\n"),"utf8");
}
/** Requires a configured PKCS#8 DER Ed25519 private key in a server-only environment secret. */
export function configuredReportSigner(){
 const encoded=process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64;
 if(!encoded)return null;
 const key=createPrivateKey({key:Buffer.from(encoded,"base64"),format:"der",type:"pkcs8"});
 if(key.asymmetricKeyType!=="ed25519")throw Error("Only Ed25519 report keys are supported");
 const publicKey=createPublicKey(key);
 const publicDer=publicKey.export({format:"der",type:"spki"}) as Buffer;
 const keyId=createHash("sha256").update(publicDer).digest("hex").slice(0,32);
 return {keyId,signData:(data:Buffer)=>sign(null,data,key).toString("base64url"),publicKeyPem:publicKey.export({format:"pem",type:"spki"}).toString()};
}
export function verifyReportSignature(payload:Buffer,signature:string,publicKeyPem:string):boolean{
 try{
  const publicKey=createPublicKey(publicKeyPem);
  return publicKey.asymmetricKeyType==="ed25519"&&verify(null,payload,publicKey,Buffer.from(signature,"base64url"));
 }catch{return false}
}
