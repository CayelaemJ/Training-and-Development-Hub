import test from "node:test";
import assert from "node:assert/strict";
import {isTestSuperadmin} from "../lib/platformPolicy.ts";
const allowed={RAILWAY_ENVIRONMENT_NAME:"testing",ENABLE_CABO_SUPERADMIN:"true",CABO_SUPERADMIN_USER_ID:"cabo-isolated-test-learner"};
test("only the configured test account is platform superadmin",()=>{
 assert.equal(isTestSuperadmin("cabo-isolated-test-learner",allowed),true);
 assert.equal(isTestSuperadmin("another-account",allowed),false);
 assert.equal(isTestSuperadmin("cabo_test",allowed),false);
});
test("never elevate in production or with missing flags",()=>{
 assert.equal(isTestSuperadmin("cabo-isolated-test-learner",{...allowed,RAILWAY_ENVIRONMENT_NAME:"production"}),false);
 assert.equal(isTestSuperadmin("cabo-isolated-test-learner",{...allowed,ENABLE_CABO_SUPERADMIN:"false"}),false);
 assert.equal(isTestSuperadmin("cabo-isolated-test-learner",{...allowed,CABO_SUPERADMIN_USER_ID:""}),false);
 assert.equal(isTestSuperadmin("cabo-isolated-test-learner",{}),false);
});
