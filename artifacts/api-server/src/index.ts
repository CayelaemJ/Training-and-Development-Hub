import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server=app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if ((process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME) === "testing" && process.env.CABO_GROQ_SMOKE_TEST === "true") {
    import("./lib/groqSmokeTest").then(({ groqSmokeTest }) => groqSmokeTest())
      .catch(err => logger.error({ errorType: err?.name || "Error" }, "CABO Groq smoke test FAILED"));
  }
  if ((process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME) === "testing" && process.env.ENABLE_CABO_DEMO_SEED === "true") {
    import("./lib/demoSeed").then(({ seedCaboDemo }) => seedCaboDemo())
      .catch(err => logger.error({ err }, "CABO demo fixture seeding failed"));
  }
});

let draining=false;
for(const signal of ["SIGTERM","SIGINT"] as const)process.on(signal,()=>{
 if(draining)return;draining=true;
 const deadline=setTimeout(()=>process.exit(1),25000);deadline.unref();
 server.close(()=>{pool.end().then(()=>{clearTimeout(deadline);process.exit(0)}).catch(()=>process.exit(1));});
 server.closeIdleConnections();
});
