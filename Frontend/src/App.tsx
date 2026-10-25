import { useEffect } from 'react';
import Login from './pages/Login';
import { lazySection } from './components/LazySection';
import AccountSession, { useAccountSession } from './components/AccountSession';

const AuthenticatedWorkspace = lazySection(() => import('./components/AuthenticatedWorkspace'), 'workspace');

export default function App() {
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
