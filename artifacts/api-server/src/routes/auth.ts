import { GetCurrentAuthUserResponse } from '@workspace/api-zod';
import { db, usersTable } from '@workspace/db';
import { Router, type IRouter, type Request, type Response } from 'express';
import * as oidc from 'openid-client';
import { scryptSync, timingSafeEqual } from 'node:crypto';

import {
  clearSession,
  createSession,
  getOidcConfig,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from '../lib/auth';

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host =
    req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost';
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/';
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

// Password auth is available only on the isolated Railway testing deployment.
// Its verifier is supplied as a salted scrypt hash via Railway secrets, never source code.
const failures = new Map<string,{count:number;until:number}>();
router.post('/test-login', async (req:Request,res:Response) => {
 if(process.env.ENABLE_CABO_TEST_LOGIN!=='true'||process.env.RAILWAY_ENVIRONMENT_NAME!=='testing'){res.sendStatus(404);return;}
 const key=req.ip??'unknown';const rate=failures.get(key);
 if(rate&&rate.count>=6&&rate.until>Date.now()){res.status(429).json({error:'Too many attempts; try again later'});return;}
 const username=typeof req.body?.username==='string'?req.body.username:'';
 const password=typeof req.body?.password==='string'?req.body.password:'';
 const setting=process.env.CABO_TEST_PASSWORD_HASH??'';
 const [saltHex,hashHex]=setting.split(':');let valid=false;
 if(username.length<=100&&password.length<=200&&saltHex&&hashHex&&/^[a-f0-9]{32}$/.test(saltHex)&&/^[a-f0-9]{128}$/.test(hashHex)) {
  const provided=scryptSync(password,Buffer.from(saltHex,'hex'),64);
  valid=timingSafeEqual(provided,Buffer.from(hashHex,'hex'))&&username===process.env.CABO_TEST_LOGIN_USERNAME;
 }
 if(!valid){const current=failures.get(key);failures.set(key,{count:(current?.until??0)>Date.now()?(current?.count??0)+1:1,until:Date.now()+15*60_000});res.status(401).json({error:'Incorrect username or password'});return;}
 failures.delete(key);
 const [account]=await db.insert(usersTable).values({id:'cabo-isolated-test-learner',firstName:'CABO',lastName:'Tester'}).onConflictDoUpdate({target:usersTable.id,set:{firstName:'CABO',lastName:'Tester'}}).returning();
 const sid=await createSession({user:{id:account.id,email:account.email,firstName:account.firstName,lastName:account.lastName,profileImageUrl:account.profileImageUrl},access_token:'test-local'});
 setSessionCookie(res,sid);res.json({ok:true});
});
router.post('/test-logout',async(req:Request,res:Response)=>{
 if(process.env.ENABLE_CABO_TEST_LOGIN!=='true'||process.env.RAILWAY_ENVIRONMENT_NAME!=='testing'){res.sendStatus(404);return;}
 await clearSession(res,getSessionId(req));res.json({ok:true});
});
router.get('/auth/user', (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get('/login', async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: 'openid email profile offline_access',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'login consent',
    state,
    nonce,
  });

  setOidcCookie(res, 'code_verifier', codeVerifier);
  setOidcCookie(res, 'nonce', nonce);
  setOidcCookie(res, 'state', state);
  setOidcCookie(res, 'return_to', returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get('/callback', async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect('/api/login');
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect('/api/login');
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie('code_verifier', { path: '/' });
  res.clearCookie('nonce', { path: '/' });
  res.clearCookie('state', { path: '/' });
  res.clearCookie('return_to', { path: '/' });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect('/api/login');
    return;
  }

  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get('/logout', async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);
  const returnTo = getSafeReturnTo(req.query.returnTo);
  const postLogoutRedirectUrl = new URL(returnTo, `${origin}/`).href;

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: postLogoutRedirectUrl,
  });

  res.redirect(endSessionUrl.href);
});

export default router;
