import { Router, type IRouter } from "express";
import { timingSafeEqual, scryptSync } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { createSession, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
const router:IRouter=Router();
router.post("/test-auth/login",async(req,res)=>{
 if(process.env.ENABLE_RAILWAY_TEST_LOGIN!=="true"){res.sendStatus(404);return}
 const body=z.object({username:z.string().min(1).max(100),password:z.string().min(1).max(200)}).safeParse(req.body);
 if(!body.success){res.status(400).json({error:"Invalid credentials"});return}
 const expected=process.env.RAILWAY_TEST_PASSWORD_SCRYPT??"";
 const parts=expected.split(":");
 let valid=false;
 if(parts.length===2&&/^[a-f0-9]{32}$/.test(parts[0])&&/^[a-f0-9]{128}$/.test(parts[1])){
   const actual=scryptSync(body.data.password,Buffer.from(parts[0],"hex"),64);
   const expectedHash=Buffer.from(parts[1],"hex");
   valid=timingSafeEqual(actual,expectedHash)&&body.data.username===process.env.RAILWAY_TEST_USERNAME;
 }
 if(!valid){res.status(401).json({error:"Incorrect username or password"});return}
 const email="cabo-railway-pilot@localhost.invalid";
 const [person]=await db.insert(usersTable).values({id:"cabo-railway-test-user",email,firstName:"CABO",lastName:"Test"}).onConflictDoUpdate({target:usersTable.id,set:{firstName:"CABO",lastName:"Test"}}).returning();
 const sid=await createSession({user:{id:person.id,email:person.email,firstName:person.firstName,lastName:person.lastName,profileImageUrl:person.profileImageUrl},access_token:"local-test-session"});
 res.cookie(SESSION_COOKIE,sid,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:SESSION_TTL});
 res.json({ok:true});
});
router.post("/test-auth/logout",async(req,res)=>{const {getSessionId,clearSession}=await import("../lib/auth");await clearSession(res,getSessionId(req));res.json({ok:true})});
export default router;