import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(relative)=>readFileSync(new URL(relative,import.meta.url),"utf8");

test("institution DB marker preserves unknown legacy countries",()=>{
 const schema=read("../../../../lib/db/src/schema/institutionSetup.ts");
 const migration=read("../../../../lib/db/migrations/20261026_country_jurisdiction_setup.sql");
 assert.match(schema,/countryCode:varchar\("country_code"/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS country_code varchar\(2\)/);
 assert.match(migration,/CHECK \(country_code IS NULL OR country_code IN \('ZA','BW'\)\)/);
 assert.doesNotMatch(migration,/DEFAULT 'ZA'/);
});
test("school API validates explicit country, prevents reclassification and checks attestations",()=>{
 const route=read("../routes/institutionSetup.ts");
 assert.match(route,/countryCode:z\.enum\(\["ZA","BW"\]\)\.nullish\(\)/);
 assert.match(route,/countryChangeNeedsReview\(/);
 assert.match(route,/assessInstitutionProfileSubmission\(/);
 assert.match(route,/status\(409\)/);
 assert.match(route,/legalCertification:false/);
});
test("country selection and warnings are visible in institution frontend",()=>{
 const page=read("../../../training-platform/src/pages/institution-setup.tsx");
 assert.match(page,/value="ZA">South Africa/);
 assert.match(page,/value="BW">Botswana/);
 assert.match(page,/disabled=\{classifiedCountry!==null\}/);
 assert.match(page,/!details\.countryCode/);
 assert.match(page,/authoris(e|ation|e)/i);
});
