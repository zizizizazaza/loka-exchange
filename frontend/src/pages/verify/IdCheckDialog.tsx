import { useEffect, useRef } from 'react';

import { useKyb } from '../../kyb/store';

/**
 * The provider's ID check (DocuPass) embedded in a dialog. The face step only runs on a phone, so on a computer
 * DocuPass shows its own code to continue there. While open, the result is polled every few seconds; the dialog
 * closes itself once the backend has a result.
 */
export function IdCheckDialog({ url, onPoll, onClose }: { url: string; onPoll: () => Promise<void>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const status = useKyb().applicant.id;
  const poll = useRef(onPoll);
  useEffect(() => {
    poll.current = onPoll;
  });

  useEffect(() => {
    ref.current?.showModal();
    const timer = window.setInterval(() => void poll.current().catch(() => undefined), 4000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status !== 'checking') onClose();
  }, [status, onClose]);

  return (
    <dialog className="gate kidd" ref={ref} aria-labelledby="kiddT" onClose={onClose}>
      <div className="gate-h">
        <div>
          <h3 id="kiddT">Verify your ID</h3>
          <p>Have your passport or ID card ready. This closes by itself when the check is done.</p>
        </div>
        <button className="gate-x" type="button" aria-label="Close" onClick={onClose}>
          <i className="ph ph-x"></i>
        </button>
      </div>
      <iframe src={url} title="ID verification" allow="camera *; microphone *; fullscreen *; clipboard-write *"></iframe>
      <p className="kidd-f">
        Provided by our verification provider. Trouble with the page?{' '}
        <a href={url} target="_blank" rel="noreferrer">
          Open it in a new tab
        </a>
      </p>
    </dialog>
  );
}
