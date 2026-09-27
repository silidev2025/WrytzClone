"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CATALOG, CATALOG_CATEGORIES } from "@/lib/shared/elements";
import { Icon } from "@/components/ui/Icon";
import { addSpec } from "../store";
import { startPanelDrag } from "../canvas/dragPayload";

export function AddPanel() {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const items = CATALOG.filter((c) => !term || `${c.label} ${c.keywords || ""} ${c.category}`.toLowerCase().includes(term));
  return (
    <>
      <div className="panel-head">
        <h2>Add elements</h2>
      </div>
      <div className="panel-search">
        <Search size={15} />
        <input className="input" placeholder="Search: button, form, chart…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search elements" />
      </div>
      <div className="panel-scroll">
        <p className="panel-hint">Drag onto the page, or click to drop it in the middle. Select a box or form first to put things inside it.</p>
        {CATALOG_CATEGORIES.map((cat) => {
          const list = items.filter((i) => i.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat}>
              <div className="panel-section-title">{cat}</div>
              <div className="tile-grid">
                {list.map((item) => (
                  <button
                    key={item.id}
                    className="tile"
                    title={item.hint || item.label}
                    onPointerDown={(e) => startPanelDrag(e, { kind: "spec", spec: item.spec(), label: item.label }, () => addSpec(item.spec()))}
                  >
                    <Icon name={item.icon} size={22} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!items.length && <p className="panel-hint">Nothing matches “{q}”.</p>}
      </div>
    </>
  );
}
