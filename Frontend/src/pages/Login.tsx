import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { signIn, changeRecoveredPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ApiError, createApiClient } from '../lib/api-client';
import { Art, asset } from '../components/ui';

type Step = 'login' | 'email' | 'password';
function Field({ id, label, icon, iconClass, children }: { id: string; label: string; icon: string; iconClass: string; children: ReactNode }) {
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="login-field"><Art file={icon} className={`field-icon ${iconClass}`} />{children}</div></div>;
}
function EyeIcon({ visible }: { visible: boolean }) {
  return <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />{!visible && <path d="m3 3 18 18" />}</svg>;
}
export default function Login({ recovery = false }: { recovery?: boolean }) {
  const [step, setStep] = useState<Step>(recovery ? 'password' : 'login');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(() => {
    try { return sessionStorage.getItem('vertwell-password-updated') === '1' ? 'Password changed. Sign in with your new password.' : ''; }
    catch { return ''; }
  });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  useEffect(() => { if (!recovery) { try { sessionStorage.removeItem('vertwell-password-updated'); } catch { /* Storage can be disabled. */ } } }, [recovery]);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { if (recovery) { changeStep('password'); heading.current?.focus(); } }, [recovery]);
  useEffect(() => { if (previousStep.current !== step) heading.current?.focus(); previousStep.current = step; }, [step]);
  function changeStep(next: Step) { setError(''); setMessage(''); setFieldErrors({}); setVisible(false); setStep(next); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFieldErrors({}); setBusy(true);
    const form = event.currentTarget, values = new FormData(form);
    try {
      if (step === 'login') {
        if (!supabase) throw new Error('Account login is unavailable. Ask the Owner to check the database connection.');
        await signIn(String(values.get('username')), String(values.get('password')));
        form.reset();
      } else if (step === 'email') {
        const address = String(values.get('email')).trim();
        setEmail(address);
        if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
          setFieldErrors({email:'Enter a valid account email address.'});
          throw new Error('Check the highlighted field and try again.');
        }
        if (supabase) {
          const request=createApiClient({baseUrl:(import.meta.env.VITE_API_BASE_URL??'').trim()});
          await request('/api/auth/email/request',{method:'POST',body:JSON.stringify({email:address,purpose:'recovery'})});
          window.location.assign('/auth/recover');
        } else throw new Error('Account recovery is unavailable. Ask the Owner to check the database connection.');
      } else {
        const password = String(values.get('password')), confirm = String(values.get('confirm'));
        const errors = {password:password.length < 8 || password.length > 128 ? 'Use 8–128 characters for your new password.' : undefined,
          confirm:!confirm ? 'Enter your new password again.' : password !== confirm ? 'Passwords must match.' : undefined};
        if (errors.password || errors.confirm) { setFieldErrors(errors); throw new Error('Check the highlighted fields and try again.'); }
        if (supabase) {
          if (!recovery) throw new Error('Open a valid password reset link first.');
          await changeRecoveredPassword(String(values.get('password')));
          changeStep('login'); setMessage('Password changed. Sign in with your new password.');
        } else throw new Error('Account recovery is unavailable.');
      }
    } catch (cause) {
      if (step === 'login' && cause instanceof ApiError && cause.fields.accountEmail === 'verification_required') {
        window.location.assign('/auth/verify');
      } else setError(cause instanceof Error ? cause.message : 'Please try again.');
    }
    finally { setBusy(false); }
  }
  const title = step === 'login' ? 'Welcome back' : step === 'email' ? 'Reset your password' : 'Choose a new password';
  const description = step === 'login' ? 'Log in to your Happy Hentie account to get started.' : step === 'email' ? 'Enter your account email to receive a recovery code or link.' : 'Use at least 8 characters for your new account password.';
  useEffect(() => {
    if (step === 'login') return;
    const previous = document.title;
    document.title = `${error ? 'Error: ' : ''}${title} | HappyHentie`;
    return () => { document.title = previous; };
  }, [step, title, error]);
  if (step !== 'login') return <main className="account-session"><section className="account-session-card email-verification-card">
    <img src={asset('be809.png')} alt="HappyHentie Café and Hobby Shop" width="88" />
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    <p className="verification-intro">{step === 'email' ? 'Enter your account email to request a recovery code and link.' : 'Choose a new password and confirm it below.'}</p>
    {error && <p role="alert" className="verification-feedback error">{error}</p>}
    <form onSubmit={submit} aria-busy={busy} noValidate>
      <fieldset disabled={busy} className="auth-fields">
        {step === 'email' ? <div className="verification-field"><label>Account email<input type="email" name="email" autoComplete="email" maxLength={254} defaultValue={email} required aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'recovery-request-email-error' : undefined} /></label>{fieldErrors.email && <span id="recovery-request-email-error" className="verification-field-error">{fieldErrors.email}</span>}</div> : <>
          <div className="verification-field"><label htmlFor="legacy-recovery-password">New password</label><span className="recovery-password-input"><input id="legacy-recovery-password" name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'legacy-recovery-password-error' : 'legacy-recovery-password-hint'} /><button className="eye-button" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide passwords' : 'Show passwords'} aria-pressed={visible}><EyeIcon visible={visible} /></button></span><span className={fieldErrors.password ? 'verification-field-error' : 'verification-hint'} id={fieldErrors.password ? 'legacy-recovery-password-error' : 'legacy-recovery-password-hint'}>{fieldErrors.password || 'Use 8–128 characters.'}</span></div>
          <div className="verification-field"><label>Confirm password<input name="confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required aria-invalid={!!fieldErrors.confirm} aria-describedby={fieldErrors.confirm ? 'legacy-recovery-confirm-error' : undefined} /></label>{fieldErrors.confirm && <span id="legacy-recovery-confirm-error" className="verification-field-error">{fieldErrors.confirm}</span>}</div>
        </>}
        <button className="primary">{busy ? step === 'email' ? 'Requesting email…' : 'Changing password…' : step === 'email' ? 'Send recovery email' : 'Change password'}</button>
      </fieldset>
    </form>
    {busy && <p role="status">{step === 'email' ? 'Requesting a recovery email…' : 'Changing your password…'}</p>}
    {step === 'email' && <p className="verification-policy">If this account is eligible, check its inbox and spam folder. Use either the code or the link in the recovery email.</p>}
    <p className="verification-return-secondary"><button className="text-button recovery-back" type="button" disabled={busy} onClick={() => { if (recovery) { void supabase?.auth.signOut(); } else changeStep('login'); }}>Back to login</button></p>
  </section></main>;
  return <main className="login-screen">
    <div className="login-panel">
      <aside className="login-brand" aria-label="Happy Hentie Café and Hobby Shop">
        <div className="auth-brand-lockup"><img src={asset('be809.png')} alt="Happy Hentie Hobbies" /><div><strong>Happy Hentie</strong><span>Café &amp; Hobby Shop</span></div></div>
        <div className="auth-brand-story"><span className="auth-eyebrow">HAPPY HENTIE CAFE &amp; HOBBY SHOP</span><h2>DualCounter: Inventory &amp; Sales Management System</h2><p>Manage your inventory and sales with confidence.</p><div className="auth-brand-rule" /></div>
        <p className="auth-brand-footer">Inventory <span>·</span> Sales <span>·</span> Team</p>
      </aside>
      <section className="auth-content" aria-label="Account login">
        <header className="auth-heading"><span className="auth-eyebrow">Account access</span><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{description}</p></header>
        <form key={step} className="login-form" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="auth-fields">
            <Field id="login-username" label="Username or email" icon="52c5d.svg" iconClass="email-icon"><input id="login-username" name="username" autoComplete="username" placeholder={supabase ? 'you@example.com' : 'Enter your username or email'} required /></Field>
            <Field id="login-password" label="Password" icon="0153f.svg" iconClass="password-icon"><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required /><button className="eye-button" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}><EyeIcon visible={visible} /></button></Field>
            <button type="button" className="text-button forgot" onClick={() => changeStep('email')}>Forgot password?</button>
          {(error || message) && <p className={`form-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
          <button className="primary login-submit" disabled={busy}>{busy ? 'Please wait…' : 'Log in'}</button>
          </fieldset>
        </form>
        <p className="auth-footer">Happy Hentie Café &amp; Hobby Shop</p>
      </section>
    </div>
  </main>;
}
