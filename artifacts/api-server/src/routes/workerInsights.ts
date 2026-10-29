import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { schoolManager } from "./reportCards";

/**
 * Feature-gated internal integration; accepts only pre-aggregated, coded
 * metrics. No learner identifiers, free text, source documents or marks.
 */
const router: IRouter = Router();

const metric = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_-]{1,47}$/),
  masteryPercent: z.number().int().min(0).max(100),
  evidenceCount: z.number().int().min(0).max(500),
}).strict();

const inputSchema = z.object({
  concepts: z.array(metric).min(1).max(20),
}).strict().superRefine((data, ctx) => {
  if (new Set(data.concepts.map(c => c.code)).size !== data.concepts.length) {
    ctx.addIssue({code: "custom", message: "Duplicate concept codes"});
  }
});

const outputSchema = z.object({
  version: z.literal(1),
  insights: z.array(z.object({
    code: metric.shape.code,
    state: z.enum(["insufficient_evidence", "needs_practice", "developing", "demonstrated"]),
    suggestedAction: z.enum(["collect_more_evidence", "practice_foundations", "targeted_review", "optional_enrichment"]),
  }).strict()).max(20),
  reviewRequired: z.literal(true),
  verifiedAssessment: z.literal(false),
  disclaimer: z.string().max(180),
}).strict();

router.post("/organizations/:orgId/learning/insights/draft", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!req.isAuthenticated()) { res.sendStatus(401); return; }
  if (process.env.ENABLE_CABO_DJANGO_INSIGHTS !== "true") {
    res.status(404).json({error: "Learning insights draft is not enabled"});
    return;
  }
  const org = z.coerce.number().int().positive().safeParse(req.params.orgId);
  if (!org.success) { res.sendStatus(400); return; }
  // Only institution managers can submit exploratory aggregate metrics.
  // This is not a substitute for verified source data or teacher review.
  if (!await schoolManager(org.data, req.user!.id)) {
    res.sendStatus(403);
    return;
  }
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.success ? parsed.data : req.body ?? {}), "utf8") > 4096) {
    res.status(400).json({error: "Use coded aggregate metrics without personal data"});
    return;
  }
  const rawUrl = process.env.CABO_DJANGO_WORKER_URL;
  const token = process.env.CABO_DJANGO_WORKER_TOKEN;
  let target: URL;
  try {
    if (!rawUrl || !token || token.length < 24) throw Error("Not configured");
    const base = new URL(rawUrl);
    if (base.protocol !== "https:" || base.username || base.password ||
        base.port || base.search || base.hash ||
        base.hostname !== "cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev") {
      throw Error("Unapproved worker origin");
    }
    target = new URL("/v1/insights/draft", base);
  } catch {
    res.status(503).json({error: "Learning insights worker is not configured"});
    return;
  }
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {"Authorization": `Bearer ${token}`, "Content-Type": "application/json"},
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!upstream.ok) {
      res.status(503).json({error: "Learning insights worker unavailable"});
      return;
    }
    const result = outputSchema.safeParse(await upstream.json());
    if (!result.success || result.data.insights.length !== parsed.data.concepts.length ||
        result.data.insights.some((v, i) => v.code !== parsed.data.concepts[i]?.code)) {
      res.status(502).json({error: "Learning insights response did not match request"});
      return;
    }
    res.json({...result.data, source: "django_cloudflare_worker", inputVerified: false});
  } catch {
    // Do not log URLs, tokens or payloads. Fail closed; existing core API unaffected.
    res.status(503).json({error: "Learning insights temporarily unavailable"});
  }
});

export default router;
