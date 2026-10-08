import { useEffect, useMemo, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import WrittenExamsPage from '@/pages/written-exams';
import OrganizationsPage from '@/pages/organizations';
import AcademicsPage from '@/pages/academics';
import PotentialPage from '@/pages/potential';
import LearnerJourneyPage from '@/pages/learner-journey';
import InstitutionRecordsPage from '@/pages/institution-records';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { useAuth } from '@workspace/replit-auth-web';
import {
  useRequestUploadUrl, useListMaterials, useCreateMaterial, useDeleteMaterial,
  useGenerateQuiz, useListQuizzes, useGetQuiz, useSubmitQuizAttempt, useGetDashboard,
  getListMaterialsQueryKey, getListQuizzesQueryKey, getGetQuizQueryKey, getGetDashboardQueryKey,
} from '@workspace/api-client-react';
import type { QuizDetail, QuizAttemptResult, StudyMaterial, QuizSummary } from '@workspace/api-client-react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Check,
  CheckCircle2, ChevronRight, CircleHelp, Clock3, FileText, FileUp, GraduationCap,
  LayoutDashboard, LoaderCircle, LogOut, Plus, RotateCcw, Search,
  Sparkles, Target, Trash2, X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/materials', label: 'Study materials', icon: BookOpen },
  { href: '/quizzes', label: 'Practice tests', icon: BrainCircuit },
  { href: '/written-exams', label: 'Written exams', icon: FileText },
  { href: '/organizations', label: 'Organizations', icon: GraduationCap },
  { href: '/academics', label: 'Academics', icon: BookOpen },
  { href: '/potential', label: 'My potential', icon: Target },
  { href: '/learner-journey', label: 'My journey', icon: GraduationCap },
  { href: '/institution-records', label: 'Institutions', icon: BookOpen },
];

function BusyScreen() {
  return <div className="min-h-[100dvh] grid place-items-center"><div className="flex items-center gap-3 text-muted-foreground"><span className="skeleton-dot" /><span>Getting your study space ready</span></div></div>;
}

