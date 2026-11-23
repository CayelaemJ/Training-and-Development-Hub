import { useEffect, useRef, useState, type FormEvent } from "react";
import { Flag, Lock, MessageSquare, ShieldCheck } from "lucide-react";
import { api, mySchools, when, type SchoolOption } from "@/lib/schoolApi";
import { ReadAloud, VoiceInput } from "@/components/speech";

// Teacher-moderated class chat. One channel per subject; no private messages.
// Messages with contact details or links wait for a teacher; reports go to
// the school's accountability process.

type Channel = { courseId: number; course: string; channelId: number | null; status: string; moderator: boolean };
type Message = {
  id: number; author: string; mine: boolean; body: string; createdAt: string; status: string;
  authorId?: string | null; screenReason?: string | null; moderationReason?: string | null; notice?: string;
};
type Thread = { channelId: number; status: string; moderator: boolean; canPost: boolean; mutedUntil: string | null; messages: Message[] };

const reasons: [string, string][] = [
  ["bullying", "Bullying or unkind"], ["unsafe_contact", "Asking to meet or talk privately"], ["inappropriate", "Inappropriate content"],
  ["self_harm_concern", "Worried someone may hurt themselves"], ["spam", "Spam"], ["other", "Something else"],
];

export default function ClassChatPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [org, setOrg] = useState<number | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [retention, setRetention] = useState<number | null>(null);
  const [active, setActive] = useState<Channel | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [reporting, setReporting] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { mySchools().then(s => { const members = s.filter(x => x.role !== "guardian"); setSchools(members); if (members.length) setOrg(members[0].id); }).catch(() => setError("We could not load your schools.")); }, []);
  async function loadChannels() {
    if (!org) return;
    try { const r = await api<{ channels: Channel[]; retentionDays: number }>(`/organizations/${org}/chat/channels`); setChannels(r.channels); setRetention(r.retentionDays); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { setActive(null); setThread(null); loadChannels(); }, [org]);
  async function loadThread(c = active) {
    if (!org || !c?.channelId) return;
    try { setThread(await api<Thread>(`/organizations/${org}/chat/channels/${c.channelId}/messages`)); } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => {
    loadThread();
    if (!active?.channelId) return;
    const t = setInterval(() => { if (!document.hidden) loadThread(); }, 5000);
    return () => clearInterval(t);
  }, [active?.channelId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [thread?.messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault(); if (!org || !active?.channelId || !text.trim()) return;
    setError(""); setInfo("");
    try {
      const r = await api<{ notice: string | null }>(`/organizations/${org}/chat/channels/${active.channelId}/messages`, { method: "POST", body: { body: text } });
      setText(""); if (r.notice) setInfo(r.notice); await loadThread();
    } catch (err) { setError((err as Error).message); }
  }
  async function setChannel(c: Channel, status: "open" | "closed") {
    try { await api(`/organizations/${org}/chat/courses/${c.courseId}/channel`, { method: "PUT", body: { status } }); await loadChannels(); const fresh = { ...c, status }; setActive(fresh); }
    catch (e) { setError((e as Error).message); }
  }
  async function moderate(m: Message, action: "approve" | "hide") {
    const reason = window.prompt(action === "hide" ? "Why is this message being hidden?" : "Why is this message fine to show?");
    if (!reason || reason.trim().length < 3) return;
    try { await api(`/organizations/${org}/chat/channels/${active!.channelId}/messages/${m.id}/moderate`, { method: "POST", body: { action, reason } }); await loadThread(); }
    catch (e) { setError((e as Error).message); }
  }
  async function pause(m: Message) {
    if (!m.authorId) return;
    const reason = window.prompt("Why pause this learner from posting for one hour?");
    if (!reason || reason.trim().length < 3) return;
    try { await api(`/organizations/${org}/chat/channels/${active!.channelId}/mutes/${encodeURIComponent(m.authorId)}`, { method: "PUT", body: { minutes: 60, reason } }); setInfo("The learner is paused for one hour."); }
    catch (e) { setError((e as Error).message); }
  }
  async function report(m: Message, reason: string) {
    try { await api(`/organizations/${org}/chat/channels/${active!.channelId}/messages/${m.id}/report`, { method: "POST", body: { reason } }); setReporting(null); setInfo("Thank you. Your report has gone to the school and a named person will look at it."); await loadThread(); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Class chat</p>
        <h1 className="font-display text-3xl">Talk about your subjects, safely.</h1>
        <p className="text-muted-foreground">One chat per subject, watched by your teachers. There are no private messages. Messages with phone numbers, links or invitations to talk elsewhere wait for a teacher first.{retention ? ` Messages are kept for ${retention} days.` : ""}</p>
      </header>
      {schools.length > 1 && (
        <label className="block text-sm">School
          <select className="mt-1 block w-full rounded-md border p-2" value={org ?? ""} onChange={e => setOrg(Number(e.target.value))}>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}
      {info && <p role="status" className="rounded-md border p-3 text-sm">{info}</p>}
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <nav aria-label="Subject chats" className="space-y-2">
          {channels.length === 0 && <p className="text-sm text-muted-foreground">No class chats yet. Your teacher opens one for each subject.</p>}
          {channels.map(c => (
            <button key={c.courseId} onClick={() => { setActive(c); setInfo(""); setError(""); }} className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left ${active?.courseId === c.courseId ? "border-primary" : ""}`}>
              {c.status === "open" ? <MessageSquare size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
              <span className="flex-1">{c.course}</span>
              <span className="text-xs text-muted-foreground">{c.status === "not_started" ? "not open" : c.status}</span>
            </button>
          ))}
        </nav>
        <section className="rounded-xl border p-4 space-y-3" aria-live="polite">
          {!active && <p className="text-sm text-muted-foreground">Choose a subject.</p>}
          {active && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl flex-1">{active.course}</h2>
                {active.moderator && (active.status === "open"
                  ? <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setChannel(active, "closed")}>Close chat</button>
                  : <button className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground" onClick={() => setChannel(active, "open")}>Open chat for this class</button>)}
                {active.moderator && <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck size={14} aria-hidden /> You moderate this chat</span>}
              </div>
              <ol className="max-h-[60vh] space-y-2 overflow-y-auto">
                {thread?.messages.map(m => (
                  <li key={m.id} className={`rounded-lg border p-3 ${m.status !== "visible" ? "border-dashed" : ""}`}>
                    <p className="text-xs text-muted-foreground">{m.author} · {when(m.createdAt)}{m.status !== "visible" ? ` · ${m.status}${m.screenReason ? ` (${m.screenReason.replace(/_/g, " ")})` : ""}` : ""}</p>
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.notice && <p className="text-xs text-muted-foreground">{m.notice}</p>}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <ReadAloud text={`${m.author} said: ${m.body}`} label="Listen" />
                      {thread.moderator && m.status !== "visible" && <button className="underline" onClick={() => moderate(m, "approve")}>Show to class</button>}
                      {thread.moderator && m.status !== "hidden" && !m.mine && <button className="underline" onClick={() => moderate(m, "hide")}>Hide</button>}
                      {thread.moderator && !m.mine && m.authorId && <button className="underline" onClick={() => pause(m)}>Pause sender for 1 hour</button>}
                      {!m.mine && <button className="flex items-center gap-1 underline" onClick={() => setReporting(reporting === m.id ? null : m.id)}><Flag size={12} aria-hidden /> Report</button>}
                    </div>
                    {reporting === m.id && (
                      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Why are you reporting this?">
                        {reasons.map(([k, l]) => <button key={k} className="rounded-md border px-2 py-1 text-xs" onClick={() => report(m, k)}>{l}</button>)}
                      </div>
                    )}
                  </li>
                ))}
                <div ref={end} />
              </ol>
              {thread && (thread.canPost
                ? <form onSubmit={send} className="flex gap-2">
                    <label className="sr-only" htmlFor="chat-input">Message</label>
                    <input id="chat-input" className="flex-1 rounded-md border p-2" maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Ask or answer a question about this subject" />
                    <VoiceInput onText={v => setText(x => (x ? x + " " : "") + v)} />
                    <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" disabled={!text.trim()}>Send</button>
                  </form>
                : <p className="text-sm text-muted-foreground">{thread.mutedUntil ? `You are paused from posting until ${when(thread.mutedUntil)}.` : thread.status !== "open" ? "This chat is closed." : "You cannot post here."}</p>)}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
