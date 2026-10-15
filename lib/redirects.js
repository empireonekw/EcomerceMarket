/**
 * Accept only same-site relative paths as post-login destinations (prevents open redirects like
 * ?next=https://evil.com or ?next=//evil.com). Returns undefined when unsafe/absent.
 */
export function safeNext(value) {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return undefined;
  if (v.startsWith('/login') || v.startsWith('/signup')) return undefined;
  return v.slice(0, 512);
}
