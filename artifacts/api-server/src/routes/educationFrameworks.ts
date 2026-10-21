import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  educationFrameworkVersionsTable as frameworks,
  organizationMembersTable as members,
} from "@workspace/db";
import {
  validTimeZone,
  validLanguage,
  validGradingScale,
} from "../lib/frameworkPolicy";
const router: IRouter = Router(),
  id = z.coerce.number().int().positive();
router.use("/organizations/:orgId/education-framework", (req, res, next) => {
  if (process.env.ENABLE_LEARNER_SUCCESS_LOOP !== "true") {
    res.status(404).json({ error: "School framework rollout is not enabled" });
    return;
  }
  next();
});
const config = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    frameworkCode: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(200),
    timeZone: z.string().max(80).refine(validTimeZone),
    languages: z.array(z.string().max(40).refine(validLanguage)).min(1).max(12),
    settings: z.object({
      levels: z.array(z.string().trim().min(1).max(28)).min(1).max(40).refine(levels=>new Set(levels).size===levels.length),
      curriculumVersion: z.string().trim().min(1).max(120),
      notes: z.string().max(2000),
      gradingScale: z
        .array(
          z.object({
            label: z.string().trim().min(1).max(30),
            minimumPercent: z.number().min(0).max(100),
          }),
        )
        .max(30)
        .refine(validGradingScale),
    }),
  })
  .strict();
router.get("/organizations/:orgId/education-framework", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return;
  }
  const org = id.safeParse(req.params.orgId);
  if (!org.success) {
    res.sendStatus(400);
    return;
  }
  const [m] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.organizationId, org.data),
        eq(members.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!m) {
    res.sendStatus(403);
    return;
  }
  const [current] = await db
    .select()
    .from(frameworks)
    .where(eq(frameworks.organizationId, org.data))
    .orderBy(desc(frameworks.id))
    .limit(1);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    current: current ?? null,
    canConfigure: ["owner", "admin"].includes(m.role),
    officialCompliance: false,
  });
});
router.post("/organizations/:orgId/education-framework", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return;
  }
  const org = id.safeParse(req.params.orgId),
    body = config.safeParse(req.body);
  if (!org.success || !body.success) {
    res
      .status(400)
      .json({
        error: "Invalid school framework, timezone, language or grading scale",
      });
    return;
  }
  const [m] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.organizationId, org.data),
        eq(members.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!m || !["owner", "admin"].includes(m.role)) {
    res.sendStatus(403);
    return;
  }
  const [version] = await db
    .insert(frameworks)
    .values({ ...body.data, organizationId: org.data, createdBy: req.user.id })
    .returning();
  res.status(201).json(version);
});
export default router;
