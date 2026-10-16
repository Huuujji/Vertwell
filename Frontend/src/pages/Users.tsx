import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Actions, Art, Modal } from '../components/ui';
import SearchField from '../components/SearchField';
import useDiscardChanges from '../components/useDiscardChanges';
import type { Account, Role } from '../data/demo';
import { useViewState } from '../lib/view-state';

const roles: Role[] = ['Owner', 'Admin', 'Staff'];
const access: Record<Role, string> = {
  Owner: 'All workspaces, team management, and Owner/Admin role assignment.',
  Admin: 'Operational workspaces, sale and void review, and Staff management.',
  Staff: 'POS and their current Manila-day sales history; voids are submitted for review.',
};
const emptyDraft = { name: '', username: '', email: '', role: 'Staff' as Role };

export default function Users({ accounts, role: signedRole, actorId, onSave, onDelete, notify }: { accounts: Account[]; role: Role; actorId: string; onSave: (account: Account) => void; onDelete: (id: string) => void; notify: (message: string) => void }) {
  const [search, setSearch] = useViewState('users-search', '');
  const [filter, setFilter] = useViewState<Role | 'All'>('users-role', 'All');
  const [managing, setManaging] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('Staff');
  const [visiblePasswords, setVisiblePasswords] = useState(false);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const deleteOpener = useRef<HTMLButtonElement>(null);
  const addOpener = useRef<HTMLButtonElement>(null);
  const submitted = useRef(false);
  const ownerCount = accounts.filter(account => account.role === 'Owner').length;
  const query = search.trim().toLowerCase();
  const shown = accounts.filter(account => (filter === 'All' || account.role === filter) && [account.name, account.username, account.email].some(value => value.toLowerCase().includes(query)));
  const deletionBlocked = managing?.id === actorId ? 'You cannot delete your signed-in account.' : managing?.role === 'Owner' && ownerCount === 1 ? 'Keep at least one owner account.' : '';

  useEffect(() => { if (confirmDelete) deleteCancel.current?.focus(); }, [confirmDelete]);
  function closeManage() { setManaging(null); setConfirmDelete(false); setError(''); }
  function closeAdd() { setAdding(false); setDraft(emptyDraft); setError(''); setVisiblePasswords(false); }
  const addGuard = useDiscardChanges(adding && (step > 1 || JSON.stringify(draft) !== JSON.stringify(emptyDraft)), closeAdd, 'new user account');
  function backFromDelete() { setConfirmDelete(false); requestAnimationFrame(() => deleteOpener.current?.focus()); }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managing || submitted.current) return;
    if (signedRole !== 'Owner' && (managing.role !== 'Staff' || editRole !== 'Staff')) { setError('Only Owner may assign Owner or Admin access.'); return; }
    if (managing.role === 'Owner' && editRole !== 'Owner' && ownerCount === 1) { setError('Keep at least one owner account.'); return; }
    if (!editName.trim()) { setError('Enter a name.'); return; }
    submitted.current = true;
    onSave({ ...managing, name: editName.trim(), role: editRole }); closeManage(); notify('Sample account updated.');
  }
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const values = new FormData(event.currentTarget);
    if (step === 1) {
      if (!draft.name.trim()) { setError('Enter a name.'); return; }
      if (signedRole !== 'Owner' && draft.role !== 'Staff') { setError('Only Owner may assign Owner or Admin access.'); return; }
      if (accounts.some(account => account.username.toLowerCase() === draft.username.trim().toLowerCase())) { setError('This username already exists.'); return; }
      setDraft({ ...draft, name: draft.name.trim(), username: draft.username.trim() }); setStep(2);
    } else if (step === 2) {
      if (values.get('code') !== '123456') { setError('Use preview verification code 123456. No email is sent.'); return; }
      if (accounts.some(account => account.email.toLowerCase() === draft.email.trim().toLowerCase())) { setError('This email already exists.'); return; }
      setDraft({ ...draft, email: draft.email.trim() }); setVisiblePasswords(false); setStep(3);
    } else {
      if (submitted.current) return;
      if (values.get('password') !== values.get('confirm')) { setError('Passwords must match.'); return; }
      submitted.current = true;
      onSave({ ...draft, id: crypto.randomUUID() });
      // Reveal the created account even if the remembered list filters excluded it.
      setSearch(''); setFilter('All'); closeAdd(); notify('Sample account added. No real account was created.');
    }
  }
  return <section className="users" data-node-id="1331:20074">
    <div className="page-heading"><div><h1>User Management</h1><p className="subtitle">Manage your team and their workspace roles.</p></div><button ref={addOpener} className="accent" onClick={() => { submitted.current = false; setAdding(true); setStep(1); setError(''); setVisiblePasswords(false); setDraft(emptyDraft); }}>Add User</button></div>
    <p className="role-policy">Owner manages roles and business access. Admin manages Staff and operations. Staff uses POS and their current Manila-day history. Only Owner can assign Owner or Admin access.</p>
    <div className="users-toolbar"><SearchField label="Search users" value={search} onChange={setSearch} placeholder="Search name, username, or email" /><label>Account role<select value={filter} onChange={event => setFilter(event.target.value as Role | 'All')}><option value="All">All roles</option>{roles.map(role => <option key={role}>{role}</option>)}</select></label></div>
    <div className="filter-summary"><p role="status">{shown.length} of {accounts.length} accounts · {filter === 'All' ? 'All roles' : filter}{query && ` · Matching “${search.trim()}”`}</p>{(search || filter !== 'All') && <button className="secondary" onClick={() => { setSearch(''); setFilter('All'); }}>Clear filters</button>}</div>
    <div className="user-list">{shown.map(account => <div className="user-row" key={account.id} role="group" aria-label={`${account.name} account`}>
      <div className="user-identity"><span className="user-avatar" aria-hidden="true">{account.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span><div><strong>{account.name}</strong>{account.id === actorId && <span className="current-account">You</span>}<small>@{account.username} · {account.email}</small>{signedRole !== 'Owner' && account.role !== 'Staff' && <small>Owner manages this account.</small>}</div></div>
      <strong className="account-role">{account.role}</strong><button className="primary" disabled={signedRole !== 'Owner' && account.role !== 'Staff'} onClick={() => { submitted.current = false; setManaging(account); setEditName(account.name); setEditRole(account.role); setError(''); setConfirmDelete(false); }}>Manage</button>
    </div>)}</div>
    {!shown.length && <div className="users-empty"><h2>No matching accounts</h2><p>Try another name, username, email, or role.</p><button className="secondary" onClick={() => { setSearch(''); setFilter('All'); }}>Show all accounts</button></div>}
    {managing && <Modal title={confirmDelete ? 'Delete sample account?' : 'Manage User'} className="user-modal" onClose={confirmDelete ? backFromDelete : closeManage}>
      {confirmDelete ? <div className="account-delete-review"><p>Delete <strong>{managing.name}</strong> from the preview team?</p><dl className="account-summary"><div><dt>Username</dt><dd>{managing.username}</dd></div><div><dt>Email</dt><dd>{managing.email}</dd></div><div><dt>Role</dt><dd>{managing.role}</dd></div></dl><p>The sample account will be removed until refresh. Recorded sales and actor names remain in Audit Trail. No real account is changed.</p><Actions><button ref={deleteCancel} className="secondary" onClick={backFromDelete}>Keep account</button><button className="danger-button" disabled={Boolean(deletionBlocked)} onClick={() => { if (submitted.current || deletionBlocked || signedRole !== 'Owner' && managing.role !== 'Staff') return; submitted.current = true; onDelete(managing.id); closeManage(); requestAnimationFrame(() => addOpener.current?.focus()); notify('Sample account deleted.'); }}>Confirm Delete Account</button></Actions></div>
      : <form onSubmit={save}><div className="user-modal-title"><h3>{managing.name}</h3><p>{managing.role} Account{managing.id === actorId ? ' · Signed in as you' : ''}</p></div>
        <dl className="account-summary"><div><dt>Username</dt><dd>{managing.username}</dd></div><div><dt>Email</dt><dd>{managing.email}</dd></div></dl>
        <label className="line-field">Name<input name="name" value={editName} onChange={event => { setEditName(event.target.value); setError(''); }} required maxLength={80} autoFocus /></label>
        <label className="line-field">Role<select name="role" value={editRole} onChange={event => { setEditRole(event.target.value as Role); setError(''); }} aria-describedby="manage-role-hint"><option>Staff</option><option disabled={signedRole !== 'Owner'}>Admin</option><option disabled={signedRole !== 'Owner'}>Owner</option></select></label>
        <p className="account-access" id="manage-role-hint">{access[editRole]}{managing.id === actorId && editRole !== managing.role && ' Saving changes your current preview access.'}</p>
        <div className="danger-zone"><h3>Danger Zone</h3><p>Remove this sample account from the preview team.</p>{deletionBlocked && <p id="delete-account-hint">{deletionBlocked}</p>}<button ref={deleteOpener} type="button" className="delete-button" disabled={Boolean(deletionBlocked)} aria-describedby={deletionBlocked ? 'delete-account-hint' : undefined} onClick={() => setConfirmDelete(true)}><Art file="1d023.svg" />Delete Account</button></div>
        {error && <p className="error" role="alert">{error}</p>}<Actions><button type="button" className="secondary" onClick={closeManage}>Cancel</button><button className="primary">Save</button></Actions>
      </form>}
    </Modal>}
    {adding && <Modal title="Add New User" className="user-modal" onClose={addGuard.requestClose}><form onSubmit={next}>
      <div className="wizard-progress"><span>Step {step} of 3</span><div aria-hidden="true">{[1, 2, 3].map(value => <i key={value} className={step >= value ? 'complete' : ''} />)}</div><h3>{['Account Name', 'Email Verification', 'Account Password'][step - 1]}</h3><p>{['Set a name and choose the workspace access.', 'Try verification with the sample code. No email is sent.', 'Review the account and try password validation.'][step - 1]}</p></div>
      <div className="wizard-fields" key={step}>
        {step === 1 ? <>
          <label className="line-field">Full Name<input placeholder="Full Name" value={draft.name} onChange={event => { setDraft({ ...draft, name: event.target.value }); setError(''); }} required maxLength={80} autoFocus autoComplete="off" /></label>
          <label className="line-field">Username<input placeholder="Username" value={draft.username} onChange={event => { setDraft({ ...draft, username: event.target.value }); setError(''); }} required pattern="[A-Za-z0-9_.-]{3,30}" aria-describedby="username-hint" autoComplete="off" /></label><p className="field-hint" id="username-hint">3–30 letters, numbers, periods, underscores, or hyphens.</p>
          <label className="line-field">Role<select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value as Role })} aria-describedby="add-role-hint"><option>Staff</option><option disabled={signedRole !== 'Owner'}>Admin</option><option disabled={signedRole !== 'Owner'}>Owner</option></select></label><p className="account-access" id="add-role-hint">{access[draft.role]}</p>
        </> : step === 2 ? <>
          <label className="line-field">Email Address<input type="email" placeholder="Email Address" value={draft.email} onChange={event => { setDraft({ ...draft, email: event.target.value }); setError(''); }} required autoFocus autoComplete="off" /></label>
          <label className="line-field">Code<input placeholder="Code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required aria-describedby="account-code-hint" onChange={() => setError('')} /></label><p className="preview-code" id="account-code-hint">Preview code: 123456 · no email sent</p>
        </> : <>
          <dl className="account-summary"><div><dt>Name</dt><dd>{draft.name}</dd></div><div><dt>Username</dt><dd>{draft.username}</dd></div><div><dt>Email</dt><dd>{draft.email}</dd></div><div><dt>Role</dt><dd>{draft.role}</dd></div></dl>
          <label className="line-field">Password<input type={visiblePasswords ? 'text' : 'password'} name="password" placeholder="At least 8 characters" minLength={8} required autoComplete="new-password" autoFocus aria-describedby="account-password-hint" onChange={() => setError('')} /></label>
          <label className="line-field">Confirm Password<input type={visiblePasswords ? 'text' : 'password'} name="confirm" placeholder="Confirm Password" minLength={8} required autoComplete="new-password" onChange={() => setError('')} /></label>
          <button className="secondary password-toggle" type="button" aria-pressed={visiblePasswords} onClick={() => setVisiblePasswords(!visiblePasswords)}>{visiblePasswords ? 'Hide passwords' : 'Show passwords'}</button><p className="preview-code" id="account-password-hint">Use at least 8 characters. Preview only: passwords are never saved and no real account is created.</p>
        </>}
      </div>{error && <p role="alert" className="error">{error}</p>}<Actions><button type="button" className="secondary" onClick={() => { setError(''); setVisiblePasswords(false); if (step === 1) addGuard.requestClose(); else setStep(step - 1); }}>{step === 1 ? 'Cancel' : 'Back'}</button><button className="primary">{step === 1 ? 'Next' : step === 2 ? 'Confirm' : 'Add Account'}</button></Actions>
    </form></Modal>}{addGuard.confirmation}
  </section>;
}
