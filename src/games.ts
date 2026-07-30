export interface GameEntry {
  name: string;
  blurb: string;
  /** Page to open, relative — the site is served from a subpath in production. */
  href: string;
}

/** The games on the playground, in the order the list shows them. */
export const GAMES: GameEntry[] = [
  {
    name: "Peaceful Plains",
    blurb: "Wander a green world, keep clear of the slimes, and wade a river when one gets too close.",
    href: "game.html",
  },
];
