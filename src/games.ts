export interface GameEntry {
  name: string;
  /** Page to open, relative — the site is served from a subpath in production. */
  href: string;
}

/** The games on the playground, in the order the list shows them. */
export const GAMES: GameEntry[] = [
  { name: "Peaceful Plains", href: "game.html" },
  { name: "Whispering Woods", href: "woods.html" },
];
