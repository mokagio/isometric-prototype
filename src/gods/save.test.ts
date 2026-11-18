import { describe, expect, it } from "vitest";
import { decodeSave, encodeSave, freshSave } from "./save";

describe("the cartographer's wares in the save", () => {
  it("starts without a compass or a map", () => {
    expect(freshSave()).toMatchObject({ compass: false, map: false });
  });

  it("keeps the compass and the map once bought", () => {
    const save = { ...freshSave(), compass: true, map: true };
    expect(decodeSave(encodeSave(save))).toMatchObject({ compass: true, map: true });
  });

  it("reads a save from before the cartographer as having neither", () => {
    const old = JSON.stringify({ coins: 12, armor: {}, beaten: ["ares"] });
    expect(decodeSave(old)).toMatchObject({ coins: 12, beaten: ["ares"], compass: false, map: false });
  });

  it("does not take anything but true for having one", () => {
    expect(decodeSave(JSON.stringify({ compass: "yes", map: 1 }))).toMatchObject({ compass: false, map: false });
  });
});
