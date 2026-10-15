'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

export default function CopyLinkButton({ label = 'Copy receipt link' }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  }

  const Icon = copied ? Check : Link2;
  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-sm btn-outline"
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
