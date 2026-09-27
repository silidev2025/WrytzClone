"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, FileText, Search, Shuffle, Trash2, Upload } from "lucide-react";
import { STOCK_PHOTOS, photoUrl } from "@/lib/client/stock";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { addSpec } from "../store";
import { startPanelDrag } from "../canvas/dragPayload";
import { IconGrid, ICON_CATS } from "../inspector/pickers";
import { uploadFiles, useMediaLibrary } from "../inspector/MediaPicker";

const STICKERS: Record<string, string> = {
  Smileys: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 😎 🤓 🥳 😏 😴 🤯 😱 🥺 😭 🤗 🤔 🙄 😬",
  "Hearts & sparkle": "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💗 💓 💞 💕 💘 💝 ✨ ⭐ 🌟 💫 🔥 💯",
  Celebrate: "🎉 🎊 🎈 🎁 🎂 🥂 🍾 🏆 🥇 🎯 🎨 🎭 🎵 🎶 🎤 🎧 📸 🎬",
  Food: "🍕 🍔 🍟 🌮 🍣 🍩 🍪 🧁 🍰 🍫 🍿 ☕ 🍵 🧃 🍓 🍉 🍋 🥑 🥐 🍞",
  Nature: "🌸 🌷 🌹 🌻 🌼 🍀 🌿 🌵 🌴 🍁 🌈 ☀️ 🌙 ⛅ ❄️ 🌊 🐶 🐱 🦊 🐻 🐼 🦄 🐝 🦋",
  Places: "🏠 🏡 🏢 🏖️ 🏔️ 🗽 🚀 ✈️ 🚗 🚲 ⛵ 🗺️ 📍 🧭",
  Things: "💡 📚 📝 📌 📎 ✏️ 📅 ⏰ 💻 📱 ⌚ 🛒 🛍️ 💳 💰 🔑 🔒 🧩 🎮",
  Hands: "👍 👎 👏 🙌 👋 🤝 💪 ✌️ 🤞 👌 👉 👈 ☝️",
  Symbols: "✅ ❌ ⚠️ ❓ ❗ ➕ ➖ ➡️ ⬅️ ⬆️ ⬇️ 🔔 💬 ℹ️ 🆕 🆓 💲",
};

function stickerSpec(emoji: string) {
  return { type: "text" as const, name: "Sticker", box: { w: 96, h: 96 }, sizing: { w: "fixed" as const, h: "fixed" as const }, style: { fontSize: 72, textAlign: "center" as const, verticalAlign: "middle" as const, lineHeight: 1 }, props: { text: emoji, tag: "p" as const } };
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });
}

async function addImage(src: string, name: string, w?: number, h?: number) {
  let dims = { w: w || 0, h: h || 0 };
  if (!dims.w || !dims.h) dims = await imageSize(src);
  const width = Math.min(460, dims.w);
  addSpec({ type: "image", box: { w: width, h: Math.round((width * dims.h) / dims.w) }, props: { src, alt: name } });
}

