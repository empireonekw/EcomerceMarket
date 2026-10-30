/**
 * Fades and lifts its content in when it scrolls into view (`delay` in ms staggers siblings). Rendered visible; the
 * tiny reveal script in app/layout.jsx (REVEAL_SCRIPT) runs as soon as the HTML arrives, without waiting for the
 * page's JavaScript bundle, and only then hides off-screen blocks until they enter the viewport. No script, a script
 * error or "reduce motion" all leave everything visible. Styles: .reveal in globals.css.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  return (
    // The script adds data-in to this element before React hydrates; that's expected, not a mismatch.
    <Tag suppressHydrationWarning className={`reveal ${className}`} style={{ ...style, '--reveal-delay': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Inline script for the root layout: marks <html data-reveal> and gives each .reveal a data-in when it enters the
 * viewport (blocks already on screen get it straight away, so they play their fade at once). Watches for new .reveal
 * blocks after client-side navigation too. Plain ES5, a few hundred bytes.
 */
export const REVEAL_SCRIPT = `(function(){
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function init(){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) { e.target.setAttribute('data-in',''); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    var seen = new WeakSet();
    function scan(){
      var els = document.querySelectorAll('.reveal:not([data-in])');
      for (var i = 0; i < els.length; i++) { if (!seen.has(els[i])) { seen.add(els[i]); io.observe(els[i]); } }
    }
    scan();
    document.documentElement.setAttribute('data-reveal','');
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();`;