function SignedOut() {
  const { login } = useAuth();
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [signInError,setSignInError] = useState('');
  const [submitting,setSubmitting] = useState(false);
  const isolatedTest = import.meta.env.VITE_CABO_TEST_LOGIN === 'true';
  async function testSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);setSignInError('');
    try {
      const response = await fetch('/api/test-login', {method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,password})});
      if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error ?? 'Sign-in failed')}
      window.location.assign('/');
    } catch(error) {setSignInError(error instanceof Error?error.message:'Sign-in failed');}
    finally {setSubmitting(false);}
  }
  return <main className="auth-screen">
    <div className="auth-brand"><Mark /><span>Training & Development Hub</span></div>
    <section className="auth-panel">
      <div className="auth-symbol"><GraduationCap size={26} /></div>
      <p className="eyebrow">A clearer way to study</p>
      <h1 className="font-display">Make your notes<br />work harder.</h1>
      <p className="auth-copy">Turn the material you already have into focused practice. Pick up where you left off, whenever you’re ready.</p>
      {isolatedTest ? <form onSubmit={testSignIn} className="space-y-3" aria-label="CABO test sign-in">
        <label className="block text-sm">Username<input autoComplete="username" required value={username} onChange={event=>setUsername(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-3 text-foreground" /></label>
        <label className="block text-sm">Password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-3 text-foreground" /></label>
        {signInError && <p role="alert" className="text-sm text-red-700">{signInError}</p>}
        <button type="submit" disabled={submitting} className="button button-primary auth-login" data-testid="button-login">{submitting?'Signing in…':'Sign in to CABO test hub'} <ArrowRight size={17} /></button>
      </form> : <button className="button button-primary auth-login" onClick={login} data-testid="button-login">Continue to Training & Development Hub <ArrowRight size={17} /></button>}
      <div className="auth-foot"><span>Private by design</span><span className="auth-dot" /><span>Your materials stay yours</span></div>
    </section>
    <p className="auth-aside">A study companion, not another distraction.</p>
  </main>;
}

function AuthGate() {
  const auth = useAuth();
  if (auth.isLoading) return <BusyScreen />;
  return auth.isAuthenticated ? <AppShell user={auth.user} logout={auth.logout} /> : <SignedOut />;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={DashboardPage} />
    <Route path="/materials" component={MaterialsPage} />
    <Route path="/materials/:id" component={MaterialConfigurePage} />
    <Route path="/quizzes" component={QuizzesPage} />
    <Route path="/written-exams" component={WrittenExamsPage} />
    <Route path="/organizations" component={OrganizationsPage} />
    <Route path="/academics" component={AcademicsPage} />
    <Route path="/potential" component={PotentialPage} />
    <Route path="/learner-journey" component={LearnerJourneyPage} />
    <Route path="/institution-records" component={InstitutionRecordsPage} />
    <Route path="/quiz/:id" component={QuizPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function AppShell({ user, logout }: { user: any; logout: () => void }) {
  const signOut = import.meta.env.VITE_CABO_TEST_LOGIN === 'true' ? async () => { await fetch('/api/test-logout',{method:'POST',credentials:'include'});window.location.assign('/'); } : logout;
  const [location] = useLocation();
  const title = location.startsWith('/materials/') ? 'Build a practice test' : location === '/materials' ? 'Study materials' : location === '/quizzes' ? 'Practice tests' : location === '/written-exams' ? 'Written examinations' : location === '/organizations' ? 'Organizations' : location === '/academics' ? 'Academics' : location === '/potential' ? 'My potential' : location === '/learner-journey' ? 'My journey' : location === '/institution-records' ? 'Institutions' : location.startsWith('/quiz/') ? 'Your practice session' : 'Your study space';
  const initials = `${user?.firstName?.[0] ?? user?.email?.[0] ?? 'S'}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  return <div className="app-frame">
    <aside className="sidebar">
      <Link href="/" className="brand"><Mark /><span>Training & Development Hub</span></Link>
      <div className="side-label">YOUR WORKSPACE</div>
      <nav className="side-nav">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${location === href || (href === '/materials' && location.startsWith('/materials/')) ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{href === '/materials' && <span className="nav-chevron"><ChevronRight size={14} /></span>}</Link>)}
      </nav>
      <div className="side-bottom">
        <div className="side-note"><span className="note-mark"><Target size={17} /></span><p>Small sessions add up.<br /><strong>Keep your rhythm.</strong></p></div>
        <div className="profile-row">
          <div className="avatar">{initials}</div>
          <div className="profile-copy"><strong>{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Learner'}</strong><span>{user?.email || 'Your account'}</span></div>
          <button className="icon-button logout-button" onClick={signOut} aria-label="Log out" title="Log out" data-testid="button-logout"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar">
        <Link href="/" className="topbar-cabo-identity" aria-label="CABO Solutions Training and Development Hub home"><Mark /><span>Training &amp; Development Hub</span></Link>
        <div className="crumb"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div>
        <div className="topbar-right"><span className="quiet-status"><span className="status-dot" /> Your study space</span><div className="avatar avatar-small">{initials}</div></div>
      </header>
      <main className="main-content"><Router /></main>
      <footer className="footer cabo-product-footer"><Mark /><span>Training &amp; Development Hub</span><span className="footer-divider" /> A CABO Solutions product.</footer>
    </div>
  </div>;
}

function Mark() { return <img className="cabo-logo" src="/cabo-wordmark.svg" alt="CABO Solutions" width={140} height={47} />; }

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading page-enter"><div><p className="eyebrow">{kicker}</p><h1 className="font-display">{title}</h1><p className="page-description">{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function Metric({ label, value, icon: Icon, note, accent }: { label: string; value: string | number; icon: any; note: string; accent?: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${accent || ''}`}><Icon size={18} /></span></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

function QueryNotice({ retry, message = 'Something interrupted this request.' }: { retry: () => void; message?: string }) {
  return <div className="notice-error"><span className="error-icon"><X size={16} /></span><div><b>We couldn’t load this yet</b><p>{message}</p></div><button className="button button-outline button-small" onClick={retry} data-testid="button-retry">Try again</button></div>;
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="skeleton-list">{Array.from({ length: count }, (_, i) => <div className="skeleton-row" key={i}><span className="skeleton-block" /><span className="skeleton-line" /><span className="skeleton-line short" /></div>)}</div>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-art"><span className="empty-orbit orbit-a" /><span className="empty-orbit orbit-b" /><span className="empty-icon"><Icon size={25} /></span></div><h3 className="font-display">{title}</h3><p>{description}</p>{action}</div>;
}

function DashboardPage() {
  const dashboard = useGetDashboard();
  const materials = useListMaterials();
  const recent = dashboard.data?.recentQuizzes ?? [];
  return <div className="page-enter">
    <PageHeading kicker="A little progress, every day" title="Your study space" description="Everything you need to turn what you’re learning into lasting knowledge." action={<Link href="/materials" className="button button-primary" data-testid="link-add-material"><Plus size={17} /> Add material</Link>} />
    {dashboard.isLoading ? <div className="metrics-grid"><div className="metric-skeleton" /><div className="metric-skeleton" /><div className="metric-skeleton" /><div className="metric-skeleton" /></div> : dashboard.isError ? <QueryNotice retry={() => dashboard.refetch()} /> : <div className="metrics-grid">
      <Metric label="Materials" value={dashboard.data?.totalMaterials ?? 0} icon={BookOpen} note="Ready when you are" />
      <Metric label="Practice tests" value={dashboard.data?.totalQuizzes ?? 0} icon={BrainCircuit} note="Built from your notes" accent="mint" />
      <Metric label="Sessions completed" value={dashboard.data?.completedAttempts ?? 0} icon={CheckCircle2} note="Every attempt counts" accent="gold" />
      <Metric label="Average score" value={dashboard.data?.averageScore == null ? '—' : `${Math.round(dashboard.data.averageScore)}%`} icon={Target} note="Across completed sessions" accent="blue" />
    </div>}
    <section className="dashboard-lower">
      <div className="section-panel recent-panel">
        <div className="section-head"><div><p className="eyebrow">Keep the momentum</p><h2 className="font-display">Recent practice</h2></div><Link href="/quizzes" className="text-link">All tests <ArrowRight size={15} /></Link></div>
        {dashboard.isLoading ? <SkeletonRows /> : dashboard.isError ? null : recent.length ? <div className="activity-list">{recent.slice(0, 5).map((quiz, i) => <QuizRow quiz={quiz} key={quiz.id} index={i} />)}</div> : <EmptyState icon={BrainCircuit} title="Your first practice test is waiting" description="Add a study material, then create a test that fits the way you learn." action={<Link href="/materials" className="button button-outline">Explore materials <ArrowRight size={16} /></Link>} />}
      </div>
      <aside className="study-aside">
        <div className="aside-header"><span className="aside-kicker">NEXT STEP</span><span className="aside-spark"><Sparkles size={16} /></span></div>
        <h2 className="font-display">Turn one good<br />note into a test.</h2>
        <p>Choose a source, set your pace, and see what sticks.</p>
        <Link href="/materials" className="aside-link">Browse your materials <ArrowUpRight size={16} /></Link>
        <div className="aside-lines"><i /><i /><i /><i /><i /><i /><i /></div>
      </aside>
    </section>
    {!materials.isLoading && materials.data && materials.data.length === 0 && !dashboard.isLoading && <div className="first-visit"><div className="first-visit-icon"><FileUp size={20} /></div><div><strong>Start with what you have</strong><p>Upload a class handout, lecture notes, or a reading to begin.</p></div><Link href="/materials" className="button button-primary button-small">Upload material <ArrowRight size={15} /></Link></div>}
  </div>;
}

function QuizRow({ quiz, index = 0 }: { quiz: QuizSummary; index?: number }) {
  const score = quiz.latestScore;
  return <Link href={`/quiz/${quiz.id}`} className="activity-row" data-testid={`row-quiz-${quiz.id}`}>
    <span className={`row-icon row-icon-${index % 3}`}><BrainCircuit size={18} /></span>
    <span className="row-main"><strong>{quiz.title}</strong><small>{quiz.materialTitle} <span className="mini-separator">·</span> {quiz.questionCount} questions <span className="mini-separator">·</span> {quiz.difficulty}</small></span>
    <span className={`score-chip ${score == null ? 'score-empty' : score >= 70 ? 'score-good' : 'score-low'}`}>{score == null ? 'Not attempted' : `${Math.round(score)}%`}</span>
    <span className="row-date">{formatDistanceToNow(new Date(quiz.createdAt), { addSuffix: true })}</span><ChevronRight size={16} className="row-arrow" />
  </Link>;
}

function MaterialsPage() {
  const queryClient = useQueryClient();
  const materials = useListMaterials();
  const requestUrl = useRequestUploadUrl();
  const createMaterial = useCreateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const busy = uploading || requestUrl.isPending || createMaterial.isPending;
  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { setError('Files must be 30 MB or smaller.'); event.target.value = ''; return; }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'pdf', 'docx'].includes(ext || '')) { setError('Choose a TXT, PDF, or DOCX file.'); return; }
    setSelectedFile(file); setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')); setError('');
  };
  const upload = async () => {
    if (!selectedFile || !title.trim()) { setError('Add a title and choose a file to continue.'); return; }
    try {
      setUploading(true); setError('');
      const contentType = selectedFile.type || (selectedFile.name.endsWith('.txt') ? 'text/plain' : selectedFile.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const signed = await requestUrl.mutateAsync({ data: { name: selectedFile.name, size: selectedFile.size, contentType } });
      const put = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: selectedFile });
      if (!put.ok) throw new Error('The file could not be uploaded. Please try again.');
      await createMaterial.mutateAsync({ data: { title: title.trim(), objectPath: signed.objectPath } });
      await queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setSelectedFile(null); setTitle(''); setShowUpload(false); if (fileRef.current) fileRef.current.value = '';
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload did not finish. Please try again.'); }
    finally { setUploading(false); }
  };
  const remove = (material: StudyMaterial) => {
    if (!window.confirm(`Delete “${material.title}” from your materials?`)) return;
    deleteMaterial.mutate({ id: material.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } });
  };
  const startUpload = () => { setShowUpload(true); setError(''); };
  return <div className="page-enter">
    <PageHeading kicker="Your source library" title="Study materials" description="A home for the notes and readings you want to know by heart." action={<button className="button button-primary" onClick={startUpload} data-testid="button-add-material"><Plus size={17} /> Add material</button>} />
    {showUpload && <section className="upload-panel">
      <div className="upload-panel-heading"><div><p className="eyebrow">NEW SOURCE</p><h2 className="font-display">Bring your notes in</h2></div><button className="icon-button" onClick={() => { setShowUpload(false); setError(''); }} aria-label="Close upload panel" data-testid="button-close-upload"><X size={18} /></button></div>
      <div className="upload-form-grid">
        <label className="field-label">Give it a name<input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 4 · Cell biology" data-testid="input-material-title" /></label>
        <div className="field-label">Choose a file<label className={`file-drop ${selectedFile ? 'has-file' : ''}`} htmlFor="material-file">
          <input id="material-file" ref={fileRef} type="file" accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onSelect} data-testid="input-material-file" />
          <span className="file-drop-icon">{selectedFile ? <FileText size={21} /> : <FileUp size={21} />}</span><span><strong>{selectedFile?.name || 'Choose a document'}</strong><small>{selectedFile ? formatBytes(selectedFile.size) : 'PDF, DOCX, or TXT · up to 30 MB'}</small></span><span className="choose-file">{selectedFile ? 'Change' : 'Browse'}</span>
        </label></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="upload-actions"><span className="privacy-hint"><Check size={14} /> Only you can access your materials</span><button className="button button-primary" disabled={busy || !selectedFile || !title.trim()} onClick={upload} data-testid="button-upload-save">{busy ? <><LoaderCircle className="spin" size={17} /> Uploading…</> : <>Upload material <ArrowRight size={16} /></>}</button></div>
    </section>}
    <section className="materials-section">
      <div className="section-head materials-head"><div><p className="eyebrow">YOUR LIBRARY</p><h2 className="font-display">{materials.data?.length ?? '—'} materials</h2></div><span className="library-subtitle">Build a test from any source</span></div>
      {materials.isLoading ? <SkeletonRows count={4} /> : materials.isError ? <QueryNotice retry={() => materials.refetch()} /> : materials.data?.length ? <div className="materials-grid">{materials.data.map((material, i) => <MaterialCard key={material.id} material={material} index={i} onDelete={() => remove(material)} deleting={deleteMaterial.isPending} />)}</div> : <EmptyState icon={FileText} title="A good place to begin" description="Add a study document to turn your own notes into targeted practice." action={<button className="button button-primary" onClick={startUpload} data-testid="button-empty-upload"><Plus size={16} /> Add your first material</button>} />}
    </section>
  </div>;
}

