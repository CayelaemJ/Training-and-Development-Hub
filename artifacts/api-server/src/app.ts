import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// Optional single-origin Railway deployment: deliver the built React SPA from the API server.
// Keep /api separate so unknown API requests do not receive HTML.
const uiDist = process.env.FRONTEND_DIST_DIR || path.resolve(process.cwd(), "artifacts/training-platform/dist/public");
if (fs.existsSync(path.join(uiDist, "index.html"))) {
  app.use(express.static(uiDist, { index: false }));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(uiDist, "index.html"));
  });
}


export default app;
