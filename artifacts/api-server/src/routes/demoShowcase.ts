import {Router,type IRouter} from "express";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {seedPresentationDemo} from "../scripts/seedPresentationDemo";
const router:IRouter=Router();
let running=false;
router.post("/platform/demo/seed",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)||process.env.RAILWAY_ENVIRONMENT_NAME!=="testing"){res.sendStatus(403);return}
 if(running){res.status(409).json({error:"A demo seed is already running"});return}
 running=true;
 try{await seedPresentationDemo();res.json({ok:true,message:"Synthetic CABO demo records seeded into isolated testing database"})}
 catch(e){console.error("Synthetic demo seed failed",e);res.status(500).json({error:"Unable to prepare the demo dataset. Review server logs."})}
 finally{running=false}
});
export default router;