import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import {permittedBrowserOrigin} from "./lib/originPolicy";
import { apiRateLimit } from "./middlewares/rateLimit";

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
          url: req.url?.split("?")[0],
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
app.use((req,res,next)=>{if(["POST","PATCH","PUT","DELETE"].includes(req.method)&&!permittedBrowserOrigin(req.headers.origin,process.env)){res.status(403).json({error:"Untrusted browser origin"});return}next()});
// Reject abusive API traffic before cookie/session lookups and body parsing.
// The limiter keys on req.originalUrl and req.ip, neither requires body or auth.
app.use("/api", apiRateLimit);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);
app.use("/api", router);
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if(error?.type === 'entity.too.large'){res.status(413).json({error:'Choose a file of 30 MB or less, or split it into smaller parts.'});return;}
  if(error instanceof SyntaxError && 'body' in error){res.status(400).json({error:'We couldn’t read this request. Please try again.'});return;}
  next(error);
});

// Optional single-origin Railway deployment: deliver the built React SPA from the API server.
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
