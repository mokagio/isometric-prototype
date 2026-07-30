// The <head> every page shares, injected at build instead of copied into each
// HTML file: a new page then picks it up by being a Rollup input and nothing
// else. `sharedHead.test.ts` pins that no page has drifted back to its own copy.
//
// The stylesheet is linked here rather than imported from an entry module
// because `credits.html` has no script to import it from.

import type { HtmlTagDescriptor, Plugin } from "vite";

/** The shared stylesheet, as the injected <link> asks for it. */
export const CHROME_CSS = "/src/chrome.css";

/** Metas a page must not also declare, since two of them is one too many. */
export const OWNED_META = ["viewport", "mobile-web-app-capable", "apple-mobile-web-app-capable"];

const meta = (name: string, content: string): HtmlTagDescriptor => ({
  tag: "meta",
  attrs: { name, content },
  injectTo: "head-prepend",
});

export const SHARED_HEAD_TAGS: HtmlTagDescriptor[] = [
  { tag: "meta", attrs: { charset: "UTF-8" }, injectTo: "head-prepend" },
  // viewport-fit=cover is what lets the layout reach into the notch and the
  // home-indicator strip; `chrome.css` gives that space back to the overlays
  // through the --ww-inset-* vars.
  meta(
    "viewport",
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
  ),
  // Added to the Home Screen, the page then opens with no address or tab bar,
  // which is the only way an iPhone gives a web game the whole screen: Safari
  // still won't grant Fullscreen API on a canvas there (it does on iPad).
  meta("mobile-web-app-capable", "yes"),
  meta("apple-mobile-web-app-capable", "yes"),
  // Translucent, so standalone matches viewport-fit=cover: content under the
  // status bar, insets keeping the chrome clear of it.
  meta("apple-mobile-web-app-status-bar-style", "black-translucent"),
  meta("apple-mobile-web-app-title", "Games Playground"),
  meta("theme-color", "#1b2b1a"),
  { tag: "link", attrs: { rel: "stylesheet", href: CHROME_CSS }, injectTo: "head-prepend" },
];

export function sharedHead(): Plugin {
  return {
    name: "ww-shared-head",
    transformIndexHtml: {
      // `pre`, so the injected <link> is still a path Vite's own HTML pass
      // resolves and hashes rather than a dead href in the built page.
      order: "pre",
      handler: () => SHARED_HEAD_TAGS,
    },
  };
}
