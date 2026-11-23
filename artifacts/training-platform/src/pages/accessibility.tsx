// Assistive technology integration hub: explains and links every a11y feature
// built into CABO — screen readers, voice control, keyboard, Siri, Google
// Assistant, and third-party automation. All content is behind standard auth
// but can also be linked from the install/onboarding flow.
import { useEffect, useState } from "react";
import { Keyboard, Mic, Moon, Settings, Volume2, Zap } from "lucide-react";
import { ReadAloud } from "@/components/speech";

// A short summary read aloud on page focus so screen-reader users know what
// this page is before navigating into it.
const PAGE_SUMMARY =
  "Accessibility help for the CABO Learning Hub. Covers screen readers, keyboard shortcuts, voice control, Siri and Google Assistant integration, and how to adjust display and motion settings.";

type Section = { id: string; icon: React.ReactNode; title: string; body: React.ReactNode };

function Card({ id, icon, title, body }: Section) {
  return (
    <section className="rounded-xl border p-5 space-y-3" aria-labelledby={id}>
      <h2 id={id} className="font-display text-xl flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{body}</div>
    </section>
  );
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && <span className="mx-0.5 text-muted-foreground">+</span>}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
        </span>
      ))}
    </span>
  );
}

export default function AccessibilityPage() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    setPrefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPrefersDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  const sections: Section[] = [
    {
      id: "screen-readers",
      icon: <Volume2 size={18} aria-hidden />,
      title: "Screen readers",
      body: (
        <>
          <p>
            CABO is built to work with every major screen reader.  Every page has a
            <strong className="text-foreground"> skip-to-main-content link</strong> as the first focusable element —
            press <Shortcut keys={["Tab"]} /> when the page loads to jump straight to the content area.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {[
              ["VoiceOver (iPhone / iPad / Mac)", "Swipe right to move to next element · double-tap to activate"],
              ["TalkBack (Android)", "Swipe right to move · double-tap to activate"],
              ["NVDA (Windows)", "NVDA + Space to switch modes · H to jump between headings"],
              ["JAWS (Windows)", "F6 to move between regions · H for headings · B for buttons"],
              ["Narrator (Windows)", "Win + Ctrl + M to open Narrator settings"],
            ].map(([reader, hint]) => (
              <>
                <dt key={reader + "dt"} className="font-medium text-foreground">{reader}</dt>
                <dd key={reader + "dd"} className="text-muted-foreground">{hint}</dd>
              </>
            ))}
          </dl>
          <p>
            All live regions (chat, notifications, AI answers) are marked{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">aria-live="polite"</code> so your screen reader
            announces updates without interrupting you.
          </p>
        </>
      ),
    },
    {
      id: "keyboard",
      icon: <Keyboard size={18} aria-hidden />,
      title: "Keyboard navigation",
      body: (
        <>
          <p>Every feature is reachable by keyboard alone. Common shortcuts:</p>
          <ul className="space-y-1.5 list-none">
            {[
              [["Tab"], "Move to the next interactive element"],
              [["Shift", "Tab"], "Move to the previous interactive element"],
              [["Enter"], "Activate a button or link"],
              [["Space"], "Toggle a checkbox or open a combobox"],
              [["Esc"], "Close a dialog or dismiss a panel"],
              [["Arrow keys"], "Navigate within a menu, radio group, or slider"],
            ].map(([keys, desc]) => (
              <li key={(keys as string[]).join("+")} className="flex items-center gap-3">
                <Shortcut keys={keys as string[]} />
                <span>{desc as string}</span>
              </li>
            ))}
          </ul>
          <p>
            Focus outlines are always visible — if you've turned on
            <strong className="text-foreground"> high contrast</strong> in your profile settings,
            the focus ring is thicker and more prominent.
          </p>
        </>
      ),
    },
    {
      id: "voice-control",
      icon: <Mic size={18} aria-hidden />,
      title: "Voice control",
      body: (
        <>
          <p>
            CABO works with device voice control tools out of the box, because every interactive element has
            a visible label.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {[
              ["Voice Control (iPhone / iPad)", 'Say "Tap [button name]" to press anything on screen'],
              ["Voice Access (Android)", "Say the number shown on each element, or its label"],
              ["Voice Control (macOS)", 'Say "Click [button name]" or use numbered overlay'],
              ["Dragon NaturallySpeaking", "Commands work as expected; every field has an accessible name"],
            ].map(([tool, hint]) => (
              <>
                <dt key={tool + "dt"} className="font-medium text-foreground">{tool}</dt>
                <dd key={tool + "dd"} className="text-muted-foreground">{hint}</dd>
              </>
            ))}
          </dl>
          <p>
            In class chat, written exams and the AI tutor, tap the{" "}
            <Mic className="inline" size={12} aria-hidden /> microphone button to speak your message
            instead of typing.
          </p>
        </>
      ),
    },
    {
      id: "siri",
      icon: <Zap size={18} aria-hidden />,
      title: "Siri and Google Assistant",
      body: (
        <>
          <p>
            When CABO is installed as a home-screen app, Siri and Google Assistant can open specific pages
            directly from your voice.
          </p>
          <p className="font-medium text-foreground">Try saying:</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>"Open CABO study materials"</li>
            <li>"Open CABO practice tests"</li>
            <li>"Open CABO class chat"</li>
            <li>"Open CABO Raise a concern"</li>
            <li>"Open CABO profile"</li>
          </ul>
          <p>
            Siri uses the{" "}
            <strong className="text-foreground">PWA shortcuts</strong> in the installed app. Add CABO to
            your home screen first: in Safari, tap the share icon and choose{" "}
            <strong className="text-foreground">Add to Home Screen</strong>. In Chrome, tap the menu and
            choose <strong className="text-foreground">Add to Home Screen</strong> or{" "}
            <strong className="text-foreground">Install app</strong>.
          </p>
          <p>
            Google Assistant integration works on Android when the app is installed. Open the Google
            Assistant app, tap <strong className="text-foreground">Apps</strong> and choose CABO Hub to
            link the shortcuts.
          </p>
        </>
      ),
    },
    {
      id: "display",
      icon: <Moon size={18} aria-hidden />,
      title: "Display and motion",
      body: (
        <>
          <p>
            CABO respects your operating system's accessibility preferences automatically. Your current
            settings:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong className="text-foreground">Dark mode:</strong>{" "}
              {prefersDark ? "On (detected from your OS)" : "Off (detected from your OS)"}
            </li>
            <li>
              <strong className="text-foreground">Reduce motion:</strong>{" "}
              {prefersReducedMotion
                ? "On — CABO has disabled animations and smooth-scrolling"
                : "Off — animations are active"}
            </li>
          </ul>
          <p>
            You can override these on your{" "}
            <a href="/me" className="underline text-primary">Profile &amp; look</a>{" "}
            page, along with font size, spacing density, high contrast, and whether links are always
            underlined.
          </p>
          <p>
            All text can be scaled from 87.5 % to 175 % without horizontal scrolling. CABO also works
            with your OS zoom at any level.
          </p>
        </>
      ),
    },
    {
      id: "automation",
      icon: <Settings size={18} aria-hidden />,
      title: "Automation and third-party tools",
      body: (
        <>
          <p>
            CABO is a standard web app, so it works with browser-based automation and accessibility
            tools:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong className="text-foreground">Switch access (iOS / Android):</strong> Works via the
              standard focus-and-activate model; every focusable element receives keyboard focus.
            </li>
            <li>
              <strong className="text-foreground">Magnification (ZoomText, macOS Zoom):</strong> No
              clipping or hidden overflow — every element stays visible when zoomed.
            </li>
            <li>
              <strong className="text-foreground">Braille displays:</strong> Tested with VoiceOver on
              macOS and iOS. Landmark regions, headings, and button roles are exposed through the
              accessibility tree.
            </li>
            <li>
              <strong className="text-foreground">Eye tracking / head tracking:</strong> Works via voice
              control and standard focus management; no pointer-only interactions.
            </li>
            <li>
              <strong className="text-foreground">Microsoft Edge read aloud / Immersive Reader:</strong>{" "}
              The main content region is correctly identified so Edge can extract and read the text.
            </li>
          </ul>
          <p className="text-xs">
            If you find a feature that is not accessible with your assistive technology, use the{" "}
            <a href="/accountability" className="underline text-primary">Raise a concern</a> page. We
            treat accessibility issues as P0 bugs.
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Settings</p>
          <h1 className="font-display text-3xl">Accessibility &amp; assistive technology</h1>
          <p className="mt-1 text-muted-foreground">
            How CABO works with screen readers, voice control, Siri, Google Assistant, keyboard
            navigation, and more.
          </p>
        </div>
        <ReadAloud text={PAGE_SUMMARY} label="Read page summary" />
      </header>

      {sections.map(s => (
        <Card key={s.id} {...s} />
      ))}

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
        <h2 className="font-display text-xl">Still need help?</h2>
        <p className="text-sm text-muted-foreground">
          Use the{" "}
          <a href="/accountability" className="underline text-primary">Raise a concern</a> page to
          report any accessibility issue. Your message goes directly to a named staff member and we
          will respond within two working days. You can also speak your concern using the microphone
          button on that page.
        </p>
        <p className="text-sm text-muted-foreground">
          You can also adjust your display, font, motion and contrast settings on your{" "}
          <a href="/me" className="underline text-primary">Profile &amp; look</a> page.
        </p>
      </section>
    </div>
  );
}
