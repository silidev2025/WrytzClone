"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import type { AppDoc } from "@/lib/shared/types";
import { MOBILE_BREAKPOINT } from "@/lib/shared/types";
import { fillToCss, fontStack, mix, readableOn } from "@/lib/shared/theme";
import { frameWidthFor, isMobileApp } from "@/lib/shared/layout";
import { BRAND } from "@/lib/shared/brand";
import { platformUrl, signInUrl } from "@/lib/shared/urls";
import { Icon } from "@/components/ui/Icon";
import { RuntimeContext, createRuntimeStore, currentPage, type RTStore, type RuntimeUser, type SchemaCollection } from "./store";
import { PageFrame } from "./PageView";
import { runActions } from "./actions";
import { runtimeApi } from "./api";
import { docFonts, useGoogleFonts } from "./fonts";
import { PinLayerContext } from "./pins";

export interface RuntimeSession {
  user: RuntimeUser | null;
  /** signed in to the platform, but hasn't chosen to share who they are with this app yet */
  signedInElsewhere?: boolean;
  schema: SchemaCollection[];
}

export function resolvePath(doc: AppDoc, segments: string[]): { pageId: string | null; recordId: string | null } {
  if (!segments.length) return { pageId: doc.homePageId, recordId: null };
  const [first, second] = segments;
  const page = doc.pages.find((p) => p.path && p.path === first.toLowerCase());
  if (page) return { pageId: page.id, recordId: second ?? null };
  // "/<recordId>" on a home page that shows a record
  const home = doc.pages.find((p) => p.id === doc.homePageId);
  if (home?.recordCollectionId && segments.length === 1) return { pageId: home.id, recordId: first };
  return { pageId: null, recordId: null };
}

