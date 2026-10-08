import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, learnerIdentitiesTable, learnerJourneysTable, learnerMilestonesTable } from "@workspace/db";
const router:IRouter=Router();
const positive=z.coerce.number().int().positive();
function user(req:any,res:any):string|null{if(!req.isAuthenticated()){res.status(401).json({error:"Authentication required"});return null}return req.user.id}
const stage=z.enum(["RR","R",...Array.from({length:12},(_,i)=>String(i+1)),"university","college","training","professional"] as [string,...string[]]);
const journey=z.object({institutionName:z.string().trim().min(2).max(160),stage,academicYear:z.number().int().min(1900).max(2200),note:z.string().max(2000).default("")});
const milestone=z.object({title:z.string().trim().min(2).max(160),description:z.string().trim().min(10).max(4000),kind:z.enum(["academic","project","community","creative","technical","personal_growth","other"]),year:z.number().int().min(1900).max(2200)});
router.get("/learner-journey/me",async(req,res)=>{
 const uid=user(req,res);if(!uid)return;
 const [identity]=await db.select().from(learnerIdentitiesTable).where(eq(learnerIdentitiesTable.userId,uid)).limit(1);
 const [journeys,milestones]=await Promise.all([
 db.select().from(learnerJourneysTable).where(eq(learnerJourneysTable.userId,uid)).orderBy(desc(learnerJourneysTable.academicYear)),
 db.select().from(learnerMilestonesTable).where(eq(learnerMilestonesTable.userId,uid)).orderBy(desc(learnerMilestonesTable.year))
 ]);
 res.json({identity:identity??{userId:uid,displayName:""},journeys,milestones});
});
router.put("/learner-journey/me",async(req,res)=>{
 const uid=user(req,res);if(!uid)return;const body=z.object({displayName:z.string().trim().max(160)}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const [row]=await db.insert(learnerIdentitiesTable).values({userId:uid,...body.data}).onConflictDoUpdate({target:learnerIdentitiesTable.userId,set:{...body.data,updatedAt:new Date()}}).returning();
 res.json(row);
});
router.post("/learner-journey/entries",async(req,res)=>{
 const uid=user(req,res);if(!uid)return;const body=journey.safeParse(req.body);if(!body.success){res.status(400).json({error:"Invalid learning history entry"});return}
 const [row]=await db.insert(learnerJourneysTable).values({...body.data,userId:uid,source:"self_report"}).returning();res.status(201).json(row);
});
router.delete("/learner-journey/entries/:id",async(req,res)=>{
 const uid=user(req,res);if(!uid)return;const id=positive.safeParse(req.params.id);if(!id.success){res.sendStatus(400);return}
 await db.delete(learnerJourneysTable).where(and(eq(learnerJourneysTable.id,id.data),eq(learnerJourneysTable.userId,uid)));res.status(204).end();
});
router.post("/learner-journey/milestones",async(req,res)=>{
 const uid=user(req,res);if(!uid)return;const body=milestone.safeParse(req.body);if(!body.success){res.status(400).json({error:"Invalid milestone"});return}
 const [row]=await db.insert(learnerMilestonesTable).values({...body.data,userId:uid,source:"self_report"}).returning();res.status(201).json(row);
});
router.delete("/learner-journey/milestones/:id",async(req,res)=>{
 const uid=user(req,res);if(!uid)return;const id=positive.safeParse(req.params.id);if(!id.success){res.sendStatus(400);return}
 await db.delete(learnerMilestonesTable).where(and(eq(learnerMilestonesTable.id,id.data),eq(learnerMilestonesTable.userId,uid)));res.status(204).end();
});
export default router;