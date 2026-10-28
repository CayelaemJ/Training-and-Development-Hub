import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}> };
type InstallState = { installed: boolean; available: boolean; busy: boolean; message: string; install: () => Promise<void> };
const InstallContext = createContext<InstallState | null>(null);
export function InstallAppProvider({children}: {children: ReactNode}) {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const check = () => setInstalled(display.matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone));
    check();
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as PromptEvent); setMessage(''); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setMessage('CABO has been installed. Open it from your apps.'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    display.addEventListener('change', check);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); display.removeEventListener('change', check); };
  }, []);
  const install = async () => {
    if (!prompt || busy) return;
    const current = prompt;
    setPrompt(null); setBusy(true); setMessage('');
    try {
      await current.prompt();
      const choice = await current.userChoice;
      setMessage(choice.outcome === 'accepted' ? 'Installation requested. Follow your browser’s instructions to finish.' : 'Installation cancelled. You can still install CABO from your browser menu.');
    } catch {
      setMessage('The install window could not open. Use your browser menu and follow the steps below.');
    } finally { setBusy(false); }
  };
  return <InstallContext.Provider value={{installed, available: Boolean(prompt), busy, message, install}}>{children}</InstallContext.Provider>;
}
export function useAppInstall() {
  const state = useContext(InstallContext);
  if (!state) throw new Error('InstallAppProvider is required');
  return state;
}
export function InstallApp() {
  const {installed} = useAppInstall();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <>
    {!online && <div className="app-connectivity" role="status">You’re offline. Reconnect before saving work or submitting a test.</div>}
    {!installed && window.location.pathname !== '/install' && <a className="app-install-link" href="/install">Get the CABO app <span aria-hidden="true">↗</span></a>}
  </>;
}
