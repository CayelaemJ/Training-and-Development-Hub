// Which data-protection rules apply. The regime of each school comes from its
// recorded country; the caller's device time zone is used only to suggest a
// country where none is recorded, and never relaxes protection.
import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, organizationMembersTable, organizationsTable, institutionSetupTable } from "@workspace/db";
import { REGIMES, UNSET_REGIME, describeRegime, regimeFor, suggestCountry } from "../lib/jurisdictionPolicy";

const router: IRouter = Router();

router.get("/privacy/regimes", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return; }
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.json({ regimes: [describeRegime(REGIMES.ZA), describeRegime(REGIMES.BW), describeRegime(UNSET_REGIME)] });
});

router.get("/privacy/regimes/me", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const memberships = await db.select({ organizationId: organizationMembersTable.organizationId, role: organizationMembersTable.role })
    .from(organizationMembersTable).where(eq(organizationMembersTable.userId, req.user!.id)).limit(50);
  const ids = memberships.map(m => m.organizationId);
  const [orgs, setups] = ids.length ? await Promise.all([
    db.select({ id: organizationsTable.id, name: organizationsTable.name }).from(organizationsTable).where(inArray(organizationsTable.id, ids)),
    db.select({ organizationId: institutionSetupTable.organizationId, countryCode: institutionSetupTable.countryCode }).from(institutionSetupTable).where(inArray(institutionSetupTable.organizationId, ids)),
  ]) : [[], []];
  const country = new Map(setups.map(s => [s.organizationId, s.countryCode]));
  const suggested = suggestCountry(req.get("x-cabo-timezone"));
  res.json({
    suggestedCountry: suggested,
    suggestionNote: suggested ? "Suggested from this device's time zone. A school's recorded country always decides which rules apply." : null,
    schools: orgs.map(o => {
      const code = country.get(o.id) ?? null;
      return { organizationId: o.id, name: o.name, countryRecorded: code === "ZA" || code === "BW", regime: describeRegime(regimeFor(code)) };
    }),
  });
});

export default router;
