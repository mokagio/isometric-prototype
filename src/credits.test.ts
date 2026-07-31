import { describe, expect, it } from "vitest";

// The credits page and `CREDITS.md` as text: two lists of the same thing, which
// is exactly the pair that drifts once nobody is looking.
const page = Object.values(
  import.meta.glob("../credits.html", { query: "?raw", import: "default", eager: true }),
).join("") as string;
const doc = Object.values(
  import.meta.glob("../CREDITS.md", { query: "?raw", import: "default", eager: true }),
).join("") as string;
const home = Object.values(
  import.meta.glob("../index.html", { query: "?raw", import: "default", eager: true }),
).join("") as string;

const linked = (html: string): string[] => [...html.matchAll(/<li><a href="(https:[^"]+)"/g)].map((m) => m[1]!);
const listed = (markdown: string): string[] => [...markdown.matchAll(/^- \[[^\]]+]\((https:[^)]+)\)/gm)].map((m) => m[1]!);

describe("credits", () => {
  it("credits somebody", () => {
    expect(linked(page).length).toBeGreaterThan(0);
  });

  it("names the same work the repo's own list does", () => {
    expect(linked(page).sort()).toEqual(listed(doc).sort());
  });

  it("says nothing but the names", () => {
    // Every list item is a link and only a link — whose work it is, not what we
    // did with it.
    for (const item of page.matchAll(/<li>(.*?)<\/li>/g)) {
      expect(item[1]).toMatch(/^<a [^>]+>[^<]+<\/a>$/);
    }
  });

  it("opens every credit off-site, without handing the opener over", () => {
    for (const item of page.matchAll(/<li><a ([^>]+)>/g)) {
      expect(item[1]).toContain('target="_blank"');
      expect(item[1]).toContain('rel="noopener"');
    }
  });

  it("is reached from the games list", () => {
    expect(home).toContain('href="credits.html"');
  });

  it("links between pages relatively, since the site deploys under /<repo>/", () => {
    for (const href of [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)) {
      if (href.startsWith("https:")) continue;
      expect(href, "credits.html").not.toMatch(/^[/]/);
    }
    expect(home).not.toContain('href="/credits.html"');
  });
});
