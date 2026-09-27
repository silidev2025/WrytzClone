"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

type Request =
  | {
      kind: "confirm";
      title: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
      resolve: (v: boolean) => void;
    }
  | {
      kind: "prompt";
      title: string;
      message?: string;
      label?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmLabel?: string;
      validate?: (v: string) => string | null;
      resolve: (v: string | null) => void;
    };

let push: ((r: Request) => void) | null = null;

export function confirmDialog(opts: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(window.confirm(opts.title));
    push({ kind: "confirm", ...opts, resolve });
  });
}

export function promptDialog(opts: {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  validate?: (v: string) => string | null;
}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!push) return resolve(window.prompt(opts.title, opts.defaultValue));
    push({ kind: "prompt", ...opts, resolve });
  });
}

export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    push = (r) => {
      setReq(r);
      setError(null);
      if (r.kind === "prompt") setValue(r.defaultValue || "");
    };
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (req?.kind === "prompt") setTimeout(() => inputRef.current?.select(), 30);
  }, [req]);

  if (!req) return null;

  const close = (result: boolean) => {
    if (req.kind === "confirm") req.resolve(result);
    else {
      if (result) {
        const err = req.validate?.(value.trim()) ?? (value.trim() ? null : "This can't be empty");
        if (err) {
          setError(err);
          return;
        }
        req.resolve(value.trim());
      } else req.resolve(null);
    }
    setReq(null);
  };

  return (
    <Modal
      open
      onClose={() => close(false)}
      title={req.title}
      description={req.message}
      footer={
        <>
          <button className="btn ghost" onClick={() => close(false)}>
            {req.kind === "confirm" ? req.cancelLabel || "Cancel" : "Cancel"}
          </button>
          <button className={`btn ${req.kind === "confirm" && req.danger ? "danger" : "primary"}`} onClick={() => close(true)} autoFocus={req.kind === "confirm"}>
            {req.confirmLabel || (req.kind === "confirm" ? "Confirm" : "Save")}
          </button>
        </>
      }
    >
      {req.kind === "prompt" && (
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            close(true);
          }}
        >
          {req.label && <label htmlFor="prompt-input">{req.label}</label>}
          <input
            id="prompt-input"
            ref={inputRef}
            className={`input ${error ? "invalid" : ""}`}
            value={value}
            placeholder={req.placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          {error && <div className="field-error">{error}</div>}
        </form>
      )}
    </Modal>
  );
}
