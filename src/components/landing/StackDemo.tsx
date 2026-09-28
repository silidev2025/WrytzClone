"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Minus } from "lucide-react";

/*
 * The landing page's proof: Craftbase's tagline as a three-card stack you flip through.
 * The chrome is one-bit; the little bakery app inside keeps its own colours, the way
 * every app built here does. All names and orders are example data.
 */

const CARDS = ["Design it", "Store it", "Share it"] as const;

function BakeryPage({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bakery ${compact ? "compact" : ""}`}>
      <div className="bakery-title">Order your favourite bakes</div>
      <div className="bakery-sub">Pick, pay at pickup, enjoy.</div>
      <div className="bakery-items">
        {[
          ["Croissant", "3.50"],
          ["Sourdough", "4.20"],
          ["Cupcake", "2.80"],
        ].map(([name, price]) => (
          <div key={name} className="bakery-item">
            <span>{name}</span>
            <span className="bakery-price">${price}</span>
          </div>
        ))}
      </div>
      <div className="bakery-button">Place order</div>
    </div>
  );
}

function DesignCard() {
  return (
    <div className="demo-design">
      <div className="demo-canvas">
        <div className="demo-page">
          <BakeryPage />
          <span className="ants demo-sel" aria-hidden="true" />
        </div>
        <span className="callout callout-a">
          <span className="callout-line" aria-hidden="true" />
          Drag anything
        </span>
        <span className="callout callout-b">
          <span className="callout-line" aria-hidden="true" />
          On click: save to Orders
        </span>
      </div>
      <p>Drop in text, buttons, images and forms; style them; make buttons do things. No code.</p>
    </div>
  );
}

function StoreCard() {
  const rows: [string, string, number, boolean][] = [
    ["Maya", "Croissant", 2, true],
    ["Leo", "Sourdough", 1, false],
    ["Ana", "Cupcake", 6, true],
    ["Jo", "Croissant", 3, false],
  ];
  return (
    <div className="demo-store">
      <table className="demo-table">
        <caption>Orders · example data</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Item</th>
            <th scope="col" className="n">
              Qty
            </th>
            <th scope="col">Picked up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, item, qty, done]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{item}</td>
              <td className="n num">{qty}</td>
              <td>{done ? <Check size={16} strokeWidth={3} aria-label="Yes" /> : <Minus size={16} strokeWidth={3} aria-label="Not yet" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Every form saves to a database you own. Edit it like a spreadsheet and decide who can see what.</p>
    </div>
  );
}

function ShareCard() {
  return (
    <div className="demo-share">
      <div className="demo-phone">
        <div className="demo-address num">bakery.example.com</div>
        <BakeryPage compact />
      </div>
      <div className="demo-share-copy">
        <div className="demo-people" aria-label="Two people editing">
          <span className="avatar sm pat-a">M</span>
          <span className="avatar sm pat-b">E</span>
          <span>Maya and Ethan are editing</span>
        </div>
        <p>Publish to your own link, install it on phones, and invite friends to build it with you, live.</p>
      </div>
    </div>
  );
}

export function StackDemo() {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((n) => (n + d + CARDS.length) % CARDS.length);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };
  return (
    <div className="stack-demo" role="group" aria-roledescription="card stack" aria-label="What you can do with Craftbase" onKeyDown={onKey}>
      <div className="stack-cards">
        <article key={i} className="stack-card dissolve" aria-labelledby="stack-card-title">
          <h3 id="stack-card-title" className="stack-card-title">
            {CARDS[i]}
            <span className="demo-tag">Example</span>
          </h3>
          {i === 0 ? <DesignCard /> : i === 1 ? <StoreCard /> : <ShareCard />}
        </article>
      </div>
      <div className="stack-nav">
        <button className="icon-btn bordered" onClick={() => go(-1)} aria-label="Previous card">
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>
        <span className="stack-count" aria-live="polite">
          <span className="num">
            {i + 1} of {CARDS.length}
          </span>{" "}
          · {CARDS[i]}
        </span>
        <button className="icon-btn bordered" onClick={() => go(1)} aria-label="Next card">
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
