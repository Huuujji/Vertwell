import { useEffect, useState } from 'react';
import { Actions, Modal } from './ui';

// Keep the original dialog mounted, including uncontrolled inputs and wizard steps.
export default function useDiscardChanges(dirty: boolean, onClose: () => void, subject: string) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return {
    requestClose: () => { if (dirty) setConfirming(true); else onClose(); },
    confirmation: confirming && <Modal title="Discard unsaved changes?" className="discard-modal" onClose={() => setConfirming(false)}>
      <p>Your {subject} has unsaved changes. Discarding will lose the information you entered.</p>
      <Actions><button type="button" className="secondary" data-initial-focus onClick={() => setConfirming(false)}>Keep editing</button><button type="button" className="danger-button" onClick={() => { setConfirming(false); onClose(); }}>Discard changes</button></Actions>
    </Modal>,
  };
}
