// Serialized into the page (via addInitScript for every navigation + a one-off evaluate for the
// current document): a capture-phase guard that cancels clicks on anchors whose href hands off to
// an external app (mailto:, tel:, sms:, webcal:, zoommtg:, custom deep-links). This complements the
// extraction-side filter (which never offers such links as clickables) for cases where the click
// lands on a wrapper or the href is added dynamically, so the OS never launches another process
// mid-exploration. No imports or closures over Node variables: everything it needs lives here.
export function blockExternalProtocols(opts: { allowedSchemes: string[] }): void {
  const marker = '__rapidorProtocolGuard';
  // idempotent: evaluate + addInitScript may both run against the same window
  if ((window as unknown as Record<string, boolean>)[marker]) return;
  (window as unknown as Record<string, boolean>)[marker] = true;

  const allowed = new Set(opts.allowedSchemes.map((s) => s.toLowerCase()));
  const isBlocked = (href: string | null): boolean => {
    if (!href) return false;
    const m = /^\s*([a-z][a-z0-9+.-]*):/i.exec(href);   // scheme, or null for relative/#/?/path links
    return m ? !allowed.has(m[1].toLowerCase()) : false;
  };

  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    // preventDefault is what cancels the browser's default handoff of the URL to the OS; we leave
    // site handlers to run (a legit SPA may react to the same click) rather than swallow the event.
    if (anchor && isBlocked(anchor.getAttribute('href'))) e.preventDefault();
  }, true);
}
