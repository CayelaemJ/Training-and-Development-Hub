import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";

// Built-in browser speech: read text aloud (blind, low-vision and dyslexic
// users) and speak instead of typing (motor and literacy needs). Uses the
// device's own voices and recognition; nothing extra is installed or sent to
// CABO. Buttons hide themselves where the browser has no support.

export function ReadAloud({ text, label = "Listen" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  if (!supported || !text.trim()) return null;
  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text.slice(0, 6000));
    const lang = document.documentElement.lang || navigator.language || "en-ZA";
    u.lang = lang;
    const voice = synth.getVoices().find(v => v.lang === lang) ?? synth.getVoices().find(v => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel(); synth.speak(u); setSpeaking(true);
  }
  return <button type="button" onClick={toggle} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs" aria-pressed={speaking}>
    {speaking ? <Square size={12} aria-hidden /> : <Volume2 size={12} aria-hidden />}{speaking ? "Stop reading" : label}
  </button>;
}

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function VoiceInput({ onText, label = "Speak" }: { onText: (text: string) => void; label?: string }) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const Ctor = typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;
  useEffect(() => () => rec.current?.stop(), []);
  if (!Ctor) return null;
  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const r: Recognition = new Ctor();
    r.lang = document.documentElement.lang || navigator.language || "en-ZA";
    r.interimResults = false; r.continuous = false;
    r.onresult = (e: any) => { const t = Array.from(e.results as ArrayLike<any>).map((x: any) => x[0]?.transcript ?? "").join(" ").trim(); if (t) onText(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }
  return <button type="button" onClick={toggle} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs" aria-pressed={listening}>
    {listening ? <Square size={12} aria-hidden /> : <Mic size={12} aria-hidden />}{listening ? "Stop listening" : label}
  </button>;
}
