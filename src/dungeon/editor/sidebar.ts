import { backLinks, toolRow } from "../../editorUi";

/** Digging shapes the dungeon; tiles rule on what its walls are built from. */
export type Mode = "dig" | "tiles";

export type Tool = "dig" | "fill";

export interface EditorState {
  mode: Mode;
  tool: Tool;
  /** Cells either side of the cursor the brush covers, so its width is 2n+1. */
  brush: number;
}

export const BRUSHES = [0, 1, 2, 4] as const;

export interface SidebarActions {
  onChange: () => void;
  onMode: (mode: Mode) => void;
  onClear: () => void;
  onPlay: () => void;
  onDiscard: () => void;
}

/** The way out, and the choice of what the sidebar below is for. */
export function buildTop(root: HTMLElement, state: EditorState, onMode: (mode: Mode) => void): void {
  backLinks(root, [
    ["dungeon.html", "← Dungeon"],
    ["index.html", "← All Games"],
  ]);

  toolRow(root, [
    { id: "dig", label: "Dig", active: state.mode === "dig", onClick: () => onMode("dig") },
    { id: "tiles", label: "Tiles", active: state.mode === "tiles", onClick: () => onMode("tiles") },
  ]);
}

export function heading(root: HTMLElement, text: string): void {
  const h = document.createElement("div");
  h.className = "ed-heading";
  h.textContent = text;
  root.appendChild(h);
}

/** The floor brush: the whole of what the builder was before there were tiles. */
export function buildDigSidebar(
  root: HTMLElement,
  state: EditorState,
  actions: SidebarActions,
): void {
  root.innerHTML = "";
  buildTop(root, state, actions.onMode);

  heading(root, "Tool");
  const tools = document.createElement("div");
  tools.className = "ed-row";
  const digBtn = document.createElement("button");
  digBtn.className = "ed-btn";
  digBtn.textContent = "Dig";
  const fillBtn = document.createElement("button");
  fillBtn.className = "ed-btn";
  fillBtn.textContent = "Fill";
  const syncTool = (): void => {
    digBtn.classList.toggle("active", state.tool === "dig");
    fillBtn.classList.toggle("active", state.tool === "fill");
  };
  const setTool = (tool: Tool) => () => {
    state.tool = tool;
    syncTool();
    actions.onChange();
  };
  digBtn.addEventListener("click", setTool("dig"));
  fillBtn.addEventListener("click", setTool("fill"));
  tools.append(digBtn, fillBtn);
  root.appendChild(tools);
  syncTool();

  heading(root, "Brush");
  const brushes = document.createElement("div");
  brushes.className = "ed-row";
  const brushBtns = BRUSHES.map((half) => {
    const b = document.createElement("button");
    b.className = "ed-btn";
    b.textContent = String(half * 2 + 1);
    b.addEventListener("click", () => {
      state.brush = half;
      brushBtns.forEach((el, i) => el.classList.toggle("active", BRUSHES[i] === half));
      actions.onChange();
    });
    brushes.appendChild(b);
    return b;
  });
  brushBtns[BRUSHES.indexOf(state.brush as (typeof BRUSHES)[number])]?.classList.add("active");
  root.appendChild(brushes);

  heading(root, "Dungeon");
  const wide = (label: string, onClick: () => void, className = "ed-btn ed-wide"): void => {
    const b = document.createElement("button");
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", onClick);
    root.appendChild(b);
  };
  wide("Play This Dungeon", actions.onPlay, "ed-btn ed-wide ed-primary");
  wide("Clear", actions.onClear);
  wide("Start Over", actions.onDiscard);

  const hint = document.createElement("div");
  hint.className = "ed-hint";
  hint.textContent = "Drag to dig out rooms and corridors. Right-click fills back in.";
  root.appendChild(hint);
}
