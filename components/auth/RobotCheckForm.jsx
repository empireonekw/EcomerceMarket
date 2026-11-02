'use client';

import { useRef, useState } from 'react';
import { FormAlert, SubmitButton } from '@/components/auth/AuthFields';
import Recaptcha, { recaptchaEnabled } from '@/components/auth/Recaptcha';

/** The /verify form: tick the box, POST /api/robot-check, then go back to the page the visitor was on. */
export default function RobotCheckForm({ next }) {
  const captchaRef = useRef(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (recaptchaEnabled && !token) return setError('Please tick “I’m not a robot”.');
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/robot-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken: token, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      // A full page load: the pages behind the check render afresh, with the new pass cookie.
      window.location.assign(data.next || '/');
    } catch (err) {
      setError(err.message);
      captchaRef.current?.reset(); // a token works once
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert>{error}</FormAlert>
      <Recaptcha ref={captchaRef} onChange={setToken} />
      <SubmitButton pending={pending} pendingLabel="Checking…">
        Continue
      </SubmitButton>
    </form>
  );
}
