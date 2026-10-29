import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import { privilegedMfaGuard } from "./middlewares/privilegedMfaGuard";
import router from "./routes";
import qstashMaterialPreviewRouter from "./routes/qstashMaterialPreview";
import { logger } from "./lib/logger";
import {permittedBrowserOrigin, permittedMutationOrigin} from "./lib/originPolicy";
import {apiRateLimit} from "./middlewares/rateLimit";
import { safeRequestCategory, safeErrorType, safeRequestReference } from "./lib/httpPrivacy";
import { randomUUID } from "node:crypto";

const app: Express = express();
app.set("trust proxy", process.env.TRUST_PROXY_HOPS === "1" ? 1 : false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          routeGroup: safeRequestCategory(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");res.setHeader("X-Frame-Options","DENY");next()});
app.use(cors({credentials:true,origin:(origin,callback)=>callback(null,origin&&permittedBrowserOrigin(origin,process.env)?origin:false)}));
app.use((req,res,next)=>{if(["POST","PATCH","PUT","DELETE"].includes(req.method)&&!permittedMutationOrigin({origin:req.headers.origin,referer:req.headers.referer,cookie:req.headers.cookie},process.env)){res.status(403).json({error:"Untrusted browser origin"});return}next()});
// Protect the API before parsing bodies or retrieving sessions.
app.use("/api", apiRateLimit);
app.use(cookieParser());
app.use("/api/internal/qstash/material-preview", express.json({
  limit: "1kb",
  verify(req, _res, body) {
    (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(body);
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);
// Off until production OIDC provider and admin MFA flows are verified.
app.use("/api", privilegedMfaGuard);

app.use("/api", qstashMaterialPreviewRouter);
app.use("/api", router);
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if(error?.type === 'entity.too.large'){res.status(413).json({error:'Choose a file of 30 MB or less, or split it into smaller parts.'});return;}
  if(error instanceof SyntaxError && 'body' in error){res.status(400).json({error:'We couldn’t read this request. Please try again.'});return;}
  next(error);
});

// Final privacy-preserving API error boundary: never print raw exception
// messages, learner IDs, document names, auth tokens or SQL text.
app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) { next(error); return; }
  const requestId = safeRequestReference((req as express.Request & {id?: unknown}).id) ?? randomUUID();
  req.log.error({
    requestId, errorType: safeErrorType(error), method: req.method,
    routeGroup: safeRequestCategory(req.originalUrl), statusCode: 500,
  }, "Unhandled request failure");
  res.setHeader("Cache-Control", "no-store");
  res.status(500).json({ error: "This request could not be completed.", reference: requestId });
});

// Optional single-origin deployment: deliver the built React SPA from the API server.
// Keep /api separate so unknown API requests do not receive HTML.
const uiDist = path.resolve(process.cwd(), process.env.FRONTEND_DIST_DIR || "artifacts/training-platform/dist/public");
if (fs.existsSync(path.join(uiDist, "index.html"))) {
  app.use(express.static(uiDist, { index: false }));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(uiDist, "index.html"));
  });
}


export default app;
