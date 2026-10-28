import { useEffect, useRef, useState } from 'react';
import { createApiClient } from '../lib/api-client';
import { asset } from '../components/ui';

// This page never reads/writes the signed-in shop session. A manager opening a
// recipient's link keeps their own workspace identity and unsaved work.
function readLink() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const values = params.getAll('token_hash');
    const valid = values.length === 1 && /^[a-f0-9]{56}\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(values[0]!) && [...params.keys()].every(key => key === 'token_hash');
    return { token: valid ? values[0]! : '', invalid: !!window.location.hash && !valid };
}
export default function EmailChallenge({ purpose }: { purpose: 'verification' | 'recovery' }) {
  const verification = purpose === 'verification';
  const [tokenHash, setTokenHash] = useState(() => readLink().token);
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(() => readLink().invalid ? 'This link is invalid. Enter a code or request a fresh email.' : ''), [done, setDone] = useState(false);
  const [until, setUntil] = useState(0), [now, setNow] = useState(Date.now());
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [sending, setSending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string }>({});
  const title = done ? verification ? 'Email verified' : 'Password changed'
    : error ? verification ? 'Verification could not be completed' : 'Password could not be changed'
    : verification ? tokenHash ? 'Confirm your email' : 'Enter your verification code' : 'Choose a new password';
  const request = createApiClient({ baseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim() });
  useEffect(() => {
    // Tokens never stay in history/referrers; no request is made until submit.
    window.history.replaceState(null, '', window.location.pathname);
    heading.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const previous = document.title;
    document.title = `${error && !done ? 'Error: ' : ''}${title} | HappyHentie`;
    return () => { document.title = previous; };
  }, [verification, title, error, done]);
  useEffect(() => { if (done) heading.current?.focus(); }, [done]);
  function validEmail() {
    const invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254;
    return invalid ? 'Enter a valid account email address.' : undefined;
  }
  async function send() {
    if (locked.current || now < until) return;
    const emailError = validEmail();
    setFieldErrors({ email: emailError });
    if (emailError) { setError(emailError); return; }
    setMessage('');
    setSending(true);
    locked.current = true; setBusy(true); setError('');
    try {
      await request('/api/auth/email/request', { method: 'POST', body: JSON.stringify({ email: email.trim(), purpose }) });
      setTokenHash(''); setCode('');
      setUntil(Date.now() + 60000); setMessage('If this account is eligible, check its inbox and spam folder. Use the newest code OR link.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Email request failed.'); }
    finally { locked.current = false; setBusy(false); setSending(false); }
  }
  return <main className="account-session"><section className="account-session-card email-verification-card">
    <img src={asset('be809.png')} alt="HappyHentie Café and Hobby Shop" width="88" />
    {done && <svg className="verification-complete-icon" width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="currentColor" /><path d="m16 28 8 8 16-17" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    {!done && <p className="verification-intro">{verification ? tokenHash
      ? 'Select Verify email to finish confirming your account email. Opening this page has not verified it yet.'
      : 'Enter the code from your verification email to confirm your account email.'
      : tokenHash ? 'Choose a new password and select Change password to finish. Opening this page has not changed your password.'
      : 'If this account is eligible, check its inbox and spam folder. Enter the newest recovery code and choose a new password, OR open the link in that email.'}</p>}
    {done ? verification
      ? <p className="verification-result">Your account email has been verified. You do not need to verify it again.</p>
      : <p className="verification-result">Your password has been changed.</p> : <>
      {error && <p id="verification-error" role="alert" className="verification-feedback error">{error}</p>}
      <form onSubmit={async event => {
        event.preventDefault(); if (locked.current) return;
        const errors = {
          ...(!tokenHash ? { email: validEmail(), code: /^\d{6,8}$/.test(code) ? undefined : 'Enter the 6–8 digit code from your email.' } : {}),
          ...(!verification ? { password: password.length < 8 || password.length > 128 ? 'Use 8–128 characters for your new password.' : undefined,
            confirm: !confirm ? 'Enter your new password again.' : password !== confirm ? 'Passwords must match.' : undefined } : {}),
        };
        setFieldErrors(errors);
        if (Object.values(errors).some(Boolean)) { setError('Check the highlighted fields and try again.'); return; }
        locked.current = true; setBusy(true); setError('');
        setMessage(''); setFieldErrors({});
        try {
          await request('/api/auth/email/complete', { method: 'POST', body: JSON.stringify({ purpose,
            ...(tokenHash ? { tokenHash } : { email: email.trim(), code }), ...(purpose === 'recovery' ? { password } : {}) }) });
          setTokenHash(''); setCode(''); setDone(true);
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'The code or link could not be verified. Request a fresh email.'); }
        finally { setPassword(''); setConfirm(''); locked.current = false; setBusy(false); }
      }} aria-busy={busy} noValidate>
        <fieldset disabled={busy} className="auth-fields">
          {!tokenHash && <>
            <div className="verification-field"><label>Account email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'verification-email-error' : undefined} /></label>{fieldErrors.email && <span className="verification-field-error" id="verification-email-error">{fieldErrors.email}</span>}</div>
            <div className="verification-field"><label>Email code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} value={code} onChange={e => setCode(e.target.value)} aria-invalid={!!fieldErrors.code} aria-describedby={fieldErrors.code ? 'verification-code-error' : 'verification-code-hint'} /></label><span className={fieldErrors.code ? 'verification-field-error' : 'verification-hint'} id={fieldErrors.code ? 'verification-code-error' : 'verification-code-hint'}>{fieldErrors.code || 'Enter the 6–8 digit code from your email.'}</span></div>
          </>}
          {purpose === 'recovery' && <>
            <div className="verification-field"><label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'recovery-password-error' : 'recovery-password-hint'} /></label><span className={fieldErrors.password ? 'verification-field-error' : 'verification-hint'} id={fieldErrors.password ? 'recovery-password-error' : 'recovery-password-hint'}>{fieldErrors.password || 'Use 8–128 characters.'}</span></div>
            <div className="verification-field"><label>Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} aria-invalid={!!fieldErrors.confirm} aria-describedby={fieldErrors.confirm ? 'recovery-confirm-error' : undefined} /></label>{fieldErrors.confirm && <span className="verification-field-error" id="recovery-confirm-error">{fieldErrors.confirm}</span>}</div>
          </>}
          <button className="primary">{busy ? sending ? 'Please wait…' : verification ? 'Verifying email…' : 'Changing password…' : verification ? 'Verify email' : 'Change password'}</button>
          {tokenHash && <button type="button" className="secondary" onClick={() => { setTokenHash(''); setError(''); setFieldErrors({}); }}>Use an email code instead</button>}
        </fieldset>
      </form>
      {busy && !sending && <p role="status">{verification ? 'Verifying your account email…' : 'Changing your password…'}</p>}
      <p className="verification-policy">Use either the code or the email link. They expire after at most 15 minutes and can be used once. Each challenge allows 5 attempts.</p>
      <details className="verification-help"><summary>Request a fresh email</summary>
        {tokenHash && <div className="verification-field"><label>Account email<input type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'verification-resend-error' : undefined} /></label>{fieldErrors.email && <span className="verification-field-error" id="verification-resend-error">{fieldErrors.email}</span>}</div>}
        {!tokenHash && <p>Use the account email entered above. Wait at least 60 seconds between requests.</p>}
        <button className="secondary" disabled={busy || !email || now < until} onClick={() => { void send(); }}>{now < until ? `Wait ${Math.ceil((until - now) / 1000)} seconds` : 'Send code and link'}</button>
      </details>
    </>}
    {message && !done && <p role="status" className="verification-feedback">{message}</p>}
    {done ? <>
      <a className="primary verification-return" href="/Login">Return to HappyHentie</a>
      <p className="verification-next">{verification ? 'You can now sign in with your account credentials. An account already signed in on this browser will stay signed in when you return.' : 'You can now sign in with your new password. Any other account already signed in on this browser stays signed in when you return.'}</p>
    </> : <p className="verification-return-secondary"><a href="/Login">Return to HappyHentie</a></p>}
  </section></main>;
}
