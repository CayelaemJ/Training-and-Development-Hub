import { pool } from "@workspace/db";
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const text =
      process.env.ENABLE_LEARNER_SUCCESS_LOOP === "true"
        ? "SELECT to_regclass('learner_support_tickets') AS tickets, to_regclass('education_framework_versions') AS frameworks"
        : "SELECT 1";
    const result = await Promise.race([
      pool.query(text),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error("Readiness timeout")), 1500);
      }),
    ]);
    if (
      process.env.ENABLE_LEARNER_SUCCESS_LOOP === "true" &&
      (!result.rows[0]?.tickets || !result.rows[0]?.frameworks)
    ) {
      res.status(503).json({ status: "migration_required" });
      return;
    }
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "dependency_unavailable" });
  } finally {
    if (timer) clearTimeout(timer);
  }
});
export default router;
