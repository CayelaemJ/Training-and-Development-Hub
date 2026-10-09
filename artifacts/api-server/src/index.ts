import app from "./app";
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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if (process.env.RAILWAY_ENVIRONMENT_NAME === "testing" && process.env.ENABLE_CABO_DEMO_SEED === "true") {
    import("./lib/demoSeed").then(({ seedCaboDemo }) => seedCaboDemo())
      .catch(err => logger.error({ err }, "CABO demo fixture seeding failed"));
  }
});
