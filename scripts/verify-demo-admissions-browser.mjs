// UI fixtures only. Real authorization and database isolation are exercised in test-demo-admissions.mjs.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const {default:AxeBuilder}=require('@axe-core/playwright');
const browser=await chromium.launch({headless:true,...(process.env.CABO_CHROMIUM_PATH?{executablePath:process.env.CABO_CHROMIUM_PATH,args:['--no-sandbox']}: {})});
const base=process.env.CABO_UI_TEST_URL;
assert.ok(base,'Local fixture server URL required');
try {
 for(const width of [390,1024]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  let status='external_submission_recorded',enabled=true,conflict=false;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let data=[];
   if(path==='/api/auth/user')data={user:{id:'test-admin',email:'admin@example.invalid',firstName:'Demo',lastName:'Admin'}};
   else if(path==='/api/portal/me')data={role:'superadmin',organizationIds:[],scopes:[]};
   else if(path==='/api/platform/overview')data={organizations:[]};
   else if(path==='/api/platform/mlops')data=null;
   else if(path==='/api/platform/demo/status') {await route.fulfill({status:503});return;}
   else if(path==='/api/platform/demo/admissions-inbox'){
    if(!enabled){await route.fulfill({status:503});return;}
    data=[{id:1,candidateId:'cabo-fixture-student',programme:'Synthetic programme',status}];
   } else if(path==='/api/platform/demo/admissions-inbox/1/decision'){
    if(conflict){await route.fulfill({status:409});return;}
    const action=route.request().postDataJSON().action;
    assert.ok(['under_review','offer'].includes(action));status=action;data={id:1,status,demoOnly:true};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(base+'/platform-admin');
  await page.getByRole('heading',{name:'Fictional university inbox'}).waitFor();
  assert.ok(await page.getByText('These statuses are demonstrations',{exact:false}).count());
  await page.getByRole('button',{name:'Start fictional review'}).click();
  await page.getByRole('button',{name:'Record fictional offer'}).waitFor();
  conflict=true;
  await page.getByRole('button',{name:'Record fictional offer'}).click();
  await page.getByText('This application changed. Refresh before trying again.',{exact:true}).waitFor();
  conflict=false;
  await page.getByRole('button',{name:'Refresh inbox'}).click();
  await page.getByRole('button',{name:'Record fictional offer'}).click();
  await page.getByText('Fictional status updated. No real university was contacted.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Record fictional offer'}).waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);
  const axe=await new AxeBuilder({page}).include('[aria-labelledby="demo-admissions-title"]').withRules(['button-name','aria-valid-attr','aria-valid-attr-value','heading-order']).analyze();
  assert.deepEqual(axe.violations,[]);
  enabled=false;await page.reload();
  await page.getByRole('heading',{name:'Superadmin command centre'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Fictional university inbox'}).count(),0);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: admissions demo review/offer, conflict feedback, feature-off hiding, 390px/1024px layouts, accessible controls and no runtime errors.');
}finally{await browser.close();}
