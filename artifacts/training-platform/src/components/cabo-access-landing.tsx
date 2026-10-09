import { useState, type FormEvent } from 'react';
import { useAuth } from '@workspace/replit-auth-web';
import { ArrowRight } from 'lucide-react';

const demoAccounts = [
  { label: 'School headmaster — Ubuntu Future', username: 'cabo_headmaster_south' },
  { label: 'School teacher — Ubuntu Future', username: 'cabo_teacher_south' },
  { label: 'Assessor — Ubuntu Future', username: 'cabo_assessor_south' },
  { label: 'Learner — Ubuntu Future (Lerato)', username: 'cabo_learner_south_a' },
  { label: 'Learner — Ubuntu Future (Sipho)', username: 'cabo_learner_south_b' },
  { label: 'Parent — Ubuntu Future', username: 'cabo_parent_south' },
  { label: 'District director — Demo district', username: 'cabo_district_south' },
  { label: 'Headmaster — Highveld Independent', username: 'cabo_headmaster_north' },
  { label: 'Learner — Highveld Independent', username: 'cabo_learner_north' },
  { label: 'University head — Mzanzi Digital', username: 'cabo_university_head' },
  { label: 'University lecturer — Mzanzi Digital', username: 'cabo_university_teacher' },
  { label: 'University learner — Mzanzi Digital', username: 'cabo_university_learner' },
  { label: 'Training organisation — Kwezi Skills', username: 'cabo_company_head' },
];

const audiences = [
  { index: '01', title: 'Schools & educators', detail: 'Teaching, school operations and academic oversight' },
  { index: '02', title: 'Universities & training', detail: 'Coursework, assessments and programme progress' },
  { index: '03', title: 'Learners & families', detail: 'Learning journeys, records and personal growth' },
  { index: '04', title: 'Organisations & employers', detail: 'Skills development and learning pathways' },
];

export default function CaboAccessLanding() {
  const { login } = useAuth();
  const isolatedTest = import.meta.env.VITE_CABO_TEST_LOGIN === 'true';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selectedDemo = demoAccounts.some(account => account.username === username) ? username : '';

  async function testSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSignInError('');
    try {
      const response = await fetch('/api/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(typeof result.error === 'string' ? result.error : 'Sign-in failed. Please try again.');
      }
      window.location.assign('/');
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="cabo-access" id="main-content">
      <header className="cabo-access-header">
        <div className="cabo-access-brand" aria-label="CABO Solutions Training and Development Hub">
          <img className="cabo-access-logo" src="/cabo-wordmark.svg" alt="CABO Solutions" width={122} height={42} />
          <span className="cabo-access-brand-divider" aria-hidden="true" />
          <span className="cabo-access-brand-product">Training &amp;<br />Development Hub</span>
        </div>
        <span className="cabo-access-header-label">Learning · Assessment · Development</span>
      </header>

      <div className="cabo-access-layout">
        <section className="cabo-access-story" aria-labelledby="cabo-access-title">
          <div className="cabo-access-story-main">
            <p className="cabo-access-eyebrow">THE CABO LEARNING ECOSYSTEM</p>
            <h1 id="cabo-access-title">One platform.<br /><em>Every learning journey.</em></h1>
            <p className="cabo-access-description">
              From school and university to workplace development, CABO brings
              learning, assessment, progress and opportunity together.
            </p>
            <p className="cabo-access-mobile-audiences">For schools, universities, training organisations, learners and families.</p>
          </div>

          <div className="cabo-access-audiences" aria-label="Who the CABO platform is for">
            {audiences.map(audience => (
              <div className="cabo-access-audience" key={audience.index}>
                <span className="cabo-access-audience-index">{audience.index}</span>
                <div>
                  <h2>{audience.title}</h2>
                  <p>{audience.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="cabo-access-story-bottom">Built for progress, from the classroom to the workplace.</p>
        </section>

        <section className="cabo-access-signin" aria-labelledby="cabo-access-signin-title">
          <div className="cabo-access-card">
            <div className="cabo-access-card-overline">
              <span>YOUR WORKSPACE</span>
              {isolatedTest && <span className="cabo-access-sandbox">TESTING ENVIRONMENT</span>}
            </div>
            <h2 id="cabo-access-signin-title">Welcome to CABO.</h2>
            <p className="cabo-access-signin-description">
              Sign in to continue to the workspace designed for your role.
            </p>

            {isolatedTest ? (
              <form onSubmit={testSignIn} className="cabo-access-form" aria-label="CABO test sign-in">
                <div className="cabo-access-field">
                  <label htmlFor="cabo-demo-user">Explore a demo workspace <span>(optional)</span></label>
                  <select
                    id="cabo-demo-user"
                    value={selectedDemo}
                    onChange={event => { setUsername(event.target.value); setSignInError(''); }}
                    className="cabo-access-input cabo-access-select"
                  >
                    <option value="">Select a demo role</option>
                    {demoAccounts.map(account => <option key={account.username} value={account.username}>{account.label}</option>)}
                  </select>
                </div>
                <div className="cabo-access-field">
                  <label htmlFor="cabo-signin-username">Username</label>
                  <input
                    id="cabo-signin-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your username"
                    className="cabo-access-input"
                    value={username}
                    onChange={event => { setUsername(event.target.value); setSignInError(''); }}
                  />
                </div>
                <div className="cabo-access-field">
                  <div className="cabo-access-field-heading">
                    <label htmlFor="cabo-signin-password">Password</label>
                    <button
                      type="button"
                      className="cabo-access-reveal"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(value => !value)}
                    >{showPassword ? 'Hide' : 'Show'}</button>
                  </div>
                  <input
                    id="cabo-signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="cabo-access-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => { setPassword(event.target.value); setSignInError(''); }}
                  />
                </div>
                {signInError && <p role="alert" className="cabo-access-error">{signInError}</p>}
                <button
                  type="submit"
                  className="cabo-access-submit"
                  disabled={submitting}
                  data-testid="button-login"
                >
                  <span>{submitting ? 'Signing in…' : 'Open my workspace'}</span>
                  <ArrowRight aria-hidden="true" size={19} />
                </button>
                <p className="cabo-access-demo-help">Demo accounts are fictional and available only in this test environment.</p>
              </form>
            ) : (
              <button
                type="button"
                className="cabo-access-submit cabo-access-standard-login"
                onClick={() => login()}
                data-testid="button-login"
              >
                <span>Continue securely</span>
                <ArrowRight aria-hidden="true" size={19} />
              </button>
            )}
            <div className="cabo-access-card-footer">
              <span className="cabo-access-lock" aria-hidden="true">●</span>
              Your access is based on your institution and assigned permissions.
            </div>
          </div>
          <p className="cabo-access-signin-note">One account. A workspace for your role.</p>
        </section>
      </div>

      <footer className="cabo-access-footer">
        <span>© {new Date().getFullYear()} CABO Solutions</span>
        <span>{isolatedTest ? 'Prototype / Testing only' : 'Training & Development Hub'}</span>
      </footer>
    </main>
  );
}
