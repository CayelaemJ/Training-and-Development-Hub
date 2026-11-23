import {Container} from "@cloudflare/containers";
import {env as bindings} from "cloudflare:workers";
import {learningHubContainerEnv, validateLearningHubCutover} from "./gate.mjs";

// This image builds the EXISTING workspace's Express API and training-platform
// React UI together. No static-only substitute for learner/parent/teacher flows.
export class LearningHubFullStack extends Container {
  defaultPort=3000;
  sleepAfter="20m";
  envVars = learningHubContainerEnv(bindings);
}
const noStore={"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow","Content-Type":"application/json; charset=utf-8"};
export default {
 async fetch(request,env) {
  const u=new URL(request.url),gate=validateLearningHubCutover(env,u.hostname);
  if(u.pathname==="/__migration/status")
   return new Response(JSON.stringify({product:"CABO Learning Hub",fullStackReady:gate.ready,
     failures:gate.failures,privacyReview:env.CABO_CHILD_DATA_REVIEW_COMPLETE==="true",production:false}),{headers:noStore});
  if(!gate.ready)return new Response(JSON.stringify({error:"Learning Hub complete application deployment not enabled"}),{status:503,headers:noStore});
  try{return await env.CABO_LEARNING_CONTAINER.getByName("learning-hub").fetch(request);}
  catch{return new Response(JSON.stringify({error:"Learning Hub temporarily unavailable"}),{status:503,headers:noStore});}
 }
};