function MaterialCard({ material, index, onDelete, deleting }: { material: StudyMaterial; index: number; onDelete: () => void; deleting: boolean }) {
  const suffix = material.fileName.split('.').pop()?.toUpperCase() || 'FILE';
  return <article className="material-card" data-testid={`card-material-${material.id}`}>
    <div className="material-card-top"><div className={`file-icon file-icon-${index % 3}`}><FileText size={21} /></div><div className="material-menu"><button onClick={onDelete} disabled={deleting} className="icon-button delete-icon" aria-label={`Delete ${material.title}`} title="Delete material" data-testid={`button-delete-material-${material.id}`}><Trash2 size={16} /></button></div></div>
    <div className="file-kind">{suffix} DOCUMENT <span>·</span> {formatBytes(material.sizeBytes)}</div>
    <h3 className="font-display material-title">{material.title}</h3>
    <p className="material-meta">{material.characterCount.toLocaleString()} characters <span>·</span> added {formatDistanceToNow(new Date(material.createdAt), { addSuffix: true })}</p>
    <div className="material-card-bottom"><span className="source-ready"><span /> Ready to use</span><Link href={`/materials/${material.id}`} className="button button-outline button-small" data-testid={`link-configure-material-${material.id}`}>Create a test <ArrowRight size={14} /></Link></div>
  </article>;
}

