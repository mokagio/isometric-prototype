import { CROPS, type CropId } from "./garden";
import { ITEMS, NAMES, SEED_PRICE, SELL, type ItemId, type Pack } from "./market";

/**
 * The seaside game's buttons and readouts, all DOM over the canvas: the purse,
 * the bag, the seed in hand, the one action button, a little message line, and
 * the market card.
 */
export interface Hud {
  setPack(pack: Pack, seed: CropId | null): void;
  /** What the action button does now, or null to grey it out. */
  setAction(label: string | null): void;
  say(text: string): void;
  openMarket(pack: Pack, onSell: () => void, onBuy: (crop: CropId) => void): (pack: Pack) => void;
  marketOpen(): boolean;
}

const url = (name: string): string => `${import.meta.env.BASE_URL}seaside/${name}`;

/** One 16px cell of a seaside sheet, as a pixel-crisp icon. */
export function icon(sheet: "crops" | "items", col: number, row: number, size = 28): HTMLElement {
  const el = document.createElement("span");
  el.className = "ss-icon";
  const k = size / 16;
  const [w, h] = sheet === "crops" ? [96, 64] : [48, 16];
  el.style.width = el.style.height = `${size}px`;
  el.style.backgroundImage = `url("${url(`${sheet}.png`)}")`;
  el.style.backgroundSize = `${w * k}px ${h * k}px`;
  el.style.backgroundPosition = `${-col * 16 * k}px ${-row * 16 * k}px`;
  return el;
}

/** The icon for a thing carried: a picked vegetable, a fish (tinted by kind), or an egg. */
export function itemIcon(item: ItemId, size = 28): HTMLElement {
  if ((CROPS as readonly string[]).includes(item)) return icon("crops", 5, CROPS.indexOf(item as CropId), size);
  if (item === "egg") return icon("items", 1, 0, size);
  const el = icon("items", 0, 0, size);
  el.style.filter = FISH_TINT[item as keyof typeof FISH_TINT] ?? "";
  return el;
}

/** One fish picture for every kind, told apart by colour. */
export const FISH_TINT = {
  sardine: "saturate(0.3) brightness(1.3)",
  mackerel: "",
  snapper: "hue-rotate(150deg) saturate(1.4)",
  golden: "hue-rotate(200deg) saturate(2) brightness(1.4)",
} as const;

export function createHud(): Hud & { onSeed(f: () => void): void; onAction(f: () => void): void } {
  const top = div("ss-top");
  const purse = div("ss-purse");
  purse.innerHTML = `<span class="ss-coin"></span><b>0</b>`;
  const coins = purse.querySelector("b")!;
  const bag = div("ss-bag");
  top.append(purse, bag);

  const seedBtn = document.createElement("button");
  seedBtn.type = "button";
  seedBtn.className = "ss-seed";
  let onSeed: (() => void) | null = null;
  seedBtn.addEventListener("click", () => onSeed?.());

  const action = document.createElement("button");
  action.type = "button";
  action.className = "ss-action";
  action.disabled = true;
  let onAction: (() => void) | null = null;
  action.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!action.disabled) onAction?.();
  });

  const message = div("ss-message");
  let messageTimer = 0;
  const market = div("ss-market");
  market.hidden = true;

  top.append(seedBtn);
  document.body.append(top, action, message, market);

  const hud: Hud & { onSeed(f: () => void): void; onAction(f: () => void): void } = {
    onSeed(f) {
      onSeed = f;
    },
    onAction(f) {
      onAction = f;
    },
    setPack(pack, seed) {
      coins.textContent = String(pack.coins);
      bag.innerHTML = "";
      for (const item of ITEMS) {
        const n = pack.items[item] ?? 0;
        if (n === 0) continue;
        const slot = div("ss-slot");
        slot.append(itemIcon(item, 24));
        const b = document.createElement("b");
        b.textContent = String(n);
        slot.append(b);
        bag.append(slot);
      }
      seedBtn.innerHTML = "";
      if (seed) {
        seedBtn.append(icon("crops", 0, CROPS.indexOf(seed), 26), icon("crops", 5, CROPS.indexOf(seed), 26));
        const b = document.createElement("b");
        b.textContent = String(pack.seeds[seed] ?? 0);
        seedBtn.append(b);
        seedBtn.title = `${NAMES[seed]} seeds — tap to switch`;
      } else {
        seedBtn.textContent = "No seeds";
      }
    },
    setAction(label) {
      action.disabled = label === null;
      action.textContent = label ?? "·";
    },
    say(text) {
      message.textContent = text;
      message.classList.add("is-on");
      window.clearTimeout(messageTimer);
      messageTimer = window.setTimeout(() => message.classList.remove("is-on"), 2200);
    },
    openMarket(pack, onSell, onBuy) {
      const render = (p: Pack): void => {
        market.innerHTML = "";
        const card = div("ss-card");
        const head = document.createElement("h2");
        head.textContent = "Market";
        card.append(head);
        const worth = ITEMS.reduce((sum, i) => sum + (p.items[i] ?? 0) * SELL[i], 0);
        const sell = document.createElement("button");
        sell.type = "button";
        sell.className = "ss-sell";
        sell.disabled = worth === 0;
        sell.innerHTML = worth === 0 ? "Nothing to sell yet" : `Sell everything for <span class="ss-coin"></span>${worth}`;
        sell.addEventListener("click", onSell);
        card.append(sell);
        const sub = document.createElement("p");
        sub.textContent = "Seeds";
        card.append(sub);
        for (const crop of CROPS) {
          const row = div("ss-row");
          const name = document.createElement("span");
          name.textContent = NAMES[crop];
          const have = document.createElement("small");
          have.textContent = `have ${p.seeds[crop] ?? 0}`;
          const buy = document.createElement("button");
          buy.type = "button";
          buy.innerHTML = `<span class="ss-coin"></span>${SEED_PRICE[crop]}`;
          buy.disabled = p.coins < SEED_PRICE[crop];
          buy.addEventListener("click", () => onBuy(crop));
          row.append(icon("crops", 5, CROPS.indexOf(crop), 28), name, have, buy);
          card.append(row);
        }
        const close = document.createElement("button");
        close.type = "button";
        close.className = "ss-close";
        close.textContent = "Done";
        close.addEventListener("click", () => (market.hidden = true));
        card.append(close);
        market.append(card);
      };
      render(pack);
      market.hidden = false;
      return render;
    },
    marketOpen: () => !market.hidden,
  };
  return hud;
}

export type SeasideHud = ReturnType<typeof createHud>;

function div(className: string): HTMLElement {
  const d = document.createElement("div");
  d.className = className;
  return d;
}
