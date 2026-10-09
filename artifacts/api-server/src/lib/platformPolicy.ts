/** Only allow explicit superadmin elevation on CABO's isolated Railway test deployment. */
export function isTestSuperadmin(userId:string,env:Record<string,string|undefined>):boolean{
 return env.RAILWAY_ENVIRONMENT_NAME==="testing" &&
   env.ENABLE_CABO_SUPERADMIN==="true" &&
   typeof env.CABO_SUPERADMIN_USER_ID==="string" &&
   env.CABO_SUPERADMIN_USER_ID.length>0 &&
   userId===env.CABO_SUPERADMIN_USER_ID;
}