function MaterialConfigurePage() {
  const params = useParams<{ id: string }>();
  const materialId = Number(params.id);
  const materials = useListMaterials();
  const queryClient = useQueryClient();
  const generateQuiz = useGenerateQuiz();
  const material = materials.data?.find((item) => item.id === materialId);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [options, setOptions] = useState<4 | 6>(4);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const create = () => {
    setError('');
    generateQuiz.mutate({ id: materialId, data: { questionCount: count, difficulty, optionCount: options } }, {
      onSuccess: async (quiz) => { await queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() }); await queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setLocation(`/quiz/${quiz.id}`); },
       onError: (error) => setError(error instanceof Error ? error.message.replace(/^HTTP \d{3} [^:]+:\s*/, '') : 'We couldn’t create that test. Check your material and try again.'),
    });
  };
  if (materials.isLoading) return <div className="page-enter"><SkeletonRows count={2} /></div>;
  if (materials.isError) return <QueryNotice retry={() => materials.refetch()} />;
  if (!material) return <div className="page-enter"><Link href="/materials" className="back-link"><ArrowLeft size={16} /> Back to materials</Link><EmptyState icon={FileText} title="This material is not here" description="It may have been removed. Choose another source from your library." action={<Link href="/materials" className="button button-outline">Browse materials</Link>} /></div>;
  return <div className="page-enter">
    <Link href="/materials" className="back-link"><ArrowLeft size={16} /> All materials</Link>
    <div className="configure-layout">
      <div className="configure-copy"><p className="eyebrow">MAKE IT YOURS</p><h1 className="font-display">A practice test<br />that fits your focus.</h1><p>Set the pace, choose the depth, and let your material do the rest.</p>
        <div className="source-preview"><div className="file-icon file-icon-1"><FileText size={21} /></div><div><small>YOUR SOURCE</small><strong>{material.title}</strong><span>{material.fileName} · {formatBytes(material.sizeBytes)}</span></div><CheckCircle2 size={18} className="source-check" /></div>
      </div>
      <section className="configure-panel">
        <div className="configure-step"><span className="step-number">01</span><div><h2 className="font-display">Question count</h2><p>How much time do you have?</p></div></div>
        <div className="count-control"><button className="count-button" aria-label="Decrease question count" disabled={count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))} data-testid="button-count-decrease">−</button><div className="count-display"><strong>{count}</strong><span>questions</span></div><button className="count-button" aria-label="Increase question count" disabled={count >= 30} onClick={() => setCount((n) => Math.min(30, n + 1))} data-testid="button-count-increase">+</button></div>
        <input className="range-slider" type="range" min="1" max="30" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Question count" data-testid="input-question-count" />
        <div className="range-labels"><span>1 question</span><span>30 questions</span></div>
        <div className="configure-step step-spaced"><span className="step-number">02</span><div><h2 className="font-display">Difficulty</h2><p>Choose the kind of challenge</p></div></div>
        <div className="choice-row difficulty-choices">{(['beginner', 'intermediate', 'advanced'] as const).map((item) => <button key={item} className={`choice-button ${difficulty === item ? 'selected' : ''}`} onClick={() => setDifficulty(item)} data-testid={`button-difficulty-${item}`}><span className={`choice-level ${item}`} /><strong>{item[0].toUpperCase() + item.slice(1)}</strong>{difficulty === item && <Check size={15} />}</button>)}</div>
        <div className="configure-step step-spaced"><span className="step-number">03</span><div><h2 className="font-display">Answer options</h2><p>How many choices per question?</p></div></div>
        <div className="choice-row option-choices">{([4, 6] as const).map((n) => <button key={n} className={`option-button ${options === n ? 'selected' : ''}`} onClick={() => setOptions(n)} data-testid={`button-options-${n}`}><span className="option-dots">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span><strong>{n} options</strong>{options === n && <Check size={15} />}</button>)}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary generate-button" onClick={create} disabled={generateQuiz.isPending} data-testid="button-generate-quiz">{generateQuiz.isPending ? <><LoaderCircle className="spin" size={17} /> Building your test…</> : <>Create practice test <ArrowRight size={17} /></>}</button>
         <p className="generate-foot"><Sparkles size={13} /> Generating a test sends extracted text to OpenAI; your original file stays in your private library.</p>
      </section>
    </div>
  </div>;
}

