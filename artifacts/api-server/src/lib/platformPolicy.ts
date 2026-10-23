/** Only allow explicit superadmin elevation on a declared isolated dummy-data testing deployment. */
export function isTestSuperadmin(userId:string,env:Record<string,string|undefined>):boolean{
 return (env.CABO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME)==="testing" &&
   env.ENABLE_CABO_SUPERADMIN==="true" &&
   env.CABO_TEST_DATABASE_ISOLATED==="true" &&
   typeof env.CABO_SUPERADMIN_USER_ID==="string" &&
   env.CABO_SUPERADMIN_USER_ID.length>0 &&
   userId===env.CABO_SUPERADMIN_USER_ID;
}
