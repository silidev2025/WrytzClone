"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Trash2, Users } from "lucide-react";
import { relativeTime } from "@/lib/shared/util";
import { platformUrl } from "@/lib/shared/urls";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { Avatar } from "@/components/workspace/Shell";
import { useEditor } from "../store";

type Role = "editor" | "admin";
interface People {
  admins: { id: string; name: string; email: string; role: Role }[];
  invites: { id: string; createdAt: string; expiresAt: string; role: Role }[];
}

export const ROLE_LABELS: Record<Role, { label: string; hint: string }> = {
  editor: { label: "Can edit", hint: "Changes the design and the database with you, live, and manages the live app." },
  admin: { label: "Live-app admin", hint: "Opens admin-only pages and manages every record in the published app. Can't open the editor." },
};

/** Google Docs-style sharing: who can edit or run this app, and invite links for new people. */
export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useEditor((s) => s.app);
  const role = useEditor((s) => s.role);
  const me = useEditor((s) => s.user);
  const peers = useEditor((s) => s.peers);
  const [people, setPeople] = useState<People | null>(null);
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [link, setLink] = useState<{ url: string; role: Role } | null>(null);
  const owner = role === "owner";

  const load = () =>
    api<People>(`/api/apps/${app.id}/admins`)
      .then(setPeople)
      .catch((err) => toast.error(errorMessage(err)));
  useEffect(() => {
    if (open && owner) void load();
    if (!open) setLink(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner, app.id]);

  const invite = async () => {
    try {
      const res = await api<{ path: string; role: Role }>(`/api/apps/${app.id}/admins`, { body: { role: inviteRole } });
      const url = platformUrl(res.path);
      setLink({ url: url.startsWith("/") ? window.location.origin + url : url, role: res.role });
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const changeRole = async (userId: string, next: Role) => {
    try {
      await api(`/api/apps/${app.id}/admins`, { method: "PATCH", body: { userId, role: next } });
      toast.success("Access updated");
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (body: { inviteId?: string; userId?: string }, title: string) => {
    if (!(await confirmDialog({ title, confirmLabel: "Remove", danger: true }))) return;
    try {
      await api(`/api/apps/${app.id}/admins`, { method: "DELETE", body });
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // one row per person here now (they may have several tabs open)
  const here = new Map<string, { name: string; color: string }>();
  for (const p of Object.values(peers)) here.set(p.userId, { name: p.name, color: p.color });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      className="share-dialog"
      icon={
        <span className="empty-icon" style={{ width: 44, height: 44, borderRadius: 13, background: "var(--accent-grad)", color: "#fff" }}>
          <Users size={20} />
        </span>
      }
      title={`Share “${app.name}”`}
      description="Everyone with edit access works on the same design at the same time: you see their changes, selections and pointers live, and every change saves on its own."
      footer={
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="field">
        <span className="field-label">Here now</span>
        <div className="share-here">
          <span className="share-person">
            <Avatar user={me} size={26} /> {me.name} (you)
          </span>
          {[...here.entries()]
            .filter(([userId]) => userId !== me.id)
            .map(([userId, p]) => (
              <span key={userId} className="share-person">
                <span className="avatar" style={{ background: p.color, width: 26, height: 26, fontSize: 11 }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                {p.name}
              </span>
            ))}
        </div>
      </div>

      {!owner ? (
        <div className="alert info">You can edit this app. Only its owner can invite people or change who has access.</div>
      ) : (
        <>
          <div className="field">
            <span className="field-label">People with access</span>
            <div className="insp-row">
              <span style={{ flex: 1 }}>
                <strong>{me.name}</strong> <span className="mini-note">{me.email}</span>
              </span>
              <span className="mini-note">Owner</span>
            </div>
            {people?.admins.map((a) => (
              <div key={a.id} className="insp-row share-row">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{a.name}</strong> <span className="mini-note">{a.email}</span>
                </span>
                <select className="input sm" value={a.role} aria-label={`What ${a.name} can do`} onChange={(e) => void changeRole(a.id, e.target.value as Role)}>
                  <option value="editor">{ROLE_LABELS.editor.label}</option>
                  <option value="admin">{ROLE_LABELS.admin.label}</option>
                </select>
                <button className="icon-btn sm" onClick={() => void remove({ userId: a.id }, `Remove ${a.name} from this app?`)} aria-label={`Remove ${a.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {people?.invites.map((i) => (
              <div key={i.id} className="insp-row">
                <span style={{ flex: 1 }} className="mini-note">
                  Open invite link ({ROLE_LABELS[i.role].label}) · expires {relativeTime(i.expiresAt)}
                </span>
                <button className="icon-btn sm" onClick={() => void remove({ inviteId: i.id }, "Cancel this invite link?")} aria-label="Cancel invite">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="field">
            <span className="field-label">Invite someone</span>
            <div className="share-roles" role="radiogroup" aria-label="What they can do">
              {(["editor", "admin"] as Role[]).map((r) => (
                <label key={r} className={`share-role ${inviteRole === r ? "on" : ""}`}>
                  <input type="radio" name="invite-role" checked={inviteRole === r} onChange={() => setInviteRole(r)} />
                  <span>
                    <strong>{ROLE_LABELS[r].label}</strong>
                    <small>{ROLE_LABELS[r].hint}</small>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <button className="btn" onClick={() => void invite()}>
                <Link2 size={15} /> Create invite link
              </button>
            </div>
            {link && (
              <div className="alert info" style={{ display: "grid", gap: 8 }}>
                <span>
                  Send this link privately to one person. It works once, for 7 days, and gives <strong>{ROLE_LABELS[link.role].label.toLowerCase()}</strong> access to whoever opens it while signed in.
                </span>
                <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                  <input className="input" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
                  <button
                    className="btn sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(link.url);
                      toast.success("Invite link copied");
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
