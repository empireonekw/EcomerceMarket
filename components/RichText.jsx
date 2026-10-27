import { Fragment } from 'react';
import { parseRichText } from '@/lib/rich-text';

function Inline({ nodes }) {
  return nodes.map((n, i) => {
    if (n.text !== undefined) return <Fragment key={i}>{n.text}</Fragment>;
    if (n.bold)
      return (
        <strong key={i} className="font-semibold text-black">
          <Inline nodes={n.bold} />
        </strong>
      );
    if (n.italic)
      return (
        <em key={i}>
          <Inline nodes={n.italic} />
        </em>
      );
    return (
      <u key={i} className="underline-offset-2">
        <Inline nodes={n.underline} />
      </u>
    );
  });
}

/** A product description with its basic formatting (lib/rich-text.js). Text is always rendered as text, never HTML. */
export default function RichText({ text, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {parseRichText(text).map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Inline nodes={line} />
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.type;
        return (
          <List key={i} className={`space-y-1.5 pl-5 ${List === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-stone-400`}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline nodes={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
