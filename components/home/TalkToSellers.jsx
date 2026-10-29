import Link from 'next/link';
import { ArrowRight, MessageSquare, SendHorizontal } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Eyebrow, Glow, Sparkle } from '@/components/home/Editorial';

const STEPS = ['Open a product', 'Tap “Message seller”', 'Chat live'];

// An illustrative conversation (decorative: the text beside it says the same thing).
const CHAT = [
  { from: 'buyer', text: 'Hi! Does the budget planner work on Notion’s free plan?' },
  { from: 'seller', text: 'Yes, it does. Duplicate it into your workspace and it’s ready to use.' },
];

/**
 * Direct messages: heading, one line, the three steps in a row and two buttons on the left; a small chat between a
 * buyer and a seller on a soft panel on the right (its messages appear one after another as it scrolls into view).
 */
export default function TalkToSellers() {
  return (
    <section className="relative isolate mt-24 overflow-x-clip bg-peach-50/70 py-20 sm:mt-32 sm:py-28" aria-labelledby="talk-heading">
      <Glow className="top-10 right-[10%] size-72 bg-berry-100/70" />
      <Glow className="bottom-0 left-[6%] size-64 bg-brand-100/70" />
      <Sparkle className="top-20 left-[46%] hidden size-5 text-peach-500 lg:block" />
      <div className="container-page">        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <Reveal>
            <Eyebrow>Direct messages</Eyebrow>
            <h2 id="talk-heading" className="mt-4 font-serif text-[2.25rem] leading-[1.05] tracking-[-0.025em] text-ink text-balance sm:text-[3rem]">
              Questions? Ask the creator.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-600">
              Every shop has a direct line. Message a seller from any of their products and get answers in real time.
            </p>
            <ol className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-stone-600">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-stone-300" />}
                  <span className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 tabular-nums">{i + 1}</span>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn btn-md btn-dark">
                Browse products
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
              <Link href="/messages" className="btn btn-md btn-outline">
                <MessageSquare size={16} aria-hidden="true" />
                My messages
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120} aria-hidden="true" className="rounded-[2rem] bg-white/70 p-5 ring-1 ring-peach-100 backdrop-blur-sm sm:p-10">
            <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_24px_50px_-30px_rgba(20,20,20,0.35)]">
              <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
                <span className="relative grid size-9 place-items-center rounded-full bg-peach-100 text-xs font-semibold text-peach-700">
                  MS
                  <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-ink">Maple Studio</span>
                  <span className="block text-xs text-stone-500">Online</span>
                </span>
              </div>
              <ul className="space-y-3 px-5 py-5">
                {CHAT.map(({ from, text }, i) => (
                  <Reveal as="li" key={text} delay={300 + i * 450} className={`flex ${from === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                    <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${from === 'buyer' ? 'rounded-br-md bg-brand-100 text-ink' : 'rounded-bl-md bg-stone-100 text-ink'}`}>{text}</p>
                  </Reveal>
                ))}
                <Reveal as="li" delay={300 + CHAT.length * 450} className="flex">
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-1.5 rounded-full bg-stone-400 motion-safe:animate-[typing-dot_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </span>
                </Reveal>
              </ul>
              <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-3">
                <span className="flex-1 rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-400">Write a message…</span>
                <span className="grid size-9 place-items-center rounded-full bg-brand-500 text-ink">
                  <SendHorizontal size={16} strokeWidth={2} />
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
