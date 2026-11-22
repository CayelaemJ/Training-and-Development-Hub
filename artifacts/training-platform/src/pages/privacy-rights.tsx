import { useEffect, useState } from "react";
import { Globe2, Scale } from "lucide-react";
import { api } from "@/lib/schoolApi";

// Which data-protection law applies to each of the user's schools, picked
// automatically from the school's recorded country.

type Rule<T> = { value: T; basis: string; kind: "statutory" | "internal" };
type Regime = {
  code: "ZA" | "BW" | "UNSET"; country: string; law: string; regulator: { name: string; url: string };
  rules: { childUnderAge: Rule<number>; childSelfConsentAge: Rule<number | null>; breachRegulatorHours: Rule<number>; subjectRequestDays: Rule<number>; localCopyOnTransfer: Rule<boolean>; chatRetentionDays: Rule<number> };
  rights: string[]; notLegalAdvice: string;
};
type Mine = { suggestedCountry: "ZA" | "BW" | null; suggestionNote: string | null; schools: { organizationId: number; name: string; countryRecorded: boolean; regime: Regime }[] };

const countryName = { ZA: "South Africa", BW: "Botswana" } as const;

function RuleRow({ label, rule, render }: { label: string; rule: Rule<any>; render: (v: any) => string }) {
  return <tr className="border-t"><td className="py-2 pr-3">{label}</td><td className="py-2 pr-3 font-semibold">{render(rule.value)}</td>
    <td className="py-2 pr-3 text-xs text-muted-foreground">{rule.basis}{rule.kind === "internal" ? " (CABO's own limit)" : ""}</td></tr>;
}

export default function PrivacyRightsPage() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Mine>("/privacy/regimes/me").then(setMine).catch(e => setError((e as Error).message)); }, []);
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Privacy &amp; your rights</p>
        <h1 className="font-display text-3xl">The rules that protect your information</h1>
        <p className="text-muted-foreground">CABO applies South Africa's POPIA or Botswana's Data Protection Act automatically, based on the country each school has recorded. If a school has not recorded its country yet, the stricter rule from either law applies.</p>
      </header>
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}
      {mine?.suggestedCountry && <p className="flex items-center gap-2 rounded-md border p-3 text-sm"><Globe2 size={16} aria-hidden /> This device appears to be in {countryName[mine.suggestedCountry]}. {mine.suggestionNote}</p>}
      {mine && mine.schools.length === 0 && <p className="text-sm text-muted-foreground">You are not a member of a school yet.</p>}
      {mine?.schools.map(s => (
        <section key={s.organizationId} className="rounded-xl border p-5 space-y-3">
          <h2 className="font-display text-xl flex items-center gap-2"><Scale size={18} aria-hidden /> {s.name}</h2>
          <p className="text-sm">{s.regime.law}{s.countryRecorded ? "" : " — the school has not recorded its country yet."}</p>
          <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>
            <RuleRow label="Who counts as a child" rule={s.regime.rules.childUnderAge} render={v => `Under ${v}`} />
            <RuleRow label="When a child can agree alone to online services" rule={s.regime.rules.childSelfConsentAge} render={v => v === null ? "Never — a parent or guardian agrees" : `From age ${v}`} />
            <RuleRow label="Tell the regulator about a data breach within" rule={s.regime.rules.breachRegulatorHours} render={v => `${v} hours`} />
            <RuleRow label="Answer a request to see, correct or delete your information within" rule={s.regime.rules.subjectRequestDays} render={v => `${v} days`} />
            <RuleRow label="Keep a local copy when data leaves the country" rule={s.regime.rules.localCopyOnTransfer} render={v => v ? "Yes" : "No"} />
            <RuleRow label="Class chat messages are kept for" rule={s.regime.rules.chatRetentionDays} render={v => `${v} days`} />
          </tbody></table></div>
          <p className="text-sm">Your rights: {s.regime.rights.join(", ")}.</p>
          {s.regime.regulator.url && <p className="text-sm">Regulator: <a className="underline" href={s.regime.regulator.url} target="_blank" rel="noreferrer">{s.regime.regulator.name}</a></p>}
          <p className="text-xs text-muted-foreground">{s.regime.notLegalAdvice}</p>
        </section>
      ))}
    </div>
  );
}