function QuizzesPage() {
  const quizzes = useListQuizzes();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => (quizzes.data ?? []).filter((q) => `${q.title} ${q.materialTitle}`.toLowerCase().includes(search.toLowerCase())), [quizzes.data, search]);
  return <div className="page-enter">
    <PageHeading kicker="Made from what you know" title="Practice tests" description="Your past tests, ready for another round of learning." action={<Link href="/materials" className="button button-primary"><Plus size={17} /> New test</Link>} />
    <div className="list-toolbar"><div className="list-count"><span>{quizzes.data?.length ?? 0}</span> {quizzes.data?.length === 1 ? 'practice test' : 'practice tests'}</div><label className="search-field"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a test…" aria-label="Search practice tests" data-testid="input-search-quizzes" />{search && <button onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={14} /></button>}</label></div>
    <section className="quiz-list-panel">
      {quizzes.isLoading ? <SkeletonRows count={5} /> : quizzes.isError ? <QueryNotice retry={() => quizzes.refetch()} /> : filtered.length ? <div className="activity-list">{filtered.map((quiz, i) => <QuizRow key={quiz.id} quiz={quiz} index={i} />)}</div> : search ? <EmptyState icon={Search} title="No tests match that search" description="Try a different title or material name." action={<button className="button button-outline" onClick={() => setSearch('')}>Clear search</button>} /> : <EmptyState icon={BrainCircuit} title="No practice tests yet" description="Start with one of your study materials and build a test in moments." action={<Link href="/materials" className="button button-primary"><Plus size={16} /> Build your first test</Link>} />}
    </section>
  </div>;
}

