import { describe, expect, it } from "vitest";
import { CHROME_CSS, OWNED_META, SHARED_HEAD_TAGS } from "./sharedHead";

// The real pages, and the config that lists them, read as text: what this file
// checks is what shipped, not a second description of it.
const pages = import.meta.glob("../*.html", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;
const config = Object.values(
  import.meta.glob("../vite.config.ts", { query: "?raw", import: "default", eager: true }),
).join("") as string;

const named = (name: string): Record<string, unknown> | undefined =>
  SHARED_HEAD_TAGS.find((t) => t.attrs?.name === name)?.attrs;

describe("SHARED_HEAD_TAGS", () => {
  it("opts every page into the display cutout", () => {
    expect(named("viewport")?.content).toContain("viewport-fit=cover");
  });

  it("declares the page a web app, in both spellings", () => {
    // The `apple-` one is what an iPhone reads when the game is added to the
    // Home Screen, which is the only way it loses the tab bar.
    expect(named("mobile-web-app-capable")?.content).toBe("yes");
    expect(named("apple-mobile-web-app-capable")?.content).toBe("yes");
  });

  it("links the shared chrome", () => {
    expect(SHARED_HEAD_TAGS.some((t) => t.tag === "link" && t.attrs?.href === CHROME_CSS)).toBe(true);
  });

  it("prepends everything, so a page's own <style> still wins a tie", () => {
    for (const tag of SHARED_HEAD_TAGS) expect(tag.injectTo).toBe("head-prepend");
  });
});

describe("pages", () => {
  it("finds some to check", () => {
    expect(Object.keys(pages).length).toBeGreaterThan(0);
  });

  it("leave the shared metas to the plugin", () => {
    // A page keeping its own copy would win on document order and quietly undo
    // the shared one — viewport-fit with it.
    for (const [path, html] of Object.entries(pages)) {
      for (const name of OWNED_META) expect(html, path).not.toContain(`name="${name}"`);
    }
  });

  it("are each a Rollup input, so the injection reaches them", () => {
    // The hook runs per input; a page missing from the config is built by
    // nothing and served with no shared head at all.
    for (const path of Object.keys(pages)) {
      expect(config, path).toContain(`"${path.replace("../", "")}"`);
    }
  });
});
