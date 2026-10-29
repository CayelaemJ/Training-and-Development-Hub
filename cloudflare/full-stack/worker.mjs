import {Container} from "@cloudflare/containers";
import {env as bindings} from "cloudflare:workers";
import {validateLearningHubCutover} from "./gate.mjs";

// This image builds the EXISTING workspace's Express API and training-platform
// React UI together. No static-only substitute for learner/parent/teacher flows.
export class LearningHubFullStack extends Container {
  defaultPort=3000;
  sleepAfter="20m";
  envVars={
    PORT:"3000",NODE_ENV:"production",TRUST_PROXY_HOPS:"1",
    FRONTEND_DIST_DIR:"artifacts/training-platform/dist/public",
    DATABASE_URL:bindings.CABO_LEARNING_DATABASE_URL,
    CABO_ALLOWED_ORIGINS:bindings.CABO_ALLOWED_ORIGINS,
    CABO_ENVIRONMENT:"cloudflare",
    ENABLE_CABO_DEMO_SEED:"false",
    CABO_GROQ_SMOKE_TEST:"false",
    // AI, OAuth, payments and messaging secrets must be separately verified,
    // not copied from unrelated projects or embedded in code.
  };
}
const noStore={"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow","Content-Type":"application/json; charset=utf-8"};
export default {
 async fetch(request,env) {
  const u=new URL(request.url),gate=validateLearningHubCutover(env,u.hostname);
  if(u.pathname==="/__migration/status")
   return new Response(JSON.stringify({product:"CABO Learning Hub",fullStackReady:gate.ready,
     privacyReview:env.CABO_CHILD_DATA_REVIEW_COMPLETE==="true",production:false}),{headers:noStore});
  if(!gate.ready)return new Response(JSON.stringify({error:"Learning Hub complete application deployment not enabled"}),{status:503,headers:noStore});
  try{return await env.CABO_LEARNING_CONTAINER.getByName("learning-hub").fetch(request);}
  catch{return new Response(JSON.stringify({error:"Learning Hub temporarily unavailable"}),{status:503,headers:noStore});}
 }
};
