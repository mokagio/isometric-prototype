import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLAY_STASHED_MAP_URL,
  recallMap,
  recallWorldSeed,
  rememberWorldSeed,
  stashMap,
  wantsStashedMap,
} from "./handoff";

/** Just enough of `Storage` to stand in for it, since node has none. */
function fakeStorage(): Storage & { fail: boolean } {
  const map = new Map<string, string>();
  const store = {
    fail: false,
    getItem(key: string): string | null {
      if (store.fail) throw new Error("storage disabled");
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (store.fail) throw new Error("storage disabled");
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
    key: () => null,
    length: 0,
  };
  return store as unknown as Storage & { fail: boolean };
}

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("world seed handoff", () => {
  it("hands a seed from one page to the other", () => {
    rememberWorldSeed(4242);
    expect(recallWorldSeed()).toBe(4242);
  });

  it("reports nothing when no seed has been stashed", () => {
    expect(recallWorldSeed()).toBeNull();
  });

  it("keeps only the newest seed", () => {
    rememberWorldSeed(1);
    rememberWorldSeed(2);
    expect(recallWorldSeed()).toBe(2);
  });

  it("ignores a stored value that is not a seed", () => {
    // Storage is shared with anything else on the origin, and survives a
    // version of the game that wrote something else here.
    for (const junk of ["", "  ", "banana", "1.5", "NaN", "{}"]) {
      storage.setItem("ww:world-seed", junk);
      expect(recallWorldSeed(), junk).toBeNull();
    }
  });

  it("carries on when storage is unavailable", () => {
    // Private browsing throws on both reads and writes.
    storage.fail = true;
    expect(() => rememberWorldSeed(7)).not.toThrow();
    expect(recallWorldSeed()).toBeNull();
  });
});

describe("map handoff", () => {
  const MAP = '{"format":"whispering-woods-map"}';

  it("hands a map from the editor to the game", () => {
    expect(stashMap(MAP)).toBe(true);
    expect(recallMap()).toBe(MAP);
  });

  it("reports nothing when no map has been stashed", () => {
    expect(recallMap()).toBeNull();
  });

  it("leaves the map in place once read, so a reload stays on it", () => {
    stashMap(MAP);
    recallMap();
    expect(recallMap()).toBe(MAP);
  });

  it("says so when storage refuses the map, rather than losing it quietly", () => {
    storage.fail = true;
    expect(stashMap(MAP)).toBe(false);
    expect(recallMap()).toBeNull();
  });

  it("keeps the map and the world seed out of each other's way", () => {
    rememberWorldSeed(99);
    stashMap(MAP);
    expect(recallWorldSeed()).toBe(99);
    expect(recallMap()).toBe(MAP);
  });
});

describe("the play-a-stashed-map request", () => {
  it("is what the editor's play link asks for", () => {
    // The link and the check have to agree, or Play lands on a random world.
    const query = PLAY_STASHED_MAP_URL.slice(PLAY_STASHED_MAP_URL.indexOf("?"));
    expect(wantsStashedMap(query)).toBe(true);
  });

  it("goes to the game page", () => {
    expect(PLAY_STASHED_MAP_URL.startsWith("index.html?")).toBe(true);
  });

  it("is not asked for by an ordinary visit", () => {
    expect(wantsStashedMap("")).toBe(false);
    expect(wantsStashedMap("?")).toBe(false);
    expect(wantsStashedMap("?debug=1")).toBe(false);
    expect(wantsStashedMap("?map=")).toBe(false);
    expect(wantsStashedMap("?map=something-else")).toBe(false);
  });
});
