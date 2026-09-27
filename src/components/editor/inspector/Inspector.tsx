"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, FileText, Lock, MousePointer2, Unlock, X } from "lucide-react";
import type { El, EventName } from "@/lib/shared/types";
import { ELEMENT_INFO } from "@/lib/shared/elements";
import { Icon } from "@/components/ui/Icon";
import { getPage, renameEl, toggleHidden, toggleLock, updateEls, useEditor, type RightTab } from "../store";
import { DesignTab } from "./DesignTab";
import { ContentTab } from "./ContentTab";
import { DataTab } from "./DataTab";
import { PageSettings } from "./PageSettings";
import { ActionsEditor } from "./ActionsEditor";
import { Section } from "./controls";

const EVENT_LABELS: Record<EventName, { title: string; hint: string }> = {
  click: { title: "When clicked", hint: "Runs when a visitor clicks or taps it." },
  change: { title: "When the value changes", hint: "Runs a moment after someone types or picks something." },
  submit: { title: "After the form is sent", hint: "Runs after the answers are checked and saved." },
  rowClick: { title: "When a row is clicked", hint: "Inside these actions, {{record.…}} is the clicked row." },
};

function EventsTab({ el }: { el: El }) {
  const events = ELEMENT_INFO[el.type].events;
  if (!events.length)
    return (
      <div className="insp-section">
        <div className="mini-note">This element doesn&apos;t react to anything. Buttons, images, shapes, cards and inputs can.</div>
      </div>
    );
  return (
    <>
      {el.type === "form" && (
        <div className="insp-section">
          <div className="mini-note brand">A submit button inside the form checks required fields, saves to the collection chosen in the Data tab, then runs these actions.</div>
        </div>
      )}
      {events.map((ev) => (
        <Section key={ev} title={EVENT_LABELS[ev].title}>
          <div className="mini-note">{EVENT_LABELS[ev].hint}</div>
          <ActionsEditor
            actions={el.events?.[ev] || []}
            elementId={el.id}
            onChange={(next) =>
              updateEls([el.id], (e) => {
                e.events = { ...(e.events || {}), [ev]: next };
                if (ev === "click" && (e.type === "box" || e.type === "image" || e.type === "text" || e.type === "icon")) e.style.cursor = next.length ? "pointer" : undefined;
              })
            }
          />
        </Section>
      ))}
    </>
  );
}

function tabsFor(el: El): RightTab[] {
  const tabs: RightTab[] = ["design", "content"];
  if (ELEMENT_INFO[el.type].events.length) tabs.push("events");
  if (["list", "table", "form", "stat", "chart"].includes(el.type)) tabs.push("data");
  return tabs;
}

const TAB_LABELS: Record<RightTab, string> = { design: "Design", content: "Content", events: "Events", data: "Data" };

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const page = useEditor((s) => getPage(s));
  const theme = useEditor((s) => s.doc.theme);
  const rightTab = useEditor((s) => s.rightTab);
  const open = useEditor((s) => s.inspectorOpen);
  const closeButton = <button className="icon-btn sm ed-mobile-control" aria-label="Close inspector" onClick={() => useEditor.setState({ inspectorOpen: false })}><X size={16} /></button>;
  const els = selection.map((id) => page.elements[id]).filter((e): e is El => !!e);
  const first = els[0];
  const [name, setName] = useState(first?.name || "");
  useEffect(() => setName(first?.name || ""), [first?.id, first?.name]);

  if (!first) {
    return (
      <aside className={`ed-right ${open ? "" : "collapsed"}`} aria-label="Page settings">
        <div className="insp-head">
          <span className="type-ico">
            <FileText size={16} />
          </span>
          <strong style={{ flex: 1 }}>Page settings</strong>
          {closeButton}
        </div>
        <div className="insp-body">
          <div className="insp-section">
            <div className="mini-note" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <MousePointer2 size={13} /> Select something on the page to change it.
            </div>
          </div>
          <PageSettings />
        </div>
      </aside>
    );
  }

  const multi = els.length > 1;
  const tabs = multi ? (["design"] as RightTab[]) : tabsFor(first);
  const tab = tabs.includes(rightTab) ? rightTab : "design";
  const allLocked = els.every((e) => e.locked);
  const allHidden = els.every((e) => e.hidden);

  return (
    <aside className={`ed-right ${open ? "" : "collapsed"}`} aria-label="Inspector">
      <div className="insp-head">
        <span className="type-ico">
          <Icon name={multi ? "Layers" : ELEMENT_INFO[first.type].icon} size={16} />
        </span>
        {multi ? (
          <strong style={{ flex: 1 }}>{els.length} selected</strong>
        ) : (
          <input
            className="insp-name"
            value={name}
            aria-label="Layer name"
            title="Layer name — also used in bindings like {{Name.value}}"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() && name !== first.name ? renameEl(first.id, name) : setName(first.name))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        )}
        <button className="icon-btn sm" onClick={() => toggleLock()} title={allLocked ? "Unlock" : "Lock"} aria-label={allLocked ? "Unlock" : "Lock"}>
          {allLocked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <button className="icon-btn sm" onClick={() => toggleHidden()} title={allHidden ? "Show" : "Hide"} aria-label={allHidden ? "Show" : "Hide"}>
          {allHidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        {closeButton}
      </div>
      {tabs.length > 1 && (
        <div className="insp-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-pressed={tab === t} onClick={() => useEditor.setState({ rightTab: t })}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      <div className="insp-body" key={`${first.id}-${tab}`}>
        {first.locked && !multi && (
          <div className="insp-section">
            <div className="mini-note brand">This layer is locked, so it can&apos;t be moved on the canvas. You can still change its settings.</div>
          </div>
        )}
        {tab === "design" && <DesignTab els={els} theme={theme} />}
        {tab === "content" && <ContentTab el={first} theme={theme} />}
        {tab === "events" && <EventsTab el={first} />}
        {tab === "data" && <DataTab el={first} />}
      </div>
    </aside>
  );
}
