import test from 'node:test';
import assert from 'node:assert/strict';
import {demoAdmissionsEnabled,syntheticCandidate,canAdvanceDemoApplication} from '../lib/demoAdmissionsPolicy.ts';
test('admissions simulation requires explicit Render test environment, isolated database and feature opt-in',()=>{
 const env={CABO_ENVIRONMENT:'testing',CABO_TEST_DATABASE_ISOLATED:'true',ENABLE_DEMO_ADMISSIONS_INBOX:'true'};
 assert.equal(demoAdmissionsEnabled(env),true);
 for(const key of Object.keys(env)) assert.equal(demoAdmissionsEnabled({...env,[key]:undefined}),false);
 assert.equal(demoAdmissionsEnabled({...env,CABO_ENVIRONMENT:'production'}),false);
 assert.equal(demoAdmissionsEnabled({...env,CABO_ENVIRONMENT:undefined,RAILWAY_ENVIRONMENT_NAME:'testing'}),false);
});
test('only bounded synthetic identifiers and fictional institution permit forward review transitions',()=>{
 for(const id of ['real-user','cabo-demo-','cabo-demo-a@example.com','cabo-demo-a\n'])assert.equal(syntheticCandidate(id),false);
 const name='CABO DEMO | University of Future Skills';
 assert.equal(canAdvanceDemoApplication('cabo-fixture-student',name,'external_submission_recorded','under_review'),true);
 assert.equal(canAdvanceDemoApplication('cabo-fixture-student',name,'under_review','offer'),true);
 assert.equal(canAdvanceDemoApplication('cabo-fixture-student',name,'draft','offer'),false);
 assert.equal(canAdvanceDemoApplication('real-user',name,'under_review','offer'),false);
 assert.equal(canAdvanceDemoApplication('cabo-fixture-student','Real University','under_review','offer'),false);
 assert.equal(canAdvanceDemoApplication('cabo-fixture-student',name,'offer','unsuccessful'),false);
});
