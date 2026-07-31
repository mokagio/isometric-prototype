import { isProp, type Asset, type Category } from "./library";
import { BRUSHES, CATEGORIES, PROPS } from "./manifest";

// What the library page shows: every asset, grouped the way the editor's palette
// groups them, and the search that narrows it. Kept apart from the page itself so
// the grouping and the matching can be tested without a document.

export interface Group {
  category: Category;
  assets: Asset[];
}

/** Every asset by category, in palette order. A category with nothing in it is left out. */
export function catalogGroups(): Group[] {
  const all: Asset[] = [...BRUSHES, ...PROPS];
  return CATEGORIES.map((category) => ({ category, assets: all.filter((a) => a.category === category.id) })).filter(
    (group) => group.assets.length > 0,
  );
}

/** What a search matches on: what a thing is called, what it is called in code, and where it lives. */
export const searchText = (asset: Asset, category: Category): string =>
  `${asset.label} ${asset.id} ${category.label}`.toLowerCase();

/** Whether an asset answers to `query`. An empty query matches everything. */
export function matches(asset: Asset, category: Category, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || searchText(asset, category).includes(q);
}

/** How big a thing is on the ground, for the badge — null for the one-cell ones. */
export function footprintLabel(asset: Asset): string | null {
  if (!isProp(asset)) return null;
  return asset.w > 1 || asset.h > 1 ? `${asset.w}×${asset.h}` : null;
}