function QuizPage() {
  const params = useParams<{ id: string }>();
  const quizId = Number(params.id);
  const quizQuery = useGetQuiz(quizId, { query: { enabled: Number.isFinite(quizId), queryKey: getGetQuizQueryKey(quizId) } });
  const submitAttempt = useSubmitQuizAttempt();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const quiz = quizQuery.data as QuizDetail | undefined;
  useEffect(() => { setAnswers([]); setResult(null); }, [quizId]);
  const setAnswer = (index: number, value: number) => setAnswers((prev) => { const next = [...prev]; next[index] = value; return next; });
  const submit = () => {
    if (!quiz || answers.length !== quiz.questions.length || answers.some((answer) => answer === undefined || answer < 0)) return;
    submitAttempt.mutate({ id: quizId, data: { answers } }, { onSuccess: async (attempt) => { setResult(attempt); await queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() }); await queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }, onError: () => window.alert('Your answers could not be submitted. Please try again.') });
  };
  const restart = () => { setResult(null); setAnswers([]); };
  if (quizQuery.isLoading) return <div className="page-enter"><SkeletonRows count={3} /></div>;
  if (quizQuery.isError || !quiz) return <div className="page-enter"><QueryNotice retry={() => quizQuery.refetch()} message="We couldn’t find this practice test." /><Link href="/quizzes" className="back-link"><ArrowLeft size={16} /> All practice tests</Link></div>;
  if (result) return <QuizReview quiz={quiz} result={result} onRetry={restart} />;
  const answeredCount = answers.filter((answer) => answer !== undefined && answer >= 0).length;
  return <div className="quiz-taking page-enter">
    <Link href="/quizzes" className="back-link"><ArrowLeft size={16} /> Leave test</Link>
    <div className="quiz-heading"><div><p className="eyebrow">FOCUSED PRACTICE</p><h1 className="font-display">{quiz.title}</h1><p className="quiz-subtitle">{quiz.questions.length} questions <span>·</span> {quiz.difficulty} <span>·</span> {quiz.optionCount} choices</p></div><div className="quiz-progress"><span>{answeredCount} <small>of {quiz.questions.length} answered</small></span><div className="progress-track"><i style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }} /></div></div></div>
    <div className="question-stack">{quiz.questions.map((question, i) => <section className="question-card" key={`${i}-${question.prompt}`} data-testid={`card-question-${i + 1}`}>
      <div className="question-meta"><span>QUESTION {String(i + 1).padStart(2, '0')}</span><span>{answers[i] === undefined ? 'Not answered' : 'Answered'}</span></div>
      <h2>{question.prompt}</h2><div className="answer-options">{question.options.map((option, optionIndex) => <button key={optionIndex} className={`answer-option ${answers[i] === optionIndex ? 'selected' : ''}`} onClick={() => setAnswer(i, optionIndex)} data-testid={`button-answer-${i}-${optionIndex}`}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>{answers[i] === optionIndex && <Check size={16} />}</button>)}</div>
    </section>)}</div>
    <div className="submit-strip"><div><span className="submit-progress-dot" />{answeredCount === quiz.questions.length ? 'You’re all set to submit.' : `${quiz.questions.length - answeredCount} ${quiz.questions.length - answeredCount === 1 ? 'question' : 'questions'} left to answer.`}</div><button className="button button-primary" onClick={submit} disabled={answeredCount !== quiz.questions.length || submitAttempt.isPending} data-testid="button-submit-quiz">{submitAttempt.isPending ? <><LoaderCircle className="spin" size={17} /> Checking answers…</> : <>Finish test <ArrowRight size={16} /></>}</button></div>
  </div>;
}

