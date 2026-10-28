import Link from 'next/link';
import { MessageSquare, Search, Zap } from 'lucide-react';

const STEPS = [
  { icon: Search, title: 'Find something you like', text: 'Open any product from an independent shop.' },
  { icon: MessageSquare, title: 'Tap “Message seller”', text: 'Ask about formats, licences or a custom version.' },
  { icon: Zap, title: 'Get answers live', text: 'Replies appear instantly in your Messages — no email back-and-forth.' },
];

/** Homepage: buyers can talk to the people behind each shop before they buy. */
export default function TalkToSellers() {
  return (
    <section className="container-page pt-20 sm:pt-28" aria-labelledby="talk-heading">
      <div className="grid gap-10 rounded-3xl bg-stone-100 p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:p-14">
        <div>
          <h2 id="talk-heading" className="headline text-3xl sm:text-5xl">
            Questions? Ask the creator.
          </h2>
          <p className="mt-3 text-lg text-stone-600">Every shop has a direct line. Message a seller from any of their products and chat in real time.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/products" className="btn btn-lg btn-dark">
              Browse products
            </Link>
            <Link href="/messages" className="btn btn-lg btn-outline">
              <MessageSquare size={18} aria-hidden="true" />
              My messages
            </Link>
          </div>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl bg-white p-5">
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="text-sm tabular-nums text-stone-400">0{i + 1}</span>
              </span>
              <p className="mt-6 font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
