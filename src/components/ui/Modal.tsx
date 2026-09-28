"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalFocus } from "./useModalFocus";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size,
  icon,
  className = "",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "wide" | "xl";
  icon?: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useModalFocus(open && mounted, onClose);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className={`modal ${size || ""} ${className}`} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : "Dialog"} aria-describedby={description ? descriptionId : undefined} onMouseDown={(e) => e.stopPropagation()}>
        {(title || description) && (
          <div className="modal-head">
            {icon}
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <h2 id={titleId}>{title}</h2>}
              {description && <p id={descriptionId}>{description}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
