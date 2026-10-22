import { useEffect } from 'react';
import Login from './pages/Login';
import ManagementWorkspace from './components/ManagementWorkspace';
import { LiveUpdates } from './lib/live-updates';
import AccountSession, { useAccountSession } from './components/AccountSession';

export default function App() {
  const session = useAccountSession();
  useEffect(() => {
    if (session.status !== 'anonymous') return;
    const loginPath=()=>{if(window.location.pathname!=='/Login')window.history.replaceState(null,'','/Login');};
    loginPath();window.addEventListener('popstate',loginPath);return()=>window.removeEventListener('popstate',loginPath);
  }, [session.status]);
  if (session.status === 'recovery') return <Login recovery />;
  if (session.status === 'authenticated') return <LiveUpdates key={`${session.identity.profile.id}:${session.identity.profile.role}`} profile={session.identity.profile}><ManagementWorkspace identity={session.identity} /></LiveUpdates>;
  if (session.status !== 'anonymous') return <AccountSession state={session} />;
  return <Login />;
}
