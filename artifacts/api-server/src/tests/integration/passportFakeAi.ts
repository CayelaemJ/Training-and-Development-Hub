// Synthetic, deterministic test provider: no real AI credentials, network or learner data leave the test process.
export function hasAiProvider(){return true}
export async function completeAIJson<T>(args:{validate:(data:unknown)=>T}):Promise<{modelId:string;value:T}>{
 const value=args.validate({
  summary:"The self-reported skill describes a practical attempt and can be explored further.",
  practiceSuggestion:"Explain the work to another learner, capture a safe demonstration and ask for feedback.",
  limitations:"This is an unverified reflection. No assessor observed the skill and no qualification was issued."
 });
 return {value,modelId:"synthetic-test-model"};
}
