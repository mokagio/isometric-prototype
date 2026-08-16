// `BASE_URL` (always trailing-slashed) is "/" in dev and "/<repo>/" on the Pages
// build, so a literal "/dungeon/..." would 404 there.
//
// A caller names the whole path under `public/`, rather than the game owning a
// folder there: the playground's `public/` is shared, and this game draws its
// hero out of `rpg_hero/` and `oboro/` alongside the others.
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base}${path}`;
}

export interface Sheet {
  img: HTMLImageElement;
  ok: boolean;
}

/** Start loading a sheet; `settle` fires once, whether it loaded or failed. */
export function loadSheet(src: string, settle: () => void): Sheet {
  const sheet: Sheet = { img: new Image(), ok: false };
  sheet.img.onload = () => {
    sheet.ok = true;
    settle();
  };
  sheet.img.onerror = settle;
  sheet.img.src = src;
  return sheet;
}
