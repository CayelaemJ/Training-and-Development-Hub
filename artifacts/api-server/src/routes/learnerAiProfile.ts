import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, learnerAiProfilesTable } from "@workspace/db";
import { emptyLearnerAiProfile, learnerAiProfileInput } from "../lib/learnerAiProfilePolicy";

const router: IRouter = Router();
function userId(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to manage your CABO AI profile" });
    return null;
  }
  return req.user!.id;
}

router.get("/learner-ai/profile", async (req, res) => {
  const id = userId(req, res);
  if (!id) return;
  res.setHeader("Cache-Control", "private, no-store");
  const [profile] = await db.select({
    personalizationEnabled: learnerAiProfilesTable.personalizationEnabled,
    goals: learnerAiProfilesTable.goals,
    interests: learnerAiProfilesTable.interests,
    preferredLanguage: learnerAiProfilesTable.preferredLanguage,
    explanationStyle: learnerAiProfilesTable.explanationStyle,
    learningPreferences: learnerAiProfilesTable.learningPreferences,
    updatedAt: learnerAiProfilesTable.updatedAt,
  }).from(learnerAiProfilesTable).where(eq(learnerAiProfilesTable.userId, id)).limit(1);
  res.json(profile ?? emptyLearnerAiProfile);
});

router.put("/learner-ai/profile", async (req, res) => {
  const id = userId(req, res);
  if (!id) return;
  const parsed = learnerAiProfileInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check your learning goals and preferences" });
    return;
  }
  const [profile] = await db.insert(learnerAiProfilesTable).values({ userId: id, ...parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: learnerAiProfilesTable.userId, set: { ...parsed.data, updatedAt: new Date() } })
    .returning({
      personalizationEnabled: learnerAiProfilesTable.personalizationEnabled,
      goals: learnerAiProfilesTable.goals,
      interests: learnerAiProfilesTable.interests,
      preferredLanguage: learnerAiProfilesTable.preferredLanguage,
      explanationStyle: learnerAiProfilesTable.explanationStyle,
      learningPreferences: learnerAiProfilesTable.learningPreferences,
      updatedAt: learnerAiProfilesTable.updatedAt,
    });
  res.setHeader("Cache-Control", "private, no-store");
  res.json(profile);
});

router.delete("/learner-ai/profile", async (req, res) => {
  const id = userId(req, res);
  if (!id) return;
  await db.delete(learnerAiProfilesTable).where(eq(learnerAiProfilesTable.userId, id));
  res.status(204).end();
});

export default router;
