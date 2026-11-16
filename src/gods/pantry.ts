/**
 * Food and potions the hero carries, shown in the bar along the bottom of the
 * screen. Each heals when used; none is used up when health is already full.
 */
export type Snack = "bread" | "cake" | "fish" | "potion";
export const SNACKS: readonly Snack[] = ["bread", "cake", "fish", "potion"];
export const MAX_EACH = 9;

export const SNACK_INFO: Record<Snack, { name: string; icon: string; heal: number }> = {
  bread: { name: "Bread", icon: "🍞", heal: 30 },
  cake: { name: "Honey cake", icon: "🍯", heal: 100 },
  fish: { name: "Grilled fish", icon: "🐟", heal: 50 },
  potion: { name: "Healing potion", icon: "🧪", heal: 60 },
};

export type Pantry = Partial<Record<Snack, number>>;

export function addSnack(pantry: Pantry, snack: Snack): boolean {
  if ((pantry[snack] ?? 0) >= MAX_EACH) return false;
  pantry[snack] = (pantry[snack] ?? 0) + 1;
  return true;
}

/** Eat or drink one: hands back the health after, or null if there was none or no need. */
export function useSnack(pantry: Pantry, snack: Snack, hp: number, max: number): number | null {
  if ((pantry[snack] ?? 0) <= 0 || hp >= max) return null;
  pantry[snack]! -= 1;
  return Math.min(max, hp + SNACK_INFO[snack].heal);
}
