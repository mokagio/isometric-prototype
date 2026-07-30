// The Fullscreen API is a bonus here, not the plan: Safari on iPhone still
// won't grant it on an ordinary element, which is why the Home Screen metas in
// `sharedHead.ts` are what actually clears the tab bar on a phone. iPad,
// Android and desktop do grant it, so the menu offers it where it exists and
// says nothing where it doesn't.

// Structural, so the tests can hand in a plain object instead of a document.
export interface FullscreenDoc {
  fullscreenElement: Element | null;
  exitFullscreen?: () => Promise<void>;
  documentElement: { requestFullscreen?: () => Promise<void> };
}

export function fullscreenSupported(doc: FullscreenDoc): boolean {
  return typeof doc.documentElement.requestFullscreen === "function";
}

export function fullscreenActive(doc: FullscreenDoc): boolean {
  return doc.fullscreenElement != null;
}

export function fullscreenLabel(active: boolean): string {
  return active ? "Leave Fullscreen" : "Fullscreen";
}

/** Whole document, not the canvas, so the stick and menu come along. */
export function toggleFullscreen(doc: FullscreenDoc): void {
  const done = fullscreenActive(doc)
    ? doc.exitFullscreen?.()
    : doc.documentElement.requestFullscreen?.();
  // A browser may refuse — Safari rejects when it decides the tap didn't count
  // as a gesture. Nothing to recover: the menu item stays as it was.
  void done?.catch(() => {});
}
