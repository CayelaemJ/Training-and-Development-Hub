import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Accessibility, Image as ImageIcon, Palette, Pin, UserRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ACCENTS, DEFAULT_APPEARANCE, applyAppearance, type Appearance } from "@/lib/appearance";
import { api } from "@/lib/schoolApi";

// "My profile & look": who you are in CABO, how the app looks for you, and
// accessibility settings. Changes preview immediately and are saved to your
// account so they follow you to every device.

type Profile = { displayName: string; pronouns: string; bio: string; avatarStyle: "initials" | "pattern" | "photo"; avatarColor: Appearance["accent"]; initials: string; name: string };
type Me = { profile: Profile; appearance: Appearance; photo: { status: string; url: string } | null };
type Approval = { learnerId: string; childName: string; url: string };

export const PINNABLE: { href: string; label: string }[] = [
  { href: "/", label: "My dashboard" }, { href: "/class-chat", label: "Class chat" }, { href: "/accountability", label: "Concerns" },
  { href: "/materials", label: "Study materials" }, { href: "/quizzes", label: "Practice tests" }, { href: "/written-exams", label: "Written exams" },
  { href: "/guardian-connect", label: "Guardian Connect" }, { href: "/academics", label: "Academics" }, { href: "/my-ai", label: "My CABO AI" },
  { href: "/development-plan", label: "Development plan" }, { href: "/school-operations", label: "School operations" }, { href: "/privacy", label: "Privacy & my rights" },
];