export function MediaPanel() {
  const [tab, setTab] = useState<"photos" | "icons" | "stickers" | "uploads">("photos");
  const [seed, setSeed] = useState(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Popular");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { items } = useMediaLibrary();

  const photos = useMemo(() => {
    const list = STOCK_PHOTOS.slice();
    if (seed) {
      let s = seed;
      for (let i = list.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    return list.slice(0, 60);
  }, [seed]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    await uploadFiles(files);
    setBusy(false);
  };

  return (
    <>
      <div className="panel-head">
        <h2>Media</h2>
      </div>
      <div className="subtabs">
        <button aria-pressed={tab === "photos"} onClick={() => setTab("photos")}>
          Photos
        </button>
        <button aria-pressed={tab === "icons"} onClick={() => setTab("icons")}>
          Icons
        </button>
        <button aria-pressed={tab === "stickers"} onClick={() => setTab("stickers")}>
          Stickers
        </button>
        <button aria-pressed={tab === "uploads"} onClick={() => setTab("uploads")}>
          Uploads
        </button>
      </div>

      {tab === "icons" && (
        <div className="panel-search">
          <Search size={15} />
          <input className="input" placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search icons" />
        </div>
      )}

      <div className="panel-scroll">
        {tab === "photos" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p className="panel-hint">Free photos. Drag one onto an image to swap it.</p>
              <button className="icon-btn sm" title="Shuffle" aria-label="Shuffle photos" onClick={() => setSeed((s) => s + 7)}>
                <Shuffle size={14} />
              </button>
            </div>
            <div className="photo-grid">
              {photos.map(([id, w, h, author]) => (
                <button
                  key={id}
                  className="ph"
                  title={`Photo by ${author}`}
                  onPointerDown={(e) => startPanelDrag(e, { kind: "image", src: photoUrl(id, 1400), label: `Photo by ${author}`, width: w, height: h }, () => void addImage(photoUrl(id, 1400), `Photo by ${author}`, w, h))}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://picsum.photos/id/${id}/280/${Math.round((280 * h) / w)}`} alt={`Photo by ${author}`} loading="lazy" />
                </button>
              ))}
            </div>
            <p className="panel-hint">Photos from Lorem Picsum / Unsplash, free to use.</p>
          </>
        )}

        {tab === "icons" && (
          <>
            {!q && (
              <select className="txt-field" style={{ marginBottom: 8 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Icon category">
                {ICON_CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
            <IconGrid
              filter={q}
              category={cat}
              onPick={() => undefined}
              onDragStart={(e, name) =>
                startPanelDrag(e, { kind: "icon", icon: name, label: name }, () => addSpec({ type: "icon", box: { w: 64, h: 64 }, props: { icon: name } }))
              }
            />
          </>
        )}

        {tab === "stickers" &&
          Object.entries(STICKERS).map(([group, list]) => (
            <div key={group}>
              <div className="panel-section-title">{group}</div>
              <div className="emoji-grid">
                {list.split(" ").map((em) => (
                  <button key={em} title="Add sticker" onPointerDown={(e) => startPanelDrag(e, { kind: "spec", spec: stickerSpec(em), label: em }, () => addSpec(stickerSpec(em)))}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {tab === "uploads" && (
          <>
            <div
              className={`upload-drop ${over ? "over" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                void upload(Array.from(e.dataTransfer.files || []));
              }}
            >
              <Upload size={20} />
              {busy ? "Uploading…" : "Upload files"}
              <span className="mini-note">Click or drop images, PDFs, video or audio (up to 10 MB each)</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                void upload(files);
              }}
            />
            <div className="panel-section-title">Your files</div>
            {items === null ? (
              <p className="panel-hint">Loading…</p>
            ) : items.length === 0 ? (
              <p className="panel-hint">Nothing uploaded yet. You can also drop images straight onto the canvas.</p>
            ) : (
              <>
                <div className="photo-grid">
                  {items
                    .filter((m) => m.mime.startsWith("image/"))
                    .map((m) => (
                      <button key={m.id} className="ph" title={m.name} onPointerDown={(e) => startPanelDrag(e, { kind: "image", src: m.url, label: m.name }, () => void addImage(m.url, m.name))}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt={m.name} loading="lazy" />
                        <span
                          className="icon-btn sm bordered ph-del"
                          role="button"
                          aria-label={`Delete ${m.name}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!(await confirmDialog({ title: `Delete ${m.name}?`, message: "Anything still using this file will show an empty image.", confirmLabel: "Delete", danger: true }))) return;
                            try {
                              await api(`/api/media/${m.id}`, { method: "DELETE" });
                              window.dispatchEvent(new Event("cb:media-changed"));
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </span>
                      </button>
                    ))}
                </div>
                {items
                  .filter((m) => !m.mime.startsWith("image/"))
                  .map((m) => (
                    <div key={m.id} className="insp-row" style={{ gap: 8 }}>
                      <FileText size={16} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5 }}>{m.name}</span>
                      <button
                        className="icon-btn sm"
                        title="Copy link"
                        onClick={() => {
                          void navigator.clipboard.writeText(new URL(m.url, window.location.href).toString());
                          toast.success("Link copied — paste it into a button's “Open a website link” action.");
                        }}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