function QuizReview({ quiz, result, onRetry }: { quiz: QuizDetail; result: QuizAttemptResult; onRetry: () => void }) {
  const correct = result.correctCount;
  const scoreLabel = result.percentage >= 85 ? 'Strong recall' : result.percentage >= 60 ? 'Good progress' : 'A useful first pass';
  return <div className="review-page page-enter">
    <Link href="/quizzes" className="back-link"><ArrowLeft size={16} /> All practice tests</Link>
    <section className="result-hero"><div className="result-orbit"><div className="result-score"><strong>{Math.round(result.percentage)}<small>%</small></strong><span>YOUR SCORE</span></div></div><div className="result-copy"><p className="eyebrow">SESSION COMPLETE</p><h1 className="font-display">{scoreLabel}.</h1><p>You got <strong>{correct} of {result.totalQuestions}</strong> questions right on <strong>{quiz.title}</strong>.</p><span className="result-date"><Clock3 size={14} /> Completed {format(new Date(result.completedAt), 'MMM d, yyyy · h:mm a')}</span><div className="result-actions"><button onClick={onRetry} className="button button-primary" data-testid="button-retry-quiz"><RotateCcw size={16} /> Try again</button><Link href="/quizzes" className="button button-outline">Back to tests <ArrowRight size={15} /></Link></div></div></section>
    <section className="review-list"><div className="section-head review-list-heading"><div><p className="eyebrow">LEARN FROM THE ANSWERS</p><h2 className="font-display">Question review</h2></div><span className="review-count">{result.totalQuestions} questions</span></div>
      {result.feedback.map((feedback, idx) => {
        const q = quiz.questions[feedback.questionIndex] ?? quiz.questions[idx];
        return <article className={`review-question ${feedback.isCorrect ? 'review-correct' : 'review-incorrect'}`} key={`${feedback.questionIndex}-${idx}`}>
          <div className="review-question-top"><span className="review-number">QUESTION {String(feedback.questionIndex + 1).padStart(2, '0')}</span><span className={`review-verdict ${feedback.isCorrect ? 'verdict-correct' : 'verdict-incorrect'}`}>{feedback.isCorrect ? <><CheckCircle2 size={15} /> Correct</> : <><X size={15} /> Review this one</>}</span></div>
          <h3>{q?.prompt}</h3><div className="review-answers"><div className={feedback.isCorrect ? 'answer-correct' : 'answer-yours'}><small>{feedback.isCorrect ? 'YOUR ANSWER' : 'YOUR ANSWER'}</small><span>{q?.options[feedback.selectedOption] ?? 'No answer'}</span></div>{!feedback.isCorrect && <div className="answer-correct"><small>CORRECT ANSWER</small><span>{q?.options[feedback.correctOption] ?? '—'}</span></div>}</div>
          {feedback.explanation && <p className="explanation"><span><CircleHelp size={15} /></span>{feedback.explanation}</p>}
        </article>;
      })}
    </section>
  </div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
