import { useEffect, useState } from 'react';
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}> };
export function InstallApp() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
    setStandalone(isStandalone());
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as PromptEvent); };
    const onInstalled = () => { setStandalone(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (standalone || !prompt) return null;
  return (
    <div role="region" aria-label="Install CABO app" style={{position:'fixed',bottom:16,right:16,zIndex:40,display:'flex',gap:12,alignItems:'center',padding:'12px 16px',background:'#0d1117',color:'#fff',borderRadius:12,boxShadow:'0 8px 24px #0004',maxWidth:'calc(100vw - 32px)'}}>
      <span style={{fontSize:13}}>Use CABO as an installed app</span>
      <button type="button" style={{border:'1px solid #c9a84c',color:'#fff',borderRadius:6,padding:'6px 12px'}} onClick={async()=>{const current=prompt;setPrompt(null);await current.prompt();await current.userChoice;}}>Install</button>
      <button type="button" aria-label="Dismiss install prompt" style={{color:'#fff',padding:4}} onClick={()=>setPrompt(null)}>×</button>
    </div>
  );
}