export function AppRuntime({
  mode,
  appId,
  appName,
  doc,
  basePath,
  path,
  session,
  editorLink = true,
}: {
  mode: "preview" | "live";
  appId: string;
  appName: string;
  doc: AppDoc;
  basePath: string;
  path: string[];
  session: RuntimeSession;
  /** preview only: link back to the editor (off for a device that opened the preview with a pass) */
  editorLink?: boolean;
}) {
  const storeRef = useRef<RTStore | null>(null);
  const initial = useMemo(() => resolvePath(doc, path), [doc, path]);
  if (!storeRef.current) {
    storeRef.current = createRuntimeStore({
      mode,
      appId,
      appName,
      doc,
      schema: session.schema,
      user: session.user,
      pageId: initial.pageId ?? doc.homePageId,
      recordId: initial.recordId,
    });
  }
  const store = storeRef.current;
  const api = useMemo(() => runtimeApi(appId), [appId]);
  const [missing, setMissing] = useState(initial.pageId === null);
  const page = useStore(store, (s) => currentPage(s));
  const pageId = useStore(store, (s) => s.pageId);
  const recordId = useStore(store, (s) => s.recordId);
  const recordState = useStore(store, (s) => s.pageRecordState);
  const user = useStore(store, (s) => s.user);
  const dataVersion = useStore(store, (s) => s.dataVersion);
  const confirmation = useStore(store, (s) => page?.confirmationVariable ? s.vars[page.confirmationVariable] : undefined);
  const theme = doc.theme;
  useGoogleFonts(docFonts(doc));

  /* ------------------------------------------------ routing */
  useEffect(() => {
    const urlFor = (pid: string, rid: string | null | undefined) => {
      const p = doc.pages.find((x) => x.id === pid);
      return `${basePath}${p?.path ? `/${p.path}` : ""}${rid ? `/${encodeURIComponent(rid)}` : ""}` || "/";
    };
    const reset = { pageRecord: null, pageRecordState: "idle" as const, inputs: {}, inputErrors: {}, shown: {}, dialogs: {}, tabs: {} };
    const existingDepth = window.history.state?.appId === appId ? Number(window.history.state?.appDepth) || 0 : 0;
    window.history.replaceState({ ...window.history.state, appId, appDepth: existingDepth, confirmation: window.history.state?.appId === appId ? window.history.state.confirmation : undefined }, "");
    const restoreConfirmation = (pid: string) => {
      const variable = doc.pages.find((p) => p.id === pid)?.confirmationVariable;
      if (!variable) return;
      const entry = window.history.state;
      const value = entry?.appId === appId && entry?.pid === pid && entry?.confirmation?.userId === (session.user?.id ?? null) && typeof entry.confirmation.value === "string" ? entry.confirmation.value : "";
      store.setState((s) => ({ vars: { ...s.vars, [variable]: value } }));
    };
    restoreConfirmation(store.getState().pageId);
    store.setState({
      navigate: (pid, rid) => {
        if (!doc.pages.some((x) => x.id === pid)) return;
        const depth = window.history.state?.appId === appId ? Number(window.history.state.appDepth) || 0 : 0;
        const variable = doc.pages.find((p) => p.id === pid)?.confirmationVariable;
        const value = variable ? store.getState().vars[variable] : undefined;
        window.history.pushState({ pid, rid, appId, appDepth: depth + 1, confirmation: typeof value === "string" && value ? { value, userId: session.user?.id ?? null } : undefined }, "", urlFor(pid, rid));
        store.setState({ pageId: pid, recordId: rid ?? null, ...reset });
        setMissing(false);
        window.scrollTo({ top: 0 });
      },
      goBack: () => {
        if (window.history.state?.appId === appId && window.history.state?.appDepth > 0) window.history.back();
        else store.getState().navigate(doc.homePageId, null);
      },
    });
    const onPop = () => {
      const segs = window.location.pathname.slice(basePath.length).split("/").filter(Boolean).map(decodeURIComponent);
      const r = resolvePath(doc, segs);
      if (r.pageId) {
        restoreConfirmation(r.pageId);
        store.setState({ pageId: r.pageId, recordId: r.recordId, ...reset });
        setMissing(false);
      } else setMissing(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [store, doc, basePath, appId, session.user?.id]);

  /* ------------------------------------------------ fit to screen */
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  const [innerH, setInnerH] = useState(0);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => setVw(root.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);
  // mobile apps always use their one phone layout; websites switch layout on small screens
  const phoneApp = isMobileApp(doc);
  const bp = phoneApp ? "desktop" : vw && vw < MOBILE_BREAKPOINT ? "mobile" : "desktop";
  const autoFlow = bp === "mobile" && !page?.mobileCustom;
  const frameW = autoFlow && vw ? Math.min(vw, 780) : frameWidthFor(doc, bp);
  const scale = autoFlow ? 1 : vw ? Math.min(vw / frameW, phoneApp ? 1.15 : bp === "mobile" ? 1.35 : 1.5) : 1;
  const bleed = vw && !phoneApp ? Math.max(0, (vw - frameW * scale) / 2 / scale) : 0;
  // on a big screen a phone app shows as a phone-width column
  const shell = phoneApp && vw > frameW * scale + 40;
  const [pinTop, setPinTop] = useState<HTMLElement | null>(null);
  const [pinBottom, setPinBottom] = useState<HTMLElement | null>(null);
  const pins = useMemo(() => ({ top: pinTop, bottom: pinBottom }), [pinTop, pinBottom]);
  useLayoutEffect(() => {
    store.setState({ bp, scale, bleed, frameWidth: frameW });
  }, [store, bp, scale, bleed, frameW]);
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const update = () => setInnerH(inner.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [pageId, missing, vw]);

  /* ------------------------------------------------ page data + load actions */
  useEffect(() => {
    if (!page?.recordCollectionId) {
      store.setState({ pageRecord: null, pageRecordState: "idle" });
      return;
    }
    if (!recordId) {
      store.setState({ pageRecord: null, pageRecordState: "missing" });
      return;
    }
    let alive = true;
    if (!store.getState().pageRecord) store.setState({ pageRecordState: "loading" });
    api
      .query({ collectionId: page.recordCollectionId, ids: [recordId], pageSize: 1 })
      .then((r) => alive && store.setState({ pageRecord: r.records[0] ?? null, pageRecordState: r.records[0] ? "ready" : "missing" }))
      .catch(() => alive && store.setState({ pageRecord: null, pageRecordState: "error" }));
    return () => {
      alive = false;
    };
  }, [store, api, page?.id, page?.recordCollectionId, recordId, dataVersion]);

  const gate = !page ? null : page.access === "users" && !user ? "signin" : page.access === "admins" && !user?.isAdmin ? (user ? "forbidden" : "signin") : null;

  useEffect(() => {
    if (!page || gate || missing || (page.recordCollectionId && recordState !== "ready") || !page.onLoad?.length) return;
    void runActions(page.onLoad, { store, api, scope: null, formId: null });
  }, [store, api, page?.id, recordId, recordState, gate, missing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!page) return;
    document.title = missing ? `Page not found · ${appName}` : page.id === doc.homePageId && !page.title ? appName : `${page.title || page.name} · ${appName}`;
  }, [page, missing, appName, doc.homePageId]);

  useEffect(() => {
    if (mode !== "live") return;
    try {
      const k = `cb-visit:${appId}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      /* ignore */
    }
    void api.visit().catch(() => undefined);
  }, [mode, appId, api]);

  const bg = page ? (fillToCss(page.background, theme) ?? theme.colors.background) : theme.colors.background;
  const bodyFont = fontStack("$body", theme);
  const signInHref = typeof window !== "undefined" ? signInUrl(appId) : "/auth";

  let body: React.ReactNode;
  if (missing) body = <Notice theme={theme} icon="Compass" title="This page isn't here" text="The link may be wrong, or the page was removed." action={{ label: "Go to the home page", onClick: () => store.getState().navigate(doc.homePageId, null) }} />;
  else if (gate === "signin")
    body = session.signedInElsewhere ? (
      <Notice theme={theme} icon="LockKeyhole" title={`Continue to ${appName}?`} text={`You're signed in to ${BRAND.name}. To open this page, let ${appName} see your name and email.`} action={{ label: "Continue", href: signInHref }} />
    ) : (
      <Notice theme={theme} icon="LockKeyhole" title="Please sign in" text={`Sign in with your ${BRAND.name} account to see this page.`} action={{ label: "Sign in", href: signInHref }} />
    );
  else if (gate === "forbidden") body = <Notice theme={theme} icon="ShieldAlert" title="Admins only" text="This page is only available to the app's admins." action={{ label: "Go to the home page", onClick: () => store.getState().navigate(doc.homePageId, null) }} />;
  else if (page?.confirmationVariable && !confirmation)
    body = <Notice theme={theme} icon="Receipt" title="No order confirmed" text="This page needs the reference from a successful order. Opening this link does not place an order." action={{ label: "Go to the home page", onClick: () => store.getState().navigate(doc.homePageId, null) }} />;
  else if (page?.recordCollectionId && (!recordId || recordState === "missing"))
    body = <Notice theme={theme} icon="Search" title="This item isn't available" text="It may have been removed, or the link is incomplete." action={{ label: "Go to the home page", onClick: () => store.getState().navigate(doc.homePageId, null) }} />;
  else if (page?.recordCollectionId && recordState === "error")
    body = <Notice theme={theme} icon="CircleAlert" title="Couldn't load this item" text="Check your connection and try again." action={{ label: "Try again", onClick: () => store.setState((s) => ({ dataVersion: s.dataVersion + 1, pageRecordState: "loading" })) }} />;
  else if (page?.recordCollectionId && recordState !== "ready")
    body = <Notice theme={theme} icon="Loader" title="Loading item…" text="Please wait while we fetch the details." />;
  else body = <PageFrame />;

  const columnW = frameW * scale;
  return (
    <RuntimeContext.Provider value={store}>
      <PinLayerContext.Provider value={pins}>
        <div
          ref={rootRef}
          className={`rt-root ${shell ? "rt-phone-shell" : ""}`}
          style={{ background: shell ? mix(theme.colors.surface.startsWith("#") ? theme.colors.surface : "#f3f3f7", "#000000", 0.04) : bg, fontFamily: bodyFont, color: theme.colors.text }}
        >
          <div
            className="rt-column"
            style={{ width: columnW, minHeight: shell ? "100vh" : undefined, height: shell ? undefined : innerH * scale || undefined, margin: "0 auto", position: "relative", visibility: vw ? "visible" : "hidden", background: shell ? bg : undefined }}
          >
            <div style={{ height: innerH * scale || undefined, position: "relative" }}>
              <div ref={innerRef} style={{ width: frameW, position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                {body}
              </div>
            </div>
          </div>
          {/* elements that stay on screen while scrolling */}
          <div className="rt-pin-layer top" style={{ width: columnW }}>
            <div ref={setPinTop} style={{ width: frameW, position: "relative", transform: `scale(${scale})`, transformOrigin: "top left" }} />
          </div>
          <div className="rt-pin-layer bottom" style={{ width: columnW }}>
            <div ref={setPinBottom} style={{ width: frameW, position: "relative", transform: `scale(${scale})`, transformOrigin: "bottom left" }} />
          </div>
          <div id="rt-overlay-root" />
        {mode === "live" && !phoneApp && doc.settings.showBadge !== false && (
          <a className="rt-made-with" href={platformUrl("/")} target="_blank" rel="noopener">
            <span className="rt-made-mark">
              <Icon name="Sparkles" size={11} />
            </span>
            Made with {BRAND.name}
          </a>
        )}
        {mode === "live" && (
          <a
            className="rt-report-link"
            href={platformUrl("/report")}
            target="_blank"
            rel="noopener"
            onClick={(e) => {
              // the report form gets this page's address
              e.preventDefault();
              window.open(platformUrl(`/report?app=${encodeURIComponent(window.location.href)}`), "_blank", "noopener");
            }}
          >
            Report
          </a>
        )}
        {mode === "preview" && !editorLink && (
          <span className="rt-preview-chip">
            <Icon name="Eye" size={13} /> Preview
          </span>
        )}
        {mode === "preview" && editorLink && (
          <a className="rt-preview-chip" href={`/editor/${appId}`}>
            <Icon name="Eye" size={13} /> Preview · back to editor
          </a>
        )}
        {mode === "live" && <InstallPrompt appName={appName} phoneApp={phoneApp} basePath={basePath} theme={theme} />}
        </div>
      </PinLayerContext.Provider>
    </RuntimeContext.Provider>
  );
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * Live apps register a small offline helper (service worker). Phone apps also offer to be
 * installed: a real "Install" button where the browser supports it (Android, desktop
 * Chrome/Edge) and "Add to Home Screen" instructions on iPhone.
 */
function InstallPrompt({ appName, phoneApp, basePath, theme }: { appName: string; phoneApp: boolean; basePath: string; theme: AppDoc["theme"] }) {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);
  const key = `cb-install-dismissed:${basePath || "root"}`;

  useEffect(() => {
    // scope = the app's own address (/app/<name> has no trailing slash, so the file allows it)
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: basePath || "/" }).catch(() => undefined);
    if (!phoneApp) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)) {
      setIos(true);
      setOpen(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [phoneApp, basePath, key]);

  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="rt-install" role="dialog" aria-label={`Install ${appName}`} style={{ fontFamily: fontStack("$body", theme) }}>
      <span className="rt-install-icon" style={{ background: theme.colors.primary, color: readableOn(theme.colors.primary) }}>
        <Icon name="Download" size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Install {appName}</strong>
        <small>{ios ? "Tap the Share button, then “Add to Home Screen”." : "Open it from your home screen like any app."}</small>
      </div>
      {!ios && deferred && (
        <button
          className="rt-install-go"
          style={{ background: theme.colors.primary, color: readableOn(theme.colors.primary) }}
          onClick={async () => {
            await deferred.prompt().catch(() => undefined);
            dismiss();
          }}
        >
          Install
        </button>
      )}
      <button className="rt-install-x" aria-label="Not now" onClick={dismiss}>
        <Icon name="X" size={16} />
      </button>
    </div>
  );
}

function Notice({
  theme,
  icon,
  title,
  text,
  action,
}: {
  theme: AppDoc["theme"];
  icon: string;
  title: string;
  text: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  const btn = { background: theme.colors.primary, color: readableOn(theme.colors.primary), borderRadius: theme.buttonStyle === "pill" ? 999 : theme.radius };
  return (
    <div className="rt-notice" style={{ minHeight: 640, color: theme.colors.text, fontFamily: fontStack("$body", theme) }}>
      <div className="rt-notice-icon" style={{ background: theme.colors.surface, color: theme.colors.primary }}>
        <Icon name={icon} size={30} />
      </div>
      <h1 style={{ fontFamily: fontStack("$heading", theme) }}>{title}</h1>
      <p style={{ color: theme.colors.muted }}>{text}</p>
      {action &&
        (action.href ? (
          <a className="rt-notice-btn" href={action.href} style={btn}>
            {action.label}
          </a>
        ) : (
          <button type="button" className="rt-notice-btn" onClick={action.onClick} style={btn}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
