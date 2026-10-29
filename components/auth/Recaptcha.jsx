'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
export const recaptchaEnabled = Boolean(SITE_KEY);

let loader;
/** Loads Google's reCAPTCHA script once per page. */
function loadRecaptcha() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  loader ??= new Promise((resolve, reject) => {
    window.__onRecaptchaLoad = () => resolve(window.grecaptcha);
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=__onRecaptchaLoad';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loader = undefined;
      reject(new Error('reCAPTCHA failed to load'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/**
 * Google reCAPTCHA v2 "I'm not a robot" checkbox. `onChange(token | null)`: a token once ticked, null when it
 * expires or errors. `ref.current.reset()` clears it (tokens are single-use: reset after every failed submit).
 * Renders nothing when NEXT_PUBLIC_RECAPTCHA_SITE_KEY isn't set; the server skips the check in that case too.
 */
export default function Recaptcha({ onChange, error, ref }) {
  const boxRef = useRef(null);
  const widgetId = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current != null) window.grecaptcha?.reset(widgetId.current);
      onChangeRef.current?.(null);
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelled = false;
    loadRecaptcha()
      .then((grecaptcha) => {
        if (cancelled || !boxRef.current || widgetId.current != null) return;
        widgetId.current = grecaptcha.render(boxRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onChangeRef.current?.(token),
          'expired-callback': () => onChangeRef.current?.(null),
          'error-callback': () => onChangeRef.current?.(null),
        });
      })
      .catch(() => onChangeRef.current?.(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!SITE_KEY) return null;
  return (
    <div>
      {/* 78px = the widget's height, reserved so the form doesn't jump when it appears. */}
      <div ref={boxRef} className="min-h-[78px]" aria-describedby={error ? 'captcha-error' : undefined} />
      {error && (
        <p id="captcha-error" role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
