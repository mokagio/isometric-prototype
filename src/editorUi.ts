// The furniture every editor's sidebar is made of. The class names live in
// `chrome.css`; this is the other half, so three editors cannot drift into three
// slightly different swatch grids again.
//
// Nothing here knows what is being edited. A swatch is a canvas somebody else
// drew, a tool is a label and a callback.

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** The way back out, stacked: the sidebar is too narrow to hold two side by side. */
export function backLinks(root: HTMLElement, links: [href: string, text: string][]): void {
  const box = el("div", "ed-links");
  for (const [href, text] of links) {
    const a = el("a", "ed-back", text);
    a.href = href;
    box.appendChild(a);
  }
  root.appendChild(box);
}

export function heading(root: HTMLElement, text: string): void {
  root.appendChild(el("div", "ed-heading", text));
}

export function hint(root: HTMLElement, text: string): void {
  root.appendChild(el("div", "ed-hint", text));
}

export interface SwatchGrid<T> {
  /** Show `key` as the one in hand, or nothing if the rubber has been picked up. */
  select(key: string | null): void;
  /** Draw the swatches again, once the sheets they are cut from have loaded. */
  refresh(): void;
  /** Replace what is on offer — a different category, a different group. */
  show(items: T[]): void;
}

export interface SwatchGridSpec<T> {
  /** What tells one swatch from another, and what `select` is given. */
  key(item: T): string;
  label(item: T): string;
  /** The picture of the thing itself, drawn from the sheet it will be drawn from. */
  face(item: T): HTMLCanvasElement;
  onPick(item: T): void;
}

/**
 * A grid of pictures, one of which is in hand. The `.selected` bookkeeping is
 * here rather than in each editor, which is most of what made them differ.
 */
export function swatchGrid<T>(root: HTMLElement, spec: SwatchGridSpec<T>, items: T[] = []): SwatchGrid<T> {
  const grid = el("div", "ed-palette");
  root.appendChild(grid);

  let showing = items;
  let picked: string | null = null;
  const buttons = new Map<string, HTMLButtonElement>();

  const mark = (): void => {
    for (const [key, button] of buttons) button.classList.toggle("selected", key === picked);
  };

  const build = (): void => {
    grid.innerHTML = "";
    buttons.clear();
    for (const item of showing) {
      const key = spec.key(item);
      const b = el("button", "ed-swatch");
      b.title = spec.label(item);
      b.appendChild(spec.face(item));
      b.addEventListener("click", () => {
        picked = key;
        spec.onPick(item);
        mark();
      });
      buttons.set(key, b);
      grid.appendChild(b);
    }
    mark();
  };
  build();

  return {
    select(key) {
      picked = key;
      mark();
    },
    refresh: build,
    show(next) {
      showing = next;
      build();
    },
  };
}

export interface TabRow<K extends string> {
  show(id: K): void;
}

/** A row of category buttons above a swatch grid. */
export function tabRow<K extends string>(
  root: HTMLElement,
  tabs: { id: K; label: string }[],
  onShow: (id: K) => void,
): TabRow<K> {
  const row = el("div", "ed-tabs");
  const buttons = new Map<K, HTMLButtonElement>();
  const show = (id: K): void => {
    for (const [key, button] of buttons) button.classList.toggle("active", key === id);
    onShow(id);
  };
  for (const tab of tabs) {
    const b = el("button", "ed-tab", tab.label);
    b.addEventListener("click", () => show(tab.id));
    buttons.set(tab.id, b);
    row.appendChild(b);
  }
  root.appendChild(row);
  return { show };
}

export interface Tool {
  id: string;
  label: string;
  title?: string;
  onClick: () => void;
  /** Starts lit. A toggle's own state is the caller's; `setActive` shows it. */
  active?: boolean;
}

export interface ToolRow {
  setActive(id: string, on: boolean): void;
  setEnabled(id: string, on: boolean): void;
}

/** A row of square buttons: toggles, steppers, whatever the editor has two of. */
export function toolRow(root: HTMLElement, tools: Tool[]): ToolRow {
  const row = el("div", "ed-tools");
  const buttons = new Map<string, HTMLButtonElement>();
  for (const tool of tools) {
    const b = el("button", "ed-tool", tool.label);
    if (tool.title) b.title = tool.title;
    b.classList.toggle("active", tool.active === true);
    b.addEventListener("click", tool.onClick);
    buttons.set(tool.id, b);
    row.appendChild(b);
  }
  root.appendChild(row);
  return {
    setActive: (id, on) => buttons.get(id)?.classList.toggle("active", on),
    setEnabled: (id, on) => {
      const b = buttons.get(id);
      if (b) b.disabled = !on;
    },
  };
}

export interface Action {
  label: string;
  onClick: () => void;
  /** The one green button: the way out of the editor and into the game. */
  go?: boolean;
}

/** The file buttons, stacked: play, save, open, start again. */
export function actionColumn(root: HTMLElement, actions: Action[]): void {
  const box = el("div", "ed-map");
  for (const action of actions) {
    const b = el("button", action.go ? "ed-action ed-action-go" : "ed-action", action.label);
    b.addEventListener("click", action.onClick);
    box.appendChild(b);
  }
  root.appendChild(box);
}
