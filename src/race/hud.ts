import type { Item } from "./items";
import { CARS, carsUnlocked, rung, rungsOpen, type Car } from "./ladder";
import { clock, ordinal } from "./race";
import type { Save } from "./save";
import type { Track } from "./track";

export const ITEM_ICON: Record<Item, string> = { turbo: "⚡", oil: "🛢️", rocket: "🚀" };

export interface Result {
  name: string;
  color: number;
  time: number | null;
  you: boolean;
}

export interface Hud {
  show(on: boolean): void;
  setPlace(place: number, field: number): void;
  setLap(lap: number, laps: number): void;
  setTime(seconds: number): void;
  setItem(item: Item | null, rolling: boolean): void;
  /** Big words mid-screen; a duration of 0 holds them until the next call. */
  banner(text: string, sub?: string, seconds?: number): void;
  setMap(track: Track): void;
  drawMap(dots: Array<{ x: number; z: number; color: number; you: boolean }>): void;
  /** The garage and the ladder: pick a rung and a kart, then `onRace`. */
  garage(save: Save, onRace: (rung: number) => void, onCar: (car: number) => void): void;
  results(rows: Result[], won: boolean, note: string, actions: Array<{ label: string; run: () => void }>): void;
  closePanels(): void;
}

export function createHud(): Hud {
  const top = el("div", "rc-top");
  const place = el("div", "rc-place");
  const lap = el("div", "rc-lap");
  const time = el("div", "rc-time");
  top.append(place, lap, time);
  const itemBox = el("div", "rc-item");
  const banner = el("div", "rc-banner");
  const bannerH = el("h2", "");
  const bannerP = el("p", "");
  banner.append(bannerH, bannerP);
  const map = document.createElement("canvas");
  map.className = "rc-map";
  const MAP = 132;
  map.width = map.height = MAP * 2;
  const mapCtx = map.getContext("2d")!;
  let mapBase: HTMLCanvasElement | null = null;
  let toMap = (x: number, z: number): [number, number] => [x, z];
  const panel = el("div", "rc-panel");
  panel.hidden = true;
  document.body.append(top, itemBox, banner, map, panel);

  let bannerTimer = 0;
  let lastItem = "";

  return {
    show(on) {
      for (const e of [top, itemBox, map]) e.hidden = !on;
    },
    setPlace(p, field) {
      place.innerHTML = `${ordinal(p)}<small>/${field}</small>`;
      place.dataset.place = String(p);
    },
    setLap(l, laps) {
      lap.textContent = `Lap ${l}/${laps}`;
    },
    setTime(s) {
      time.textContent = clock(s);
    },
    setItem(item, rolling) {
      const key = `${item}|${rolling}`;
      if (key === lastItem) return;
      lastItem = key;
      itemBox.textContent = item ? ITEM_ICON[item] : "";
      itemBox.classList.toggle("is-rolling", rolling);
      itemBox.classList.toggle("is-full", item !== null && !rolling);
    },
    banner(text, sub = "", seconds = 1.2) {
      bannerH.textContent = text;
      bannerP.textContent = sub;
      banner.classList.remove("is-on");
      void banner.offsetWidth;
      banner.classList.add("is-on");
      window.clearTimeout(bannerTimer);
      if (seconds > 0) bannerTimer = window.setTimeout(() => banner.classList.remove("is-on"), seconds * 1000);
    },
    setMap(t) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < t.xs.length; i++) {
        minX = Math.min(minX, t.xs[i]!);
        maxX = Math.max(maxX, t.xs[i]!);
        minZ = Math.min(minZ, t.zs[i]!);
        maxZ = Math.max(maxZ, t.zs[i]!);
      }
      const pad = 14;
      const k = (map.width - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
      const ox = (map.width - (maxX - minX) * k) / 2;
      const oz = (map.height - (maxZ - minZ) * k) / 2;
      // From above, turned so +z is up.
      toMap = (x, z) => [map.width - (ox + (x - minX) * k), map.height - (oz + (z - minZ) * k)];
      mapBase = document.createElement("canvas");
      mapBase.width = map.width;
      mapBase.height = map.height;
      const g = mapBase.getContext("2d")!;
      g.lineJoin = "round";
      g.beginPath();
      for (let i = 0; i <= t.xs.length; i++) {
        const [px, pz] = toMap(t.xs[i % t.xs.length]!, t.zs[i % t.xs.length]!);
        if (i === 0) g.moveTo(px, pz);
        else g.lineTo(px, pz);
      }
      g.strokeStyle = "rgba(20, 20, 30, 0.55)";
      g.lineWidth = 16;
      g.stroke();
      g.strokeStyle = "#f4f1e8";
      g.lineWidth = 7;
      g.stroke();
      const [sx, sz] = toMap(t.xs[0]!, t.zs[0]!);
      g.fillStyle = "#1c1c22";
      g.beginPath();
      g.arc(sx, sz, 6, 0, Math.PI * 2);
      g.fill();
    },
    drawMap(dots) {
      mapCtx.clearRect(0, 0, map.width, map.height);
      if (mapBase) mapCtx.drawImage(mapBase, 0, 0);
      for (const d of [...dots].sort((a, b) => Number(a.you) - Number(b.you))) {
        const [px, pz] = toMap(d.x, d.z);
        mapCtx.beginPath();
        mapCtx.arc(px, pz, d.you ? 11 : 8, 0, Math.PI * 2);
        mapCtx.fillStyle = hex(d.color);
        mapCtx.fill();
        mapCtx.lineWidth = d.you ? 4 : 2.5;
        mapCtx.strokeStyle = d.you ? "#fff" : "rgba(20,20,30,0.7)";
        mapCtx.stroke();
      }
    },
    garage(save, onRace, onCar) {
      panel.hidden = false;
      panel.className = "rc-panel rc-garage";
      panel.replaceChildren();
      const card = el("div", "rc-card");
      const h = el("h1", "rc-title");
      h.textContent = "Turbo Karts";
      const lede = el("p", "rc-lede");
      lede.textContent = save.won === 0 ? "Win a race to unlock the next track — and a new kart." : `${save.won} ${save.won === 1 ? "race" : "races"} won. Keep climbing!`;

      const carsH = el("h3", "");
      carsH.textContent = "Your kart";
      const cars = el("div", "rc-cars");
      const open = carsUnlocked(save.won);
      CARS.forEach((car, i) => {
        const b = el("button", "rc-car") as HTMLButtonElement;
        b.type = "button";
        const locked = i >= open;
        b.disabled = locked;
        b.classList.toggle("is-picked", i === save.car);
        b.append(kartIcon(car, locked));
        const name = el("span", "rc-car-name");
        name.textContent = locked ? `Win ${i} ${i === 1 ? "race" : "races"}` : car.name;
        b.append(name);
        if (!locked) b.append(statBars(car));
        b.addEventListener("click", () => {
          onCar(i);
          for (const other of cars.children) other.classList.toggle("is-picked", other === b);
        });
        cars.append(b);
      });

      const trackH = el("h3", "");
      trackH.textContent = "The ladder";
      const ladder = el("ol", "rc-ladder");
      const shown = rungsOpen(save.won);
      // Newest at the top, so the next race to win is the first thing under the thumb.
      for (let i = shown; i >= 0; i--) {
        const r = rung(i);
        const li = el("li", "");
        const b = el("button", "rc-rung") as HTMLButtonElement;
        b.type = "button";
        const locked = i > save.won;
        b.disabled = locked;
        b.classList.toggle("is-next", i === save.won);
        const best = save.best[i] ?? 0;
        b.innerHTML = `<span class="rc-rung-n">${i + 1}</span><span class="rc-rung-name">${r.name}<small>${r.laps} laps${best ? ` · best ${clock(best)}` : ""}</small></span><span class="rc-rung-mark">${locked ? "🔒" : i < save.won ? "🏆" : "▶"}</span>`;
        b.dataset.theme = r.theme;
        b.addEventListener("click", () => onRace(i));
        li.append(b);
        ladder.append(li);
      }
      const left = el("section", "");
      left.append(carsH, cars);
      const right = el("section", "");
      right.append(trackH, ladder);
      const cols = el("div", "rc-cols");
      cols.append(left, right);
      card.append(h, lede, cols);
      panel.append(card);
    },
    results(rows, won, note, actions) {
      panel.hidden = false;
      panel.className = "rc-panel rc-results";
      panel.replaceChildren();
      const card = el("div", "rc-card");
      const h = el("h1", "rc-title");
      h.textContent = won ? "You won!" : "Race over";
      const p = el("p", "rc-lede");
      p.textContent = note;
      const list = el("ol", "rc-standings");
      rows.forEach((r, i) => {
        const li = el("li", r.you ? "is-you" : "");
        li.innerHTML = `<b>${ordinal(i + 1)}</b><span class="rc-dot" style="background:${hex(r.color)}"></span><span>${r.name}</span><i>${r.time === null ? "—" : clock(r.time)}</i>`;
        list.append(li);
      });
      const row = el("div", "rc-actions");
      actions.forEach((a, i) => {
        const b = el("button", i === 0 ? "rc-go" : "rc-go rc-go-quiet") as HTMLButtonElement;
        b.type = "button";
        b.textContent = a.label;
        b.addEventListener("click", a.run);
        row.append(b);
      });
      card.append(h, p, list, row);
      panel.append(card);
    },
    closePanels() {
      panel.hidden = true;
    },
  };
}

