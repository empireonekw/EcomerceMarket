'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import { domToRichText, richTextToHtml } from '@/lib/rich-text';

const TOOLS = [
  { command: 'bold', label: 'Bold', shortcut: 'Ctrl+B', icon: Bold },
  { command: 'italic', label: 'Italic', shortcut: 'Ctrl+I', icon: Italic },
  { command: 'underline', label: 'Underline', shortcut: 'Ctrl+U', icon: Underline },
  { command: 'insertUnorderedList', label: 'Bulleted list', icon: List },
  { command: 'insertOrderedList', label: 'Numbered list', icon: ListOrdered },
];

/**
 * Description editor with a small toolbar: bold, italic, underline, bulleted and numbered lists.
 * Formats as you type; `value` / `onChange` use the stored marker format (lib/rich-text.js), never HTML.
 * Pasted content is inserted as plain text so formatting from other sites can't sneak in.
 */
export default function RichTextEditor({ id, value, onChange, onBlur, invalid, describedBy, minHeight = '11rem' }) {
  const editorRef = useRef(null);
  const [active, setActive] = useState({});

  // Fill the editor once; after that it owns its content (re-rendering it would move the caret).
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = richTextToHtml(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light up the toolbar buttons for the formatting at the caret.
  useEffect(() => {
    const onSelection = () => {
      const editor = editorRef.current;
      if (!editor || !editor.contains(document.getSelection()?.anchorNode ?? null)) return;
      setActive(Object.fromEntries(TOOLS.map((t) => [t.command, document.queryCommandState(t.command)])));
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  const emit = () => onChange(domToRichText(editorRef.current));

  function run(command) {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, false); // <b>/<i>/<u> tags rather than inline styles
    document.execCommand(command);
    setActive((a) => ({ ...a, [command]: document.queryCommandState(command) }));
    emit();
  }

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl border bg-white transition-colors focus-within:ring-2 focus-within:ring-brand-500/20 ${
        invalid ? 'border-red-400 focus-within:border-red-500' : 'border-stone-300 hover:border-stone-400 focus-within:border-ink'
      }`}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={id}
        className="flex flex-wrap items-center gap-0.5 border-b border-stone-200 bg-stone-50 px-2 py-1.5"
      >
        {TOOLS.map(({ command, label, shortcut, icon: Icon }, i) => (
          <span key={command} className="contents">
            {i === 3 && <span aria-hidden="true" className="mx-1 h-5 w-px bg-stone-300" />}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
              onClick={() => run(command)}
              aria-label={label}
              aria-pressed={Boolean(active[command])}
              title={shortcut ? `${label} (${shortcut})` : label}
              className={`grid size-8 place-items-center rounded-lg transition-colors ${
                active[command] ? 'bg-ink text-white' : 'text-stone-700 hover:bg-stone-200 hover:text-black'
              }`}
            >
              <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={onBlur}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
        style={{ minHeight }}
        className="max-h-[32rem] overflow-y-auto px-4 py-3 text-[15px] leading-relaxed focus:outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
