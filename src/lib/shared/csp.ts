/** Next reads this request policy and adds the nonce to its hydration scripts. */
export function contentSecurityPolicy(nonce: string, development = false) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:", "media-src 'self' blob: https:",
    "frame-src 'self' https:", `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "worker-src 'self'", "manifest-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
  ].join("; ");
}
