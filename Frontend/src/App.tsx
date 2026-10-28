import { useEffect } from 'react';
import Login from './pages/Login';
import { lazySection } from './components/LazySection';
import AccountSession, { useAccountSession } from './components/AccountSession';
import EmailChallenge from './pages/EmailChallenge';

const AuthenticatedWorkspace = lazySection(() => import('./components/AuthenticatedWorkspace'), 'workspace');

export default function App() {
  if (window.location.pathname === '/auth/verify') return <EmailChallenge purpose="verification" />;
  if (window.location.pathname === '/auth/recover') return <EmailChallenge purpose="recovery" />;
  return <AccountApp />;
}
function AccountApp() {
  const session = useAccountSession();
  useEffect(() => {
    if (session.status !== 'anonymous') return;
    const loginPath=()=>{if(window.location.pathname!=='/Login')window.history.replaceState(null,'','/Login');};
    loginPath();window.addEventListener('popstate',loginPath);return()=>window.removeEventListener('popstate',loginPath);
  }, [session.status]);
  if (session.status === 'recovery') return <Login recovery />;
  if (session.status === 'authenticated') return <AuthenticatedWorkspace key={`${session.identity.profile.id}:${session.identity.profile.role}`} identity={session.identity} />;
  if (session.status !== 'anonymous') return <AccountSession state={session} />;
  return <Login />;
}
