'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Check, CreditCard, FileText, Loader2, RefreshCw, ShieldCheck, Upload, UserRound } from 'lucide-react';
import { uploadFile } from '@/lib/upload-client';
import { formatBytes, UPLOAD_RULES, uploadProblem } from '@/lib/listing';

const ACCEPT = Object.keys(UPLOAD_RULES.idDocument.types)
  .map((ext) => `.${ext}`)
  .join(',');

/**
 * Live camera with a capture button. `facing`: 'user' (selfie, mirrored on screen) or 'environment' (back camera,
 * for the ID card). `onCapture(file)` gets a JPEG. Explains what to do when the camera can't be used.
 */
function CameraCapture({ facing, onCapture, onCancel, guide }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError('This browser can’t use the camera. Open this page in Chrome, Safari or Edge.');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      } catch (err) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site in your browser’s settings, then try again.'
            : err?.name === 'NotFoundError'
              ? 'No camera found. Use a phone, or a computer with a webcam.'
              : 'The camera couldn’t start. Close other apps using it and try again.',
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  function capture() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(new File([blob], `${facing === 'user' ? 'selfie' : 'id-photo'}-${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-black">
      <div className="relative aspect-[4/3]">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        {ready && guide}
        {!ready && !error && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/80">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" />
            Starting the camera… If your browser asks, choose Allow.
          </span>
        )}
        {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white">{error}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 bg-white p-3">
        <button type="button" onClick={onCancel} className="btn btn-sm text-stone-600 hover:bg-stone-100">
          Cancel
        </button>
        <button type="button" onClick={capture} disabled={!ready} className="btn btn-md btn-dark">
          <Camera size={16} strokeWidth={1.75} aria-hidden="true" />
          {facing === 'user' ? 'Take selfie' : 'Take photo'}
        </button>
      </div>
    </div>
  );
}

/** One verification step: an ID card side (photo or upload) or the live selfie (camera only). */
function Step({ number, title, hint, icon: Icon, kind, value, onDone, driver, error, cameraOnly = false }) {
  const inputRef = useRef(null);
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState(null); // { url, pdf, name }
  const [busy, setBusy] = useState(null); // upload progress
  const [problem, setProblem] = useState(null);
  useEffect(() => () => preview?.url && URL.revokeObjectURL(preview.url), [preview]);

  async function upload(file) {
    const found = uploadProblem('idDocument', file);
    if (found) return setProblem(found);
    setProblem(null);
    setCamera(false);
    setBusy(0);
    const pdf = /\.pdf$/i.test(file.name);
    try {
      const { url } = await uploadFile(file, { kind: 'idDocument', driver, onProgress: setBusy });
      setPreview({ url: pdf ? null : URL.createObjectURL(file), pdf, name: file.name });
      onDone(url);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy(null);
    }
  }

  const done = Boolean(value);
  const message = problem ?? error;
  return (
    <section className={`rounded-2xl border bg-white p-5 transition-colors sm:p-6 ${done ? 'border-emerald-200' : message ? 'border-red-200' : 'border-stone-200'}`}>
      <header className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-full ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>
          {done ? <Check size={20} strokeWidth={2.25} aria-hidden="true" /> : <Icon size={20} strokeWidth={1.75} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Step {number}</p>
          <h2 className="font-medium text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{hint}</p>
        </div>
      </header>

      <div className="mt-4">
        {camera ? (
          <CameraCapture
            facing={cameraOnly ? 'user' : 'environment'}
            onCapture={upload}
            onCancel={() => setCamera(false)}
            guide={
              cameraOnly ? (
                <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/80" />
              ) : (
                <span aria-hidden="true" className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-dashed border-white/80" />
              )
            }
          />
        ) : busy != null ? (
          <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-600" role="status">
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Uploading… {busy}%
            </span>
          </div>
        ) : done ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className={`grid shrink-0 place-items-center overflow-hidden bg-stone-100 ${cameraOnly ? 'size-24 rounded-full' : 'aspect-[16/10] w-40 rounded-xl'}`}>
              {preview?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="" className={`size-full object-cover ${cameraOnly ? '-scale-x-100' : ''}`} />
              ) : (
                <FileText size={24} strokeWidth={1.5} aria-hidden="true" className="text-stone-500" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-medium text-emerald-700">Added</p>
              <button type="button" onClick={() => (cameraOnly ? setCamera(true) : onDone(''))} className="mt-1 inline-flex items-center gap-1.5 font-medium text-ink underline-offset-2 hover:underline">
                <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />
                {cameraOnly ? 'Retake' : 'Replace'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCamera(true)} disabled={!driver} className="btn btn-md btn-dark">
              <Camera size={16} strokeWidth={1.75} aria-hidden="true" />
              {cameraOnly ? 'Open camera' : 'Take a photo'}
            </button>
            {!cameraOnly && (
              <>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={!driver} className="btn btn-md btn-outline">
                  <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
                  Upload
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="hidden"
                  onChange={(e) => (e.target.files?.[0] && upload(e.target.files[0]), (e.target.value = ''))}
                />
                <span className="self-center text-xs text-stone-500">
                  {UPLOAD_RULES.idDocument.label}, up to {formatBytes(UPLOAD_RULES.idDocument.maxBytes)}
                </span>
              </>
            )}
          </div>
        )}
        {message && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * /seller/verify: after the first sale, the seller sends both sides of their ID card (a photo with the camera, or an
 * upload) and a live selfie (camera only, so it's really them, now). Admins check it; payouts open once verified.
 */
export default function IdentityVerification({ uploads, rejectedNote }) {
  const [files, setFiles] = useState({ idFront: '', idBack: '', selfie: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (key) => (url) => (setFiles((f) => ({ ...f, [key]: url })), setErrors(({ [key]: _, ...rest }) => rest));
  const ready = files.idFront && files.idBack && files.selfie;

  async function submit() {
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/seller/verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(files) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.fields ?? {});
        return setFormError(body.error ?? 'Could not send. Please try again.');
      }
      setSent(true);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-2xl rounded-2xl border border-emerald-200 bg-white p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <ShieldCheck size={26} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-serif text-2xl text-ink">Thanks, we’ve got it</h2>
        <p className="mt-2 text-sm text-stone-600">We usually check it within a day or two and message you in your inbox. Payouts open once it’s verified.</p>
        <Link href="/seller/dashboard" prefetch className="btn btn-md btn-dark mt-6">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {rejectedNote && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <span className="font-medium">Your last check wasn’t approved:</span> {rejectedNote} Please send it again.
        </p>
      )}
      <Step number={1} title="Front of your ID card" hint="Your CNIC, passport or national ID. All four corners and the text clearly visible, no glare." icon={CreditCard} value={files.idFront} onDone={set('idFront')} driver={uploads} error={errors.idFront} />
      <Step number={2} title="Back of your ID card" hint="The other side of the same card." icon={CreditCard} value={files.idBack} onDone={set('idBack')} driver={uploads} error={errors.idBack} />
      <Step
        number={3}
        title="A live selfie"
        hint="Taken now with your camera, so we know it’s really you. Face the camera in good light, without sunglasses or a hat."
        icon={UserRound}
        value={files.selfie}
        onDone={set('selfie')}
        driver={uploads}
        error={errors.selfie}
        cameraOnly
      />
      {formError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="text-stone-500" />
          Private: only Sellpify’s verification team sees these.
        </p>
        <button type="button" onClick={submit} disabled={!ready || saving} className="btn btn-md btn-dark">
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {saving ? 'Sending…' : 'Submit for verification'}
        </button>
      </div>
    </div>
  );
}
