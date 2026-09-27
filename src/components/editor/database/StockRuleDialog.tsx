"use client";

import { useEffect, useState } from "react";
import type { Collection, StockRule } from "@/lib/shared/types";
import { Modal } from "@/components/ui/Modal";
import { useEditor } from "../store";

/**
 * Stock keeping done by the server: each new row (an order) takes its quantity from the
 * linked record's stock (a product) in the same step, and is refused when there isn't enough.
 * The browser can't skip it or change the numbers.
 */
export function StockRuleDialog({ open, onClose, collection, onSave }: { open: boolean; onClose: () => void; collection: Collection; onSave: (rule: StockRule | null) => Promise<void> }) {
  const collections = useEditor((s) => s.collections);
  const [rule, setRule] = useState<Partial<StockRule>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setRule(collection.stock ? { ...collection.stock } : {});
  }, [open, collection.stock]);

  const links = collection.fields.filter((f) => f.type === "reference" && f.refCollectionId);
  const numbers = collection.fields.filter((f) => f.type === "number");
  const money = collection.fields.filter((f) => f.type === "currency" || f.type === "number");
  const link = links.find((f) => f.name === rule.refField);
  const target = collections.find((c) => c.id === link?.refCollectionId);
  const targetNumbers = target?.fields.filter((f) => f.type === "number") || [];
  const targetMoney = target?.fields.filter((f) => f.type === "currency" || f.type === "number") || [];
  const ready = !!(rule.refField && rule.qtyField && rule.stockField);

  const save = async (r: StockRule | null) => {
    setBusy(true);
    try {
      await onSave(r);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const select = (label: string, value: string | undefined, options: { name: string }[], onChange: (v: string | undefined) => void, optional = false) => (
    <div className="field">
      <label>{label}</label>
      <select className="select" value={value || ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{optional ? "Don't copy" : "Choose…"}</option>
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stock rule"
      description={`Each new row in ${collection.name} takes its quantity from the linked record's stock — checked and done by the server, so nobody can order more than there is or skip the stock change.`}
      footer={
        <>
          {collection.stock && (
            <button className="btn danger-ghost" style={{ marginRight: "auto" }} disabled={busy} onClick={() => void save(null)}>
              Turn off
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!ready || busy} onClick={() => void save(rule as StockRule)}>
            Save rule
          </button>
        </>
      }
    >
      {links.length === 0 || numbers.length === 0 ? (
        <div className="alert info">Add a “Link to record” field (e.g. Product) and a number field (e.g. Quantity) to {collection.name} first.</div>
      ) : (
        <>
          <div className="settings-row">
            {select("Which record it takes from", rule.refField, links, (v) => setRule({ ...rule, refField: v, stockField: undefined, priceField: undefined }))}
            {select("How many (this row)", rule.qtyField, numbers, (v) => setRule({ ...rule, qtyField: v }))}
          </div>
          {target && select(`Stock field (in ${target.name})`, rule.stockField, targetNumbers, (v) => setRule({ ...rule, stockField: v }))}
          {target && (
            <>
              <div className="mini-note">Optional: record the price at the moment of ordering, so later price changes don&apos;t alter past orders.</div>
              <div className="settings-row">
                {select(`Price (in ${target.name})`, rule.priceField, targetMoney, (v) => setRule({ ...rule, priceField: v }), true)}
                {select("Save unit price to", rule.unitPriceField, money, (v) => setRule({ ...rule, unitPriceField: v }), true)}
              </div>
              {select("Save price × quantity to", rule.totalField, money, (v) => setRule({ ...rule, totalField: v }), true)}
              <div className="mini-note">Tip: mark the price and total fields “Admins only” so visitors can&apos;t type their own.</div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
