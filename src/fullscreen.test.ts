import { describe, expect, it, vi } from "vitest";
import {
  type FullscreenDoc,
  fullscreenActive,
  fullscreenLabel,
  fullscreenSupported,
  toggleFullscreen,
} from "./fullscreen";

const fakeDoc = (over: Partial<FullscreenDoc> = {}): FullscreenDoc => ({
  fullscreenElement: null,
  exitFullscreen: vi.fn(() => Promise.resolve()),
  documentElement: { requestFullscreen: vi.fn(() => Promise.resolve()) },
  ...over,
});

describe("fullscreenSupported", () => {
  it("is false where the element has no requestFullscreen", () => {
    // Safari on iPhone, which is the case the menu item hides for.
    expect(fullscreenSupported(fakeDoc({ documentElement: {} }))).toBe(false);
  });

  it("is true where it does", () => {
    expect(fullscreenSupported(fakeDoc())).toBe(true);
  });
});

describe("toggleFullscreen", () => {
  it("requests fullscreen when not in it", () => {
    const doc = fakeDoc();
    toggleFullscreen(doc);
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalled();
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
  });

  it("exits when already in it", () => {
    const doc = fakeDoc({ fullscreenElement: {} as Element });
    toggleFullscreen(doc);
    expect(doc.exitFullscreen).toHaveBeenCalled();
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });

  it("swallows a refused request", async () => {
    const doc = fakeDoc({
      documentElement: { requestFullscreen: () => Promise.reject(new Error("denied")) },
    });
    expect(() => toggleFullscreen(doc)).not.toThrow();
    // Let the rejection settle: an unhandled one would fail the run.
    await Promise.resolve();
  });

  it("does nothing where the API is missing", () => {
    expect(() => toggleFullscreen(fakeDoc({ documentElement: {} }))).not.toThrow();
  });
});

describe("fullscreenLabel", () => {
  it("names the action, not the state", () => {
    expect(fullscreenLabel(false)).toBe("Fullscreen");
    expect(fullscreenLabel(true)).toBe("Leave Fullscreen");
  });
});

describe("fullscreenActive", () => {
  it("follows the element", () => {
    expect(fullscreenActive(fakeDoc())).toBe(false);
    expect(fullscreenActive(fakeDoc({ fullscreenElement: {} as Element }))).toBe(true);
  });
});