function statBars(car: Car): HTMLElement {
  const wrap = el("span", "rc-stats");
  for (const [label, v] of [
    ["Speed", car.stats.top],
    ["Zoom", car.stats.accel],
    ["Grip", car.stats.turn],
  ] as const) {
    const row = el("span", "rc-stat");
    row.innerHTML = `<i>${label}</i><span><span style="width:${Math.round(((v - 0.9) / 0.5) * 100)}%"></span></span>`;
    wrap.append(row);
  }
  return wrap;
}

function kartIcon(car: Car, locked: boolean): SVGElement {
  const c = locked ? "#9a948a" : hex(car.color);
  const wrap = document.createElement("div");
  wrap.innerHTML = `<svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
    <rect x="6" y="26" width="13" height="11" rx="3" fill="#25252b"/><rect x="45" y="26" width="13" height="11" rx="3" fill="#25252b"/>
    <path d="M8 26 L14 16 L40 14 L56 22 L58 30 L6 30 Z" fill="${c}" stroke="#25252b" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="28" cy="10" r="7" fill="${locked ? "#c8c2b8" : "#f4f1e8"}" stroke="#25252b" stroke-width="2.5"/>
    <rect x="22" y="8" width="12" height="4" rx="2" fill="#25252b"/>
  </svg>`;
  return wrap.firstElementChild as SVGElement;
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
