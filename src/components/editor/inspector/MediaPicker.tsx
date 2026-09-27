"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Upload } from "lucide-react";
import type { MediaItem } from "@/lib/shared/types";
import { safeImageSrc } from "@/lib/shared/util";
import { STOCK_PHOTOS, photoUrl } from "@/lib/client/stock";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { ed } from "../store";

export type MediaEntry = MediaItem & { url: string };

/** The app's uploaded files, refreshed whenever something is uploaded or deleted. */
export function useMediaLibrary() {
  const [items, setItems] = useState<MediaEntry[] | null>(null);
  const load = useCallback(async () => {
    try {
      const { media } = await api<{ media: MediaEntry[] }>(`/api/media?appId=${ed().app.id}`);
      setItems(media);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener("cb:media-changed", on);
    return () => window.removeEventListener("cb:media-changed", on);
  }, [load]);
  return { items, reload: load };
}

export async function uploadFiles(files: File[]): Promise<MediaEntry[]> {
  const out: MediaEntry[] = [];
  for (const file of files) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("appId", ed().app.id);
      const { media } = await api<{ media: MediaEntry }>("/api/media", { body: fd });
      out.push(media);
    } catch (err) {
      toast.error(`${file.name}: ${errorMessage(err)}`);
    }
  }
  if (out.length) window.dispatchEvent(new Event("cb:media-changed"));
  return out;
}

export function MediaPickerModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (src: string, name?: string) => void }) {
  const [tab, setTab] = useState<"uploads" | "photos" | "link">("photos");
  const { items } = useMediaLibrary();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const images = (items || []).filter((m) => m.mime.startsWith("image/"));

  const pick = (src: string, name?: string) => {
    onPick(src, name);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="wide" title="Choose an image" description="Upload your own, pick a free photo, or paste a link.">
      <div className="subtabs" style={{ margin: 0 }}>
        <button aria-pressed={tab === "photos"} onClick={() => setTab("photos")}>
          Free photos
        </button>
        <button aria-pressed={tab === "uploads"} onClick={() => setTab("uploads")}>
          Your uploads
        </button>
        <button aria-pressed={tab === "link"} onClick={() => setTab("link")}>
          Paste a link
        </button>
      </div>
      {tab === "photos" && (
        <div className="photo-grid" style={{ columns: 4, maxHeight: 440, overflowY: "auto" }}>
          {STOCK_PHOTOS.slice(0, 120).map(([id, w, h, author]) => (
            <button key={id} className="ph" title={`Photo by ${author}`} onClick={() => pick(photoUrl(id, 1400), `Photo by ${author}`)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://picsum.photos/id/${id}/300/${Math.round((300 * h) / w)}`} alt={`Photo by ${author}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {tab === "uploads" && (
        <div style={{ display: "grid", gap: 12 }}>
          <button className="upload-drop" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={20} />
            {busy ? "Uploading…" : "Upload images from your device"}
            <span className="mini-note">PNG, JPG, GIF, WebP or SVG · up to 10 MB</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (!files.length) return;
              setBusy(true);
              const up = await uploadFiles(files);
              setBusy(false);
              if (up.length === 1) pick(up[0].url, up[0].name);
            }}
          />
          {items === null ? (
            <div className="mini-note">Loading…</div>
          ) : images.length === 0 ? (
            <div className="mini-note">No uploads yet.</div>
          ) : (
            <div className="photo-grid" style={{ columns: 4, maxHeight: 360, overflowY: "auto" }}>
              {images.map((m) => (
                <button key={m.id} className="ph" title={m.name} onClick={() => pick(m.url, m.name)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.name} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "link" && (
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            const src = safeImageSrc(link);
            if (!src) {
              toast.error("That doesn't look like an image link (it should start with https://).");
              return;
            }
            pick(src);
          }}
        >
          <label htmlFor="img-link">Image address</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="img-link" className="input" placeholder="https://…/photo.jpg" value={link} onChange={(e) => setLink(e.target.value)} autoFocus />
            <button className="btn primary">
              <Link2 size={15} /> Use
            </button>
          </div>
          <span className="field-hint">Tip: you can also bind an image to data, like {"{{record.Photo}}"}, in the image's Content tab.</span>
        </form>
      )}
    </Modal>
  );
}

export function MediaPickerButton({ label = "Choose image", onPick }: { label?: string; onPick: (src: string, name?: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)} style={{ width: "100%" }}>
        <ImagePlus size={15} /> {label}
      </button>
      <MediaPickerModal open={open} onClose={() => setOpen(false)} onPick={onPick} />
    </>
  );
}
