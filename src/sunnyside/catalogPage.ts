import { SheetLoader } from "../sprites";
import { createMenu } from "../ui";
import { catalogGroups, footprintLabel, matches, type Group } from "./catalog";
import { drawAsset, swatchExtent, type SheetBook } from "./draw";
import type { Asset } from "./library";
import { SHEETS, sheetUrl, type SheetId } from "./sheets";

// The library, laid out to be looked through rather than painted from. Every
// swatch is drawn by the same code the island is, so this page is also the
// answer to "does everything in the manifest actually draw".

/** Room a swatch is given, in screen pixels. */
const SWATCH_BOX = 76;

function swatch(book: SheetBook, asset: Asset): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const size = swatchExtent(asset);
  // Whole numbers only: a thing scaled by 1.5 has some of its pixels twice the
  // size of the others, which on art this small is all you can see.
  const scale = Math.max(1, Math.floor(SWATCH_BOX / Math.max(size.w, size.h)));
  c.width = size.w * scale;
  c.height = size.h * scale;
  const g = c.getContext("2d");
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  drawAsset(g, book, asset, 0, 0, scale);
  return c;
}

interface Card {
  el: HTMLElement;
  asset: Asset;
  group: Group;
}

function main(): void {
  const root = document.getElementById("catalog") as HTMLElement;
  const tally = document.getElementById("tally") as HTMLElement;
  const search = document.getElementById("search") as HTMLInputElement;

  const ids = Object.keys(SHEETS) as SheetId[];
  const loader = new SheetLoader(ids.length);
  const book: SheetBook = {};
  for (const id of ids) book[id] = loader.load(sheetUrl(id));

  createMenu("Library", {
    onAllGames: () => {
      location.href = "index.html";
    },
  });

  const groups = catalogGroups();
  const cards: Card[] = [];
  const sections = new Map<Group, HTMLElement>();

  for (const group of groups) {
    const section = document.createElement("section");

    const head = document.createElement("div");
    head.className = "lib-head";
    const name = document.createElement("h2");
    name.textContent = group.category.label;
    const rule = document.createElement("span");
    rule.className = "lib-rule";
    const count = document.createElement("span");
    count.className = "lib-count";
    count.textContent = String(group.assets.length);
    head.append(name, rule, count);

    const grid = document.createElement("div");
    grid.className = "lib-grid";
    for (const asset of group.assets) {
      const card = document.createElement("figure");
      card.className = "lib-card";

      const cell = document.createElement("div");
      cell.className = "lib-cell";
      cell.appendChild(swatch(book, asset));
      const size = footprintLabel(asset);
      if (size) {
        const badge = document.createElement("span");
        badge.className = "lib-size";
        badge.textContent = size;
        cell.appendChild(badge);
      }

      const caption = document.createElement("figcaption");
      const label = document.createElement("span");
      label.className = "lib-label";
      label.textContent = asset.label;
      const id = document.createElement("code");
      id.textContent = asset.id;
      caption.append(label, id);

      card.append(cell, caption);
      grid.appendChild(card);
      cards.push({ el: card, asset, group });
    }

    section.append(head, grid);
    sections.set(group, section);
    root.appendChild(section);
  }

  const total = cards.length;
  const showAll = (): void => {
    tally.textContent = `${total} things, in ${groups.length} groups`;
  };

  search.addEventListener("input", () => {
    const query = search.value;
    let shown = 0;
    for (const card of cards) {
      const hit = matches(card.asset, card.group.category, query);
      card.el.hidden = !hit;
      if (hit) shown++;
    }
    // A group with nothing left in it goes too, rather than leaving a bare heading.
    for (const [group, section] of sections) {
      section.hidden = !group.assets.some((asset) => matches(asset, group.category, query));
    }
    if (query.trim() === "") showAll();
    else tally.textContent = shown === 0 ? `nothing called “${query.trim()}”` : `${shown} of ${total} things`;
  });

  showAll();

  // The sheets settle after the page is built, so the swatches are drawn again
  // once they are there — the same wait the editor's palette makes.
  const redraw = (): void => {
    if (!loader.ready) {
      requestAnimationFrame(redraw);
      return;
    }
    for (const card of cards) {
      const cell = card.el.querySelector(".lib-cell");
      cell?.replaceChild(swatch(book, card.asset), cell.firstElementChild!);
    }
  };
  requestAnimationFrame(redraw);
}

main();
