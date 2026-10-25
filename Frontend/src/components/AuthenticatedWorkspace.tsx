import type { IdentityResponse } from '../lib/auth-session';
import { LiveUpdates } from '../lib/live-updates';
import ManagementWorkspace from './ManagementWorkspace';

export default function AuthenticatedWorkspace({ identity }: { identity: IdentityResponse }) {
  return <LiveUpdates profile={identity.profile}><ManagementWorkspace identity={identity} /></LiveUpdates>;
}
