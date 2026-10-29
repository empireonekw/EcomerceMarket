/**
 * Fades and lifts its content in as it scrolls into view, driven by the scroll position itself (CSS scroll-driven
 * animation, `.reveal` in globals.css). No JavaScript: content is always rendered visible, never waits for the page's
 * scripts, and anything already on screen simply shows. `delay` (ms) staggers siblings by starting their fade a little
 * later in the scroll. Browsers without scroll-driven animations, and "reduce motion", show everything static.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  return (
    <Tag className={`reveal ${className}`} style={{ ...style, '--reveal-offset': `${Math.min(delay, 400) / 40}%` }} {...rest}>
      {children}
    </Tag>
  );
}
