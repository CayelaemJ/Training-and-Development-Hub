import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, lifelongPreferencesTable, passportExternalLinksTable, passportCompetenciesTable } from "@workspace/db";
import { normalizeExternalEvidenceUrl, MASTERY_EXPLANATIONS } from "../lib/passportPolicy";

const router: IRouter = Router();
const positiveId = z.coerce.number().int().positive();
function me(req: Request, res: Response): string | null {
 if (!req.isAuthenticated()) { res.status(401).json({error:"Sign in to manage your private Learning Passport"}); return null; }
 return req.user!.id;
}
const preferencesInput = z.object({
 learningContext:z.enum(["school","adult_returning","professional","career_change","personal","lifelong"]),
 preferredLanguage:z.string().trim().max(24), learningGoal:z.string().trim().max(2000)
});
const linkInput=z.object({
 provider:z.string().trim().min(2).max(80),url:z.string().trim().min(10).max(2048),
 description:z.string().trim().max(2000).default(""),
 evidenceType:z.enum(["portfolio","project","social","learning","community","other"])
});
const competencyInput=z.object({
 skill:z.string().trim().min(2).max(120),
 category:z.enum(["technical","academic","creative","vocational","transferable","other"]),
 masteryLevel:z.number().int().min(0).max(4),
 demonstration:z.enum(["practical","project","assessment","portfolio","work_example","reflection","other"]),
 description:z.string().trim().min(10).max(3000),
 evidenceLinkId:z.number().int().positive().nullable().default(null)
});

router.get("/learning-passport/me",async(req,res)=>{
 const uid=me(req,res);if(!uid)return;
 res.setHeader("Cache-Control","private, no-store");
 const [prefs,links,skills]=await Promise.all([
  db.select().from(lifelongPreferencesTable).where(eq(lifelongPreferencesTable.userId,uid)).limit(1),
  db.select().from(passportExternalLinksTable).where(eq(passportExternalLinksTable.userId,uid)).orderBy(desc(passportExternalLinksTable.createdAt)).limit(100),
  db.select().from(passportCompetenciesTable).where(eq(passportCompetenciesTable.userId,uid)).orderBy(desc(passportCompetenciesTable.createdAt)).limit(100)
 ]);
 res.json({preferences:prefs[0]??{learningContext:"lifelong",preferredLanguage:"",learningGoal:""},links,competencies:skills,masteryExplanations:MASTERY_EXPLANATIONS});
});
router.put("/learning-passport/preferences",async(req,res)=>{
 const uid=me(req,res);if(!uid)return;const input=preferencesInput.safeParse(req.body);
 if(!input.success){res.status(400).json({error:"Check your learning context and goal"});return}
 const [row]=await db.insert(lifelongPreferencesTable).values({userId:uid,...input.data})
  .onConflictDoUpdate({target:lifelongPreferencesTable.userId,set:{...input.data,updatedAt:new Date()}}).returning();
 res.setHeader("Cache-Control","private, no-store");res.json(row);
});
router.post("/learning-passport/links",async(req,res)=>{
 const uid=me(req,res);if(!uid)return;const input=linkInput.safeParse(req.body);
 if(!input.success){res.status(400).json({error:"Check the evidence link and description"});return}
 const url=normalizeExternalEvidenceUrl(input.data.url);
 if(!url){res.status(400).json({error:"Enter a public HTTPS address, not a local/private network or account login URL"});return}
 try {
  const [row]=await db.insert(passportExternalLinksTable).values({
   userId:uid,provider:input.data.provider,url,description:input.data.description,evidenceType:input.data.evidenceType
  }).returning();
  res.status(201).json(row);
 }catch(error){
  if((error as {code?:string}).code==="23505"){res.status(409).json({error:"This link already belongs to your passport"});return}
  throw error;
 }
});
router.delete("/learning-passport/links/:id",async(req,res)=>{
 const uid=me(req,res);if(!uid)return;const parsed=positiveId.safeParse(req.params.id);
 if(!parsed.success){res.status(400).json({error:"Invalid link ID"});return}
 const removed=await db.delete(passportExternalLinksTable).where(and(eq(passportExternalLinksTable.id,parsed.data),eq(passportExternalLinksTable.userId,uid))).returning({id:passportExternalLinksTable.id});
 if(!removed.length){res.sendStatus(404);return}res.status(204).end();
});
router.post("/learning-passport/competencies",async(req,res)=>{
 const uid=me(req,res);if(!uid)return;const input=competencyInput.safeParse(req.body);
 if(!input.success){res.status(400).json({error:"Add a skill, evidence method and meaningful description"});return}
 if(input.data.evidenceLinkId!==null){
  const [owned]=await db.select({id:passportExternalLinksTable.id}).from(passportExternalLinksTable)
   .where(and(eq(passportExternalLinksTable.id,input.data.evidenceLinkId),eq(passportExternalLinksTable.userId,uid))).limit(1);
  if(!owned){res.status(400).json({error:"Select only one of your own evidence links"});return}
 }
 const [row]=await db.insert(passportCompetenciesTable).values({userId:uid,...input.data}).returning();
 res.status(201).json(row);
});
router.delete("/learning-passport/competencies/:id",async(req,res)=>{
 const uid=me(req,res);if(!uid)return;const parsed=positiveId.safeParse(req.params.id);
 if(!parsed.success){res.status(400).json({error:"Invalid competency ID"});return}
 const removed=await db.delete(passportCompetenciesTable).where(and(eq(passportCompetenciesTable.id,parsed.data),eq(passportCompetenciesTable.userId,uid))).returning({id:passportCompetenciesTable.id});
 if(!removed.length){res.sendStatus(404);return}res.status(204).end();
});
export default router;
