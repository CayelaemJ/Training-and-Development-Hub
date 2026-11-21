import { useEffect, useState, type FormEvent } from "react";
import { BrainCircuit, Check, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";

type LearnerAiProfile = {
  personalizationEnabled: boolean;
  goals: string[];
  interests: string[];
  preferredLanguage: string;
  explanationStyle: "step_by_step" | "examples_first" | "concise" | "practice_first" | "visual";
  learningPreferences: string[];
  updatedAt?: string;
};

const emptyProfile: LearnerAiProfile = {
  personalizationEnabled: false,
  goals: [],
  interests: [],
  preferredLanguage: "",
  explanationStyle: "step_by_step",
  learningPreferences: [],
};

const preferences = [
  ["short_sessions", "Short study sessions"],
  ["worked_examples", "Worked examples"],
  ["plain_language", "Plain language"],
  ["practice_questions", "Practice questions"],
  ["visual_aids", "Visual explanations"],
  ["check_understanding", "Check my understanding"],
] as const;

async function profileRequest(method: "GET" | "PUT" | "DELETE", body?: LearnerAiProfile) {
  const response = await fetch("/api/learner-ai/profile", {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in again to manage your AI profile.");
    throw new Error(method === "DELETE" ? "We couldn't delete your profile. Please retry." : "We couldn't save your profile. Please retry.");
  }
  return response.status === 204 ? null : (await response.json()) as LearnerAiProfile;
}

export default function LearnerAiProfilePage() {
  const [profile, setProfile] = useState<LearnerAiProfile>(emptyProfile);
  const [goalsText, setGoalsText] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let active = true;
    profileRequest("GET")
      .then((value) => {
        if (!active || !value) return;
        setProfile(value);
        setGoalsText(value.goals.join("\n"));
        setInterestsText(value.interests.join("\n"));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Profile unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function togglePreference(value: string) {
    setProfile((current) => ({
      ...current,
      learningPreferences: current.learningPreferences.includes(value)
        ? current.learningPreferences.filter((item) => item !== value)
        : [...current.learningPreferences, value],
    }));
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const goals = goalsText.split("\n").map((item) => item.trim()).filter(Boolean);
    const interests = interestsText.split("\n").map((item) => item.trim()).filter(Boolean);
    if (goals.length > 8 || interests.length > 12 || [...goals, ...interests].some((item) => item.length < 2 || item.length > 120)) {
      setError("Use up to 8 goals and 12 interests. Each entry must be 2–120 characters.");
      return;
    }
    setSaving(true);
    try {
      const value = await profileRequest("PUT", { ...profile, goals, interests });
      if (value) {
        setProfile(value);
        setGoalsText(value.goals.join("\n"));
        setInterestsText(value.interests.join("\n"));
      }
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profile unavailable.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProfile() {
    setError("");
    setSaving(true);
    try {
      await profileRequest("DELETE");
      setProfile(emptyProfile);
      setGoalsText("");
      setInterestsText("");
      setSaved(false);
      setConfirmDelete(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profile unavailable.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const cardClass = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7";

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header className="rounded-3xl bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your CABO AI</p>
        <h1 className="mt-3 flex items-center gap-3 font-display text-3xl sm:text-4xl"><BrainCircuit aria-hidden="true" /> My learning profile</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Tell CABO how you like to learn and what you’re working towards. You choose what to share and can change or delete it whenever you want.</p>
      </header>

      <aside className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <p><strong>Your profile is learner-entered and private to your CABO account.</strong> If you opt in and request a development plan, the preferences you chose may be sent to CABO’s configured AI provider for that response. They are not used to infer your personality, emotions, ability or health. Learner chat is not live yet.</p>
      </aside>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={18} /> Loading your profile…</p>
      ) : (
        <form className={cardClass + " grid gap-6"} onSubmit={save}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
            <input
              className="mt-1 size-4 accent-primary"
              type="checkbox"
              checked={profile.personalizationEnabled}
              onChange={(event) => { setProfile({ ...profile, personalizationEnabled: event.target.checked }); setSaved(false); }}
            />
            <span><strong>Use my profile to personalise development plans</strong><span className="mt-1 block text-sm text-muted-foreground">Optional. When enabled, your selected profile fields are included with your development-plan request and sent to CABO’s configured AI provider for that response.</span></span>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">My goals <span className="font-normal text-muted-foreground">(one per line, up to 8)</span>
              <textarea className={inputClass} rows={5} maxLength={1000} value={goalsText} onChange={(event) => { setGoalsText(event.target.value); setSaved(false); }} placeholder={"Understand fractions\nPrepare for my next science test"} />
            </label>
            <label className="text-sm font-medium">My interests <span className="font-normal text-muted-foreground">(one per line, up to 12)</span>
              <textarea className={inputClass} rows={5} maxLength={1500} value={interestsText} onChange={(event) => { setInterestsText(event.target.value); setSaved(false); }} placeholder={"Football\nRobotics"} />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">Preferred language
              <input className={inputClass} maxLength={24} value={profile.preferredLanguage} onChange={(event) => { setProfile({ ...profile, preferredLanguage: event.target.value }); setSaved(false); }} placeholder="e.g. English, isiZulu, Setswana" />
            </label>
            <label className="text-sm font-medium">How I like explanations
              <select className={inputClass} value={profile.explanationStyle} onChange={(event) => { setProfile({ ...profile, explanationStyle: event.target.value as LearnerAiProfile["explanationStyle"] }); setSaved(false); }}>
                <option value="step_by_step">Step by step</option>
                <option value="examples_first">Start with examples</option>
                <option value="concise">Keep it concise</option>
                <option value="practice_first">Let me try first</option>
                <option value="visual">Use visual explanations</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">What helps me learn?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {preferences.map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                  <input className="size-4 accent-primary" type="checkbox" checked={profile.learningPreferences.includes(value)} onChange={() => togglePreference(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {saved && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><Check size={17} /> Profile saved.</p>}
          {profile.updatedAt && <p className="text-xs text-muted-foreground">Last updated {new Date(profile.updatedAt).toLocaleDateString()}.</p>}

          <div className="flex flex-wrap items-center gap-3 border-t pt-5">
            <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={saving}>
              {saving ? "Saving…" : "Save my profile"}
            </button>
            {!confirmDelete ? (
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Delete profile</button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                Delete all saved profile preferences?
                <button type="button" className="rounded-lg border border-destructive px-3 py-2 text-destructive" disabled={saving} onClick={() => void removeProfile()}>Yes, delete</button>
                <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setConfirmDelete(false)}>Keep profile</button>
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
