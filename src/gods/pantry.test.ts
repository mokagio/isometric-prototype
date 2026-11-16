import { describe, expect, it } from "vitest";
import { addSnack, MAX_EACH, SNACK_INFO, useSnack, type Pantry } from "./pantry";

describe("the pantry", () => {
  it("heals by what is eaten, one at a time", () => {
    const p: Pantry = {};
    addSnack(p, "bread");
    expect(useSnack(p, "bread", 40, 100)).toBe(40 + SNACK_INFO.bread.heal);
    expect(useSnack(p, "bread", 40, 100)).toBeNull();
  });

  it("keeps food for later when health is already full", () => {
    const p: Pantry = { potion: 1 };
    expect(useSnack(p, "potion", 100, 100)).toBeNull();
    expect(p.potion).toBe(1);
  });

  it("carries only so many of each", () => {
    const p: Pantry = { fish: MAX_EACH };
    expect(addSnack(p, "fish")).toBe(false);
    expect(addSnack(p, "cake")).toBe(true);
  });
});
