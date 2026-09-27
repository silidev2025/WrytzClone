"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Monitor, Plus, Smartphone } from "lucide-react";
import type { AppKind } from "@/lib/shared/types";
import type { TemplateCard } from "@/lib/server/templateCards";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { MiniPreview } from "./MiniPreview";

const KINDS: { kind: AppKind; label: string; text: string; icon: typeof Monitor }[] = [
  { kind: "website", label: "Website", text: "Pages that fit computers and phones: sites, shops, forms, portfolios.", icon: Monitor },
  { kind: "mobile", label: "Mobile app", text: "Phone screens with a tab bar. People add it to their home screen like an app.", icon: Smartphone },
];

export function CreateAppDialog({
  open,
  onClose,
  templates,
  initialTemplate = "blank",
  initialKind = "website",
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateCard[];
  initialTemplate?: string;
  initialKind?: AppKind;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AppKind>(initialKind);
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = templates.find((x) => x.id === initialTemplate);
    setTemplateId(t ? t.id : "blank");
    setKind(t ? t.kind : initialKind);
    setName(t ? `My ${t.name.toLowerCase()}` : "");
    setError(null);
  }, [open, initialTemplate, initialKind, templates]);

  const shown = templates.filter((t) => t.kind === kind);

  const create = async () => {
    if (!name.trim()) {
      setError("Give your app a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { app } = await api<{ app: { id: string } }>("/api/apps", { body: { name, templateId, kind } });
      router.push(`/editor/${app.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title="Create a new app"
      description="Pick what you're making, name it, and choose a starting point. You can change everything later."
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn gradient" onClick={create} disabled={busy}>
            {busy ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <Plus size={16} />}
            Create {kind === "mobile" ? "mobile app" : "website"}
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">What are you making?</span>
        <div className="kind-pick-row" role="radiogroup" aria-label="What are you making?">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              className={`kind-pick ${kind === k.kind ? "selected" : ""}`}
              onClick={() => {
                setKind(k.kind);
                if (templates.find((t) => t.id === templateId)?.kind !== k.kind) setTemplateId("blank");
              }}
            >
              <span className="kind-pick-icon">
                <k.icon size={20} />
              </span>
              <span>
                <strong>{k.label}</strong>
                <small>{k.text}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label htmlFor="app-name">Name</label>
        <input
          id="app-name"
          className={`input ${error ? "invalid" : ""}`}
          value={name}
          maxLength={60}
          autoFocus
          placeholder={kind === "mobile" ? "e.g. Habit tracker, Coffee club, Team check-in" : "e.g. Book club, Bakery orders, Team feedback"}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        {error && <div className="field-error">{error}</div>}
      </form>
      <div className="field">
        <span className="field-label">Start from</span>
        <div className="template-pick-grid">
          <button type="button" className={`template-pick ${templateId === "blank" ? "selected" : ""}`} onClick={() => setTemplateId("blank")}>
            <div className="template-pick-thumb blank">
              {kind === "mobile" ? <Smartphone size={26} /> : <Plus size={26} />}
            </div>
            <span>{kind === "mobile" ? "Blank phone app" : "Blank canvas"}</span>
            {templateId === "blank" && (
              <span className="template-pick-check">
                <Check size={13} />
              </span>
            )}
          </button>
          {shown.map((t) => {
            const choose = () => {
              setTemplateId(t.id);
              if (!name.trim() || name.startsWith("My ")) setName(`My ${t.name.toLowerCase()}`);
            };
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-pressed={templateId === t.id}
                className={`template-pick ${templateId === t.id ? "selected" : ""}`}
                onClick={choose}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose();
                  }
                }}
              >
                <div className="template-pick-thumb">{t.preview ? <MiniPreview preview={t.preview} /> : <span style={{ fontSize: 28 }}>{t.emoji}</span>}</div>
                <span>{t.name}</span>
                {templateId === t.id && (
                  <span className="template-pick-check">
                    <Check size={13} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
