import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { signIn, changeRecoveredPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Art, asset } from '../components/ui';
import type { Account, Role } from '../data/demo';

type Step = 'login' | 'email' | 'code' | 'password';
function Field({ id, label, icon, iconClass, children }: { id: string; label: string; icon: string; iconClass: string; children: ReactNode }) {
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="login-field"><Art file={icon} className={`field-icon ${iconClass}`} />{children}</div></div>;
}
function EyeIcon({ visible }: { visible: boolean }) {
  return <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />{!visible && <path d="m3 3 18 18" />}</svg>;
}
export default function Login({ accounts, onPreview, recovery = false }: { accounts: Account[]; onPreview: (id: string) => void; recovery?: boolean }) {
  const [step, setStep] = useState<Step>(recovery ? 'password' : 'login');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(() => {
    try { return sessionStorage.getItem('vertwell-password-updated') === '1' ? 'Password changed. Sign in with your new password.' : ''; }
    catch { return ''; }
  });
  useEffect(() => { if (!recovery) { try { sessionStorage.removeItem('vertwell-password-updated'); } catch { /* Storage can be disabled. */ } } }, [recovery]);
  const [previewRole, setPreviewRole] = useState<Role>('Owner');
  const [previewId, setPreviewId] = useState('');
  const previewAccounts = accounts.filter(account => account.role === previewRole);
  const selectedAccount = previewAccounts.find(account => account.id === previewId) ?? previewAccounts[0];
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { if (recovery) changeStep('password'); }, [recovery]);
  useEffect(() => { if (previousStep.current !== step) heading.current?.focus(); previousStep.current = step; }, [step]);
  function changeStep(next: Step) { setError(''); setMessage(''); setVisible(false); setStep(next); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      if (step === 'login') {
        if (!supabase) throw new Error('Account login is not available in this preview. Use Open preview below; no password is needed.');
        await signIn(String(values.get('username')), String(values.get('password')));
      } else if (step === 'email') {
        setEmail(String(values.get('email')));
        if (supabase) {
          const { error: cause } = await supabase.auth.resetPasswordForEmail(String(values.get('email')), { redirectTo: `${window.location.origin}/auth/callback` });
          if (cause) throw cause;
          setMessage('If this account exists, a password reset link has been sent to its email.');
        } else { setStep('code'); setMessage('Frontend preview: enter 123456. No email was sent.'); }
      } else if (step === 'code') {
        if (supabase) throw new Error('Use the password reset link sent to your account email.');
        if (values.get('code') !== '123456') throw new Error('Use the preview code 123456.');
        changeStep('password');
      } else {
        if (values.get('password') !== values.get('confirm')) throw new Error('Passwords must match.');
        if (supabase) {
          if (!recovery) throw new Error('Open a valid password reset link first.');
          await changeRecoveredPassword(String(values.get('password')));
          changeStep('login'); setMessage('Password changed. Sign in with your new password.');
        } else { changeStep('login'); setMessage('Password-reset preview complete. No account was changed.'); }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const title = step === 'login' ? 'Welcome back' : step === 'email' ? 'Reset your password' : step === 'code' ? 'Check your code' : 'Choose a new password';
  const description = step === 'login' ? 'Log in to your Happy Hentie account to get started.' : step === 'email' ? (supabase ? 'Enter your account email to receive a password reset link.' : 'Try the password recovery flow with a sample email.') : step === 'code' ? 'Enter the 6-digit verification code to continue.' : supabase ? 'Use at least 8 characters for your new account password.' : 'Use at least 8 characters. This preview will not change an account.';
  return <main className={`login-screen ${step !== 'login' ? 'recovery' : ''}`}>
    <div className="login-panel">
      <aside className="login-brand" aria-label="Happy Hentie Café and Hobby Shop">
        <div className="auth-brand-lockup"><img src={asset('be809.png')} alt="Happy Hentie Hobbies" /><div><strong>Happy Hentie</strong><span>Café &amp; Hobby Shop</span></div></div>
        <div className="auth-brand-story"><span className="auth-eyebrow">The daily workspace</span><h2>Your shop,<br />in one place.</h2><p>Keep track of inventory, sales and the people behind your shop.</p><div className="auth-brand-rule" /></div>
        <p className="auth-brand-footer">Inventory <span>·</span> Sales <span>·</span> Team</p>
      </aside>
      <section className="auth-content" aria-label={step === 'login' ? 'Account login' : 'Password recovery'}>
        <header className="auth-heading"><span className="auth-eyebrow">{step === 'login' ? 'Account access' : supabase ? 'Account recovery' : 'Recovery preview'}</span><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{description}</p></header>
        <form key={step} className="login-form" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="auth-fields">
          {step === 'login' ? <>
            <Field id="login-username" label="Username or email" icon="52c5d.svg" iconClass="email-icon"><input id="login-username" name="username" autoComplete="username" placeholder={supabase ? 'you@example.com' : 'Enter your username or email'} required /></Field>
            <Field id="login-password" label="Password" icon="0153f.svg" iconClass="password-icon"><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required /><button className="eye-button" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}><EyeIcon visible={visible} /></button></Field>
            <button type="button" className="text-button forgot" onClick={() => changeStep('email')}>Forgot password?</button>
          </> : step === 'email' || step === 'code' ? <>
            <Field id="recovery-email" label="Email" icon="52c5d.svg" iconClass="email-icon"><input id="recovery-email" type="email" name="email" autoComplete="email" placeholder="you@example.com" defaultValue={email} required /></Field>
            {step === 'code' && <Field id="recovery-code" label="Verification code" icon="3e574.svg" iconClass="code-icon"><input id="recovery-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" pattern="[0-9]{6}" maxLength={6} required aria-describedby="recovery-code-hint" /></Field>}
            {step === 'code' && <p className="auth-field-hint" id="recovery-code-hint">Sample verification code: <strong>123456</strong></p>}
          </> : <>
            <Field id="recovery-password" label="New password" icon="0153f.svg" iconClass="password-icon"><input id="recovery-password" name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required /></Field>
            <Field id="recovery-confirm" label="Confirm password" icon="0153f.svg" iconClass="password-icon"><input id="recovery-confirm" name="confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your new password" minLength={8} required /><button className="eye-button" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide passwords' : 'Show passwords'} aria-pressed={visible}><EyeIcon visible={visible} /></button></Field>
          </>}
          {(error || message) && <p className={`form-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
          <button className="primary login-submit" disabled={busy}>{busy ? 'Please wait…' : step === 'login' ? 'Log in' : step === 'email' ? (supabase ? 'Send reset link' : 'Send Code') : step === 'code' ? 'Confirm' : 'Change Password'}</button>
          {step !== 'login' && <button className="text-button back-login" type="button" onClick={() => { if (recovery) { void supabase?.auth.signOut(); } else changeStep('login'); }}>Remembered it? Back to login</button>}
          </fieldset>
        </form>
        {step === 'login' && <aside className="preview-entry" aria-label="Frontend preview"><h2>Explore the preview</h2><p>No password needed. Choose a role and person to try their sample workspace.</p><label htmlFor="preview-role">Preview role</label><select id="preview-role" value={previewRole} onChange={e => { setPreviewRole(e.target.value as Role); setPreviewId(''); }}><option>Owner</option><option>Admin</option><option>Staff</option></select><label htmlFor="preview-person">Preview person</label><div className="preview-entry-actions"><select id="preview-person" value={selectedAccount?.id ?? ''} onChange={e => setPreviewId(e.target.value)}>{previewAccounts.map(account => <option key={account.id} value={account.id}>{account.name} (@{account.username})</option>)}</select><button disabled={!selectedAccount} onClick={() => { if (selectedAccount) onPreview(selectedAccount.id); }}>Open preview <span aria-hidden="true">→</span></button></div><small>{selectedAccount ? `${selectedAccount.email} · ${selectedAccount.role}` : 'No sample accounts for this role'}</small><small>Sample data · resets on refresh</small></aside>}
        <p className="auth-footer">Happy Hentie Café &amp; Hobby Shop</p>
      </section>
    </div>
  </main>;
}
