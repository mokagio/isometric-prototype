import { buy, PIECE_NAMES, PRICES, SLOTS, type Armor, type Slot } from "./armor";
import { MAX_HP } from "./hero";

export const HEART_HP = 10;

export interface Hud {
  setHealth(hp: number): void;
  setCoins(coins: number): void;
  setBoss(name: string | null, share: number): void;
  banner(title: string, sub?: string, seconds?: number): void;
  /** Opens the counter; the function it hands back redraws it after a sale. */
  openShop(coins: number, armor: Armor, onBuy: (slot: Slot) => void, onClose: () => void): (coins: number, armor: Armor) => void;
  shopOpen(): boolean;
  /** Light the slots the hero is wearing. */
  setArmor(armor: Armor): void;
  /** Point the compass: `heading` is where the camera looks, and each mark a yaw on the ground. */
  setCompass(heading: number, marks: Array<{ id: string; label: string; yaw: number }> | null): void;
}

/** Where a mark sits across the compass strip, 0..1, or null when it is behind you. */
export function compassAt(heading: number, yaw: number, fov = Math.PI * 0.9): number | null {
  let d = yaw - heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  // Yaw grows to the left of the view (right of a +z heading is -x), so flip it for the screen.
  const x = 0.5 - d / fov;
  return x < 0 || x > 1 ? null : x;
}

/** How full each heart is, from a health total: 1 whole, 0 empty, anything between. */
export function heartFills(hp: number, max = MAX_HP): number[] {
  const out: number[] = [];
  for (let i = 0; i < max / HEART_HP; i++) out.push(Math.max(0, Math.min(1, (hp - i * HEART_HP) / HEART_HP)));
  return out;
}

const HEART_PATH = "M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 5.5 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z";