export default function MyProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [look, setLook] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await api<Me>("/me/profile");
    setMe(data); setProfile(data.profile); setLook(data.appearance);
    setApprovals(await api<Approval[]>("/me/photo-approvals").catch(() => []));
  }
  useEffect(() => { load().catch(e => setError((e as Error).message)); }, []);

  function preview(next: Appearance) { setLook(next); applyAppearance(next); }
  async function saveLook() {
    setError(""); setMessage("");
    try { await api("/me/appearance", { method: "PUT", body: look }); setMessage("Saved. Your look follows you to every device you sign in on."); }
    catch (e) { setError((e as Error).message); }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault(); if (!profile) return;
    setError(""); setMessage("");
    try {
      await api("/me/profile", { method: "PUT", body: { displayName: profile.displayName, pronouns: profile.pronouns, bio: profile.bio, avatarStyle: profile.avatarStyle, avatarColor: profile.avatarColor } });
      setMessage("Profile saved."); await load();
    } catch (err) { setError((err as Error).message); }
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 300 * 1024) { setError("Choose a picture under 300 KB."); return; }
    setError(""); setMessage("");
    const r = await fetch("/api/me/photo", { method: "PUT", credentials: "include", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { setError(data.error ?? "That picture could not be used."); return; }
    setMessage(data.notice ?? "Picture saved.");
    if (profile) setProfile({ ...profile, avatarStyle: "photo" });
    await load();
  }
  async function removePhoto() { await api("/me/photo", { method: "DELETE" }); setMessage("Picture removed."); await load(); }
  async function decide(a: Approval, decision: "approved" | "declined") {
    try { await api(`/me/photo-approvals/${encodeURIComponent(a.learnerId)}`, { method: "POST", body: { decision } }); setApprovals(approvals.filter(x => x.learnerId !== a.learnerId)); }
    catch (e) { setError((e as Error).message); }
  }
  const toggle = (key: keyof Appearance) => preview({ ...look, [key]: !look[key] } as Appearance);
  const pin = (href: string) => preview({ ...look, pinned: look.pinned.includes(href) ? look.pinned.filter(h => h !== href) : [...look.pinned, href].slice(0, 8) });

  if (!profile || !me) return <main className="mx-auto max-w-4xl p-4 md:p-8" id="main-content">{error ? <p role="alert">{error}</p> : <p>Loading your profile…</p>}</main>;
  const photoUrl = me.photo?.url ?? null;
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8" id="main-content">
      <header className="flex items-center gap-4">
        <Avatar initials={profile.initials} color={profile.avatarColor} style={profile.avatarStyle} photoUrl={photoUrl} size={64} />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">My profile &amp; look</p>
          <h1 className="font-display text-3xl">{profile.displayName || profile.name || "Your profile"}</h1>
          {profile.pronouns && <p className="text-sm text-muted-foreground">{profile.pronouns}</p>}
        </div>
      </header>
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}
      {message && <p role="status" className="rounded-md border p-3 text-sm">{message}</p>}

      {approvals.length > 0 && (
        <section className="rounded-xl border p-5 space-y-3" aria-labelledby="approvals">
          <h2 id="approvals" className="font-display text-xl">Pictures waiting for your approval</h2>
          <p className="text-sm text-muted-foreground">Your child's picture is shown to their school only after you approve it.</p>
          {approvals.map(a => (
            <div key={a.learnerId} className="flex items-center gap-3">
              <img src={a.url} alt={`Picture uploaded by ${a.childName}`} width={64} height={64} className="rounded-full object-cover" />
              <span className="flex-1">{a.childName}</span>
              <button className="rounded-md bg-primary px-3 py-1 text-primary-foreground" onClick={() => decide(a, "approved")}>Approve</button>
              <button className="rounded-md border px-3 py-1" onClick={() => decide(a, "declined")}>Decline</button>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl border p-5 space-y-4" aria-labelledby="who">
        <h2 id="who" className="font-display text-xl flex items-center gap-2"><UserRound size={18} aria-hidden /> About you</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          <label className="block text-sm">Name you'd like to be called
            <input className="mt-1 block w-full rounded-md border p-2" maxLength={60} value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })} placeholder={profile.name} />
          </label>
          <label className="block text-sm">Pronouns (optional)
            <input className="mt-1 block w-full rounded-md border p-2" maxLength={30} value={profile.pronouns} onChange={e => setProfile({ ...profile, pronouns: e.target.value })} placeholder="e.g. she/her" />
          </label>
          <label className="block text-sm">A line about you (optional, no links or contact details)
            <textarea className="mt-1 block w-full rounded-md border p-2" maxLength={280} rows={2} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm">Picture</legend>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Avatar style">
              {(["initials", "pattern", "photo"] as const).map(s => (
                <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${profile.avatarStyle === s ? "border-primary" : ""}`}>
                  <input type="radio" name="avatar-style" className="sr-only" checked={profile.avatarStyle === s} onChange={() => setProfile({ ...profile, avatarStyle: s })} />
                  <Avatar initials={profile.initials} color={profile.avatarColor} style={s} photoUrl={photoUrl} size={40} />
                  <span className="text-sm">{s === "initials" ? "Initials" : s === "pattern" ? "Pattern" : photoUrl ? "My photo" : "Photo (upload below)"}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar colour">
              {(Object.keys(ACCENTS) as Appearance["accent"][]).map(c => (
                <button type="button" key={c} role="radio" aria-checked={profile.avatarColor === c} aria-label={ACCENTS[c].label}
                  className={`h-8 w-8 rounded-full border-2 ${profile.avatarColor === c ? "border-foreground" : "border-transparent"}`} style={{ background: ACCENTS[c].swatch }}
                  onClick={() => setProfile({ ...profile, avatarColor: c })} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1"><ImageIcon size={14} aria-hidden /> Upload a photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} />
              </label>
              {me.photo && <button type="button" className="underline" onClick={removePhoto}>Remove photo</button>}
              {me.photo?.status === "pending_guardian" && <span className="text-muted-foreground">Waiting for your parent or guardian to approve.</span>}
              {me.photo?.status === "declined" && <span className="text-muted-foreground">Your guardian did not approve this picture.</span>}
            </div>
            <p className="text-xs text-muted-foreground">Only people at your school and your verified guardians can see your photo. Learners' photos need a guardian's approval first.</p>
          </fieldset>
          <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Save profile</button>
        </form>
      </section>

      <section className="rounded-xl border p-5 space-y-4" aria-labelledby="look">
        <h2 id="look" className="font-display text-xl flex items-center gap-2"><Palette size={18} aria-hidden /> Look and feel</h2>
        <fieldset className="space-y-2"><legend className="text-sm">Theme</legend>
          <div className="flex gap-2">{(["system", "light", "dark"] as const).map(t => (
            <label key={t} className={`cursor-pointer rounded-md border px-3 py-1 text-sm ${look.theme === t ? "border-primary" : ""}`}>
              <input type="radio" name="theme" className="sr-only" checked={look.theme === t} onChange={() => preview({ ...look, theme: t })} />{t === "system" ? "Match my device" : t === "light" ? "Light" : "Dark"}
            </label>))}</div>
        </fieldset>
        <fieldset className="space-y-2"><legend className="text-sm">Accent colour</legend>
          <div className="flex flex-wrap gap-2">{(Object.keys(ACCENTS) as Appearance["accent"][]).map(c => (
            <button key={c} type="button" role="radio" aria-checked={look.accent === c} aria-label={ACCENTS[c].label}
              className={`h-9 w-9 rounded-full border-2 ${look.accent === c ? "border-foreground" : "border-transparent"}`} style={{ background: ACCENTS[c].swatch }}
              onClick={() => preview({ ...look, accent: c })} />))}</div>
        </fieldset>
        <label className="block text-sm">Text size: {Math.round(look.fontScale * 100)}%
          <input type="range" min={0.875} max={1.75} step={0.125} value={look.fontScale} className="mt-1 block w-full" onChange={e => preview({ ...look, fontScale: Number(e.target.value) })} />
        </label>
        <label className="block text-sm">Spacing
          <select className="mt-1 block w-full rounded-md border p-2" value={look.density} onChange={e => preview({ ...look, density: e.target.value as Appearance["density"] })}>
            <option value="comfortable">Comfortable</option><option value="compact">Compact (more on screen)</option><option value="spacious">Spacious (easier to read)</option>
          </select>
        </label>
        <label className="block text-sm">Font
          <select className="mt-1 block w-full rounded-md border p-2" value={look.font} onChange={e => preview({ ...look, font: e.target.value as Appearance["font"] })}>
            <option value="default">CABO default</option><option value="easy_read">Easy-read (wider letters and spacing, helps with dyslexia)</option><option value="serif">Classic serif</option><option value="mono">Typewriter</option>
          </select>
        </label>
      </section>

      <section className="rounded-xl border p-5 space-y-3" aria-labelledby="access">
        <h2 id="access" className="font-display text-xl flex items-center gap-2"><Accessibility size={18} aria-hidden /> Accessibility</h2>
        {([
          ["highContrast", "High contrast", "Black and white text and borders, with a strong focus outline."],
          ["reduceMotion", "Reduce motion", "Turns off animations and smooth scrolling."],
          ["underlineLinks", "Underline links", "Makes links easy to tell apart without relying on colour."],
          ["captionsDefault", "Captions on by default", "Videos and audio start with captions or a transcript."],
        ] as [keyof Appearance, string, string][]).map(([key, title, help]) => (
          <label key={key} className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={Boolean(look[key])} onChange={() => toggle(key)} />
            <span><span className="font-semibold">{title}</span><span className="block text-sm text-muted-foreground">{help}</span></span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">CABO also works with your device's screen reader (VoiceOver, TalkBack, NVDA, JAWS), zoom and voice control.</p>
      </section>

      <section className="rounded-xl border p-5 space-y-3" aria-labelledby="pins">
        <h2 id="pins" className="font-display text-xl flex items-center gap-2"><Pin size={18} aria-hidden /> Shortcuts at the top of your menu</h2>
        <p className="text-sm text-muted-foreground">Pick up to 8. Only pages your role can open will appear.</p>
        <div className="flex flex-wrap gap-2">{PINNABLE.map(p => (
          <button key={p.href} type="button" aria-pressed={look.pinned.includes(p.href)} onClick={() => pin(p.href)}
            className={`rounded-full border px-3 py-1 text-sm ${look.pinned.includes(p.href) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{p.label}</button>))}</div>
      </section>
      <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={saveLook}>Save look and accessibility</button>
    </main>
  );
}
