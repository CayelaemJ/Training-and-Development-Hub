import { eq } from "drizzle-orm";
import { db, learnerAiProfilesTable, userProfilesTable } from "@workspace/db";
import { learnerAiPersonalizationContext } from "./learnerAiProfilePolicy";
import type { LearnerPersonalization } from "./caboVoice";

/** The learner's own opted-in AI preferences, or null. Never fails a request. */
export async function learnerPersonalization(userId: string): Promise<LearnerPersonalization> {
  try {
    const [profile] = await db.select({
      personalizationEnabled: learnerAiProfilesTable.personalizationEnabled,
      goals: learnerAiProfilesTable.goals,
      interests: learnerAiProfilesTable.interests,
      preferredLanguage: learnerAiProfilesTable.preferredLanguage,
      explanationStyle: learnerAiProfilesTable.explanationStyle,
      learningPreferences: learnerAiProfilesTable.learningPreferences,
    }).from(learnerAiProfilesTable).where(eq(learnerAiProfilesTable.userId, userId)).limit(1);

    const context = learnerAiPersonalizationContext(profile ?? null) as LearnerPersonalization;
    if (!context) return null;

    // Enrich with display name from the user profile table (never fails the request).
    try {
      const [userProfile] = await db.select({
        displayName: userProfilesTable.displayName,
      }).from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
      if (userProfile?.displayName?.trim()) {
        context.displayName = userProfile.displayName.trim();
      }
    } catch {
      // Display name is non-critical — proceed without it.
    }

    return context;
  } catch {
    return null;
  }
}