export function createHud(): Hud {
  const corner = div("gd-corner");
  const hearts = div("gd-hearts");
  const purse = div("gd-purse");
  purse.innerHTML = `<span class="gd-coin"></span><b>0</b>`;
  const coinCount = purse.querySelector("b")!;
  const kit = div("gd-kit");
  const pips = new Map<Slot, HTMLElement>();
  for (const slot of SLOTS) {
    const pip = pieceIcon(slot);
    pip.classList.add("gd-pip");
    pip.title = PIECE_NAMES[slot];
    pips.set(slot, pip);
    kit.appendChild(pip);
  }
  corner.append(hearts, purse, kit);

  const compass = div("gd-compass");
  compass.innerHTML = `<div class="gd-compass-strip"></div>`;
  const strip = compass.querySelector<HTMLElement>(".gd-compass-strip")!;
  const marks = new Map<string, HTMLElement>();
  for (const [label, offset] of [
    ["N", Math.PI],
    ["E", Math.PI / 2],
    ["S", 0],
    ["W", -Math.PI / 2],
  ] as const) {
    const t = div("gd-compass-tick");
    t.textContent = label;
    t.dataset.yaw = String(offset);
    strip.appendChild(t);
  }

  const fills: HTMLElement[] = [];
  for (let i = 0; i < MAX_HP / HEART_HP; i++) {
    const h = div("gd-heart");
    h.innerHTML = `<svg viewBox="0 0 24 24"><path d="${HEART_PATH}" class="gd-heart-empty"/></svg>
      <span class="gd-heart-fill"><svg viewBox="0 0 24 24"><path d="${HEART_PATH}"/></svg></span>`;
    fills.push(h.querySelector<HTMLElement>(".gd-heart-fill")!);
    hearts.appendChild(h);
  }

  const boss = div("gd-boss");
  boss.innerHTML = `<div class="gd-boss-name"></div><div class="gd-boss-bar"><div></div></div>`;
  boss.hidden = true;
  const bossName = boss.querySelector<HTMLElement>(".gd-boss-name")!;
  const bossFill = boss.querySelector<HTMLElement>(".gd-boss-bar div")!;

  const bannerEl = div("gd-banner");
  bannerEl.innerHTML = `<h2></h2><p></p>`;
  const bannerTitle = bannerEl.querySelector("h2")!;
  const bannerSub = bannerEl.querySelector("p")!;
  let bannerTimer = 0;

  const shop = div("gd-shop");
  shop.hidden = true;

  document.body.append(corner, compass, boss, bannerEl, shop);

  let lastHp = -1;
  return {
    setHealth(hp) {
      if (hp === lastHp) return;
      lastHp = hp;
      heartFills(hp).forEach((f, i) => (fills[i]!.style.width = `${f * 100}%`));
    },
    setCoins(coins) {
      coinCount.textContent = String(coins);
    },
    setBoss(name, share) {
      boss.hidden = name === null;
      if (name !== null) {
        bossName.textContent = name;
        bossFill.style.width = `${Math.max(0, share) * 100}%`;
      }
    },
    banner(title, sub = "", seconds = 2.6) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub;
      bannerEl.classList.remove("is-on");
      // Restart the fade-in even if the same banner is already up.
      void bannerEl.offsetWidth;
      bannerEl.classList.add("is-on");
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => bannerEl.classList.remove("is-on"), seconds * 1000);
    },
    openShop(coins, armor, onBuy, onClose) {
      const render = (purseNow: number, kit: Armor): void => {
        shop.innerHTML = "";
        const card = div("gd-shop-card");
        const head = div("gd-shop-head");
        head.innerHTML = `<h2>Blacksmith</h2><div class="gd-purse"><span class="gd-coin"></span><b>${purseNow}</b></div>`;
        card.appendChild(head);
        const lede = document.createElement("p");
        lede.className = "gd-shop-lede";
        lede.textContent = "Bronze armor. Each piece makes you tougher.";
        card.appendChild(lede);
        for (const slot of SLOTS) {
          const row = div("gd-shop-row");
          const name = document.createElement("span");
          name.className = "gd-shop-name";
          name.textContent = PIECE_NAMES[slot];
          const b = document.createElement("button");
          b.type = "button";
          b.className = "gd-shop-buy";
          const worn = kit[slot];
          if (worn !== "none") {
            b.textContent = worn === "bronze" ? "Wearing" : "Ares's";
            b.disabled = true;
          } else {
            b.innerHTML = `<span class="gd-coin"></span>${PRICES[slot]}`;
            const sale = buy(slot, purseNow, kit);
            b.disabled = !sale.ok;
            b.addEventListener("click", () => onBuy(slot));
          }
          row.append(pieceIcon(slot), name, b);
          card.appendChild(row);
        }
        const close = document.createElement("button");
        close.type = "button";
        close.className = "gd-shop-close";
        close.textContent = "Back to the road";
        close.addEventListener("click", () => {
          shop.hidden = true;
          onClose();
        });
        card.appendChild(close);
        shop.appendChild(card);
      };
      render(coins, armor);
      shop.hidden = false;
      return render;
    },
    shopOpen: () => !shop.hidden,
    setArmor(armor) {
      for (const [slot, pip] of pips) pip.dataset.kit = armor[slot];
    },
    setCompass(heading, list) {
      compass.hidden = list === null;
      if (list === null) return;
      for (const t of strip.querySelectorAll<HTMLElement>(".gd-compass-tick")) {
        const x = compassAt(heading, Number(t.dataset.yaw));
        t.hidden = x === null;
        if (x !== null) t.style.left = `${x * 100}%`;
      }
      for (const el of marks.values()) el.hidden = true;
      for (const m of list) {
        let el = marks.get(m.id);
        if (!el) {
          el = div("gd-compass-mark");
          el.dataset.id = m.id;
          el.innerHTML = `<span></span><b></b>`;
          el.querySelector("b")!.textContent = m.label;
          strip.appendChild(el);
          marks.set(m.id, el);
        }
        const x = compassAt(heading, m.yaw);
        el.hidden = x === null;
        if (x !== null) el.style.left = `${x * 100}%`;
      }
    },
  };
}

function div(className: string): HTMLElement {
  const d = document.createElement("div");
  d.className = className;
  return d;
}

function pieceIcon(slot: Slot): HTMLElement {
  const icon = div("gd-piece");
  const paths: Record<Slot, string> = {
    helmet: `<path d="M6 22 C6 10 26 10 26 22 L22 22 L22 26 L18 26 L18 20 L14 20 L14 26 L10 26 L10 22 Z" /><rect x="14" y="4" width="4" height="8" class="gd-crest"/>`,
    chest: `<path d="M8 6 L13 8 L16 10 L19 8 L24 6 L26 14 L23 16 L23 27 L9 27 L9 16 L6 14 Z"/>`,
    arms: `<rect x="7" y="9" width="8" height="15" rx="2"/><rect x="17" y="9" width="8" height="15" rx="2"/>`,
    legs: `<path d="M8 5 L14 5 L14 25 L10 27 L8 25 Z"/><path d="M18 5 L24 5 L24 25 L22 27 L18 25 Z"/>`,
  };
  icon.innerHTML = `<svg viewBox="0 0 32 32">${paths[slot]}</svg>`;
  return icon;
}
