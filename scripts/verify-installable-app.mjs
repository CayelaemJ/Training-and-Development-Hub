import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const {default: AxeBuilder} = require('@axe-core/playwright');
const browser = await chromium.launch({headless:true,...(process.env.CABO_CHROMIUM_PATH ? {executablePath:process.env.CABO_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']} : {})});
const base = process.env.CABO_UI_TEST_URL;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Real service worker is enabled. Only the signed-out auth response is synthetic.
  await context.route('**/api/auth/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.goto(base+'/install');
  await page.getByRole('heading',{name:/At home on your device/}).waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready; if(!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  const manifest=await (await context.request.get(base+'/manifest.webmanifest')).json();
  assert.equal(manifest.display,'standalone');assert.equal(manifest.name,'CABO Learning Hub');
  for(const icon of manifest.icons){const res=await context.request.get(base+icon.src);assert.equal(res.status(),200);assert.match(res.headers()['content-type'],/image\/png/);}
  const accessibility=await new AxeBuilder({page}).withRules(['button-name','color-contrast','image-alt','aria-valid-attr-value']).analyze();
  assert.deepEqual(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await page.getByRole('button',{name:'iPhone & iPad',exact:true}).click();
  await page.getByText('Open this page in Safari.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Android',exact:true}).click();
  await page.getByText('Open CABO in Chrome on your device.',{exact:true}).waitFor();
  for(const width of [390,768,1280]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:process.env.CABO_INSTALL_SCREENSHOT || '/tmp/cabo-install-mobile.png',fullPage:true});
  async function prompt(outcome,fail=false){
    await page.evaluate(({outcome,fail})=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=async()=>{window.installCalls=(window.installCalls||0)+1;if(fail)throw Error('browser declined');};
      event.userChoice=Promise.resolve({outcome});window.dispatchEvent(event);
    },{outcome,fail});
    await page.getByRole('button',{name:'Install CABO',exact:true}).click();
  }
  await prompt('dismissed');
  await page.getByRole('status').filter({hasText:'Installation cancelled.'}).waitFor();
  await prompt('accepted',true);
  await page.getByRole('status').filter({hasText:'The install window could not open.'}).waitFor();
  await prompt('accepted');
  await page.getByRole('status').filter({hasText:'Installation requested.'}).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await page.getByText('You’re using the installed CABO app.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.installCalls),3);
  // API, uploaded files and user HTML must never be cached by the app worker.
  await context.route('**/api/private-fixture',route=>route.fulfill({status:200,contentType:'application/json',body:'{"private":true}'}));
  await context.route('**/railway-uploads/private.png',route=>route.fulfill({status:200,body:'private fixture'}));
  await page.evaluate(async()=>{await fetch('/api/private-fixture');await fetch('/railway-uploads/private.png');});
  const cached=await page.evaluate(async()=>{const urls=[];for(const name of await caches.keys())for(const req of await (await caches.open(name)).keys())urls.push(new URL(req.url).pathname);return urls;});
  assert.ok(cached.includes('/offline.html'));
  assert.ok(!cached.some(path=>path.startsWith('/api')||path.startsWith('/railway-uploads')||path==='/install'||path==='/'));
  await context.setOffline(true);
  await page.getByRole('status').filter({hasText:'You’re offline.'}).waitFor();
  await page.goto(base+'/learner-success');
  await page.getByRole('heading',{name:'Let’s reconnect.'}).waitFor();
  assert.equal(await page.getByRole('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await context.setOffline(false);
  await page.getByRole('link',{name:'Try CABO again'}).click();
  await page.waitForURL(base+'/');
  assert.deepEqual(errors,[]);
  await context.close();
  const iphone=await browser.newContext({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844}});
  const ipage=await iphone.newPage();
  await iphone.route('**/api/auth/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await ipage.goto(base+'/install');
  await ipage.getByRole('button',{name:'iPhone & iPad',exact:true}).waitFor();
  assert.equal(await ipage.getByRole('button',{name:'iPhone & iPad',exact:true}).getAttribute('aria-pressed'),'true');
  await iphone.close();
  console.log('PASS: public install page, manifest/icons, desktop/tablet/mobile layouts, device instructions, prompt accepted/cancelled/error handling, installed state, selected axe rules, real service-worker offline navigation/reconnect, no API/upload/private HTML cache, iPhone detection. OS installation/store review not emulated.');
} finally {await browser.close();}
