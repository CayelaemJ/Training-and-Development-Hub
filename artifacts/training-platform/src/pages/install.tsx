import { useState } from 'react';
import { Download, Monitor, Smartphone, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAppInstall } from '@/components/install-app';

type Device = 'android' | 'iphone' | 'computer';
function currentDevice(): Device {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
  return /Android/i.test(navigator.userAgent) ? 'android' : 'computer';
}
const instructions: Record<Device, {title: string; steps: string[]}> = {
  android: {title: 'Android phone or tablet', steps: ['Open CABO in Chrome on your device.', 'Tap Install CABO when available, or open Chrome’s ⋮ menu and choose Install app or Install and create shortcut → Install.', 'Confirm installation, then open CABO from your home screen or app drawer.']},
  iphone: {title: 'iPhone or iPad', steps: ['Open this page in Safari.', 'Open Share (from the page menu or toolbar), then choose Add to Home Screen.', 'Turn on Open as Web App if shown, then tap Add. Open CABO from your home screen.']},
  computer: {title: 'Windows PC, Mac or Chromebook', steps: ['Open CABO in Chrome or Microsoft Edge.', 'Use the install icon in the address bar, or Chrome’s menu → Cast, save, and share → Install page as app. In Edge, look under Apps.', 'Confirm, then open CABO from your apps and pin it to your taskbar. On Mac with Safari, choose Share → Add to Dock.']},
};
export default function InstallPage() {
  const [device, setDevice] = useState<Device>(currentDevice);
  const {installed, available, busy, message, install} = useAppInstall();
  return <main className="install-page">
    <a href="/" className="install-back"><ArrowLeft size={17} /> Back to CABO</a>
    <section className="install-hero">
      <img src="/icons/cabo-192.png" width="96" height="96" alt="CABO Learning Hub app icon" />
      <p className="eyebrow">YOUR LEARNING, WITH YOU</p>
      <h1 className="font-display">CABO Learning Hub.<br />At home on your device.</h1>
      <p>Your subjects, practice tests and school workspace in one app. Install it on your phone or computer and sign in with your CABO account.</p>
      {installed ? <p className="install-success" role="status"><CheckCircle2 size={21} /> You’re using the installed CABO app.</p> : available ? <button className="button button-primary" disabled={busy} onClick={install}><Download size={19} />{busy ? 'Opening installation…' : 'Install CABO'}</button> : <p className="install-hint">Follow the steps for your device below. Installation is handled by your browser.</p>}
      {message && <p role="status" className="install-hint">{message}</p>}
      <span className="install-meta">Same account · Automatic web updates · No separate app download required</span>
    </section>
    <section className="install-guide" aria-labelledby="install-guide-title">
      <h2 id="install-guide-title" className="font-display">Make CABO yours.</h2>
      <div className="install-devices" role="group" aria-label="Choose your device">
        {(['android', 'iphone', 'computer'] as const).map(item => <button key={item} aria-pressed={device === item} onClick={() => setDevice(item)}>{item === 'computer' ? <Monitor size={20} /> : <Smartphone size={20} />}{item === 'android' ? 'Android' : item === 'iphone' ? 'iPhone & iPad' : 'PC & Mac'}</button>)}
      </div>
      <h3>{instructions[device].title}</h3>
      <ol>{instructions[device].steps.map(step => <li key={step}>{step}</li>)}</ol>
    </section>
    <section className="install-details">
      <article><h2>One CABO account.</h2><p>Your learning stays connected across the web and installed app. You may need to sign in again after installing.</p></article>
      <article><h2>Stay connected.</h2><p>Lessons, uploads, tutoring and test submissions need internet. If your connection drops, CABO shows a reconnect screen. This installation does not download private learner records for offline use.</p></article>
      <article><h2>Using a shared device?</h2><p>Sign out when you finish. You can remove the app through your device’s app settings or browser’s app menu.</p></article>
    </section>
    <footer className="install-footer"><img src="/cabo-wordmark.svg" width="125" height="42" alt="CABO Solutions" /><p>Available to install from your browser. Store editions are not published yet.</p></footer>
  </main>;
}
