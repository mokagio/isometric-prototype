import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// `art-secrets.sh` is the only thing standing between the paid pack and a
// public tree, and its interesting behaviour is all in the paths that refuse to
// run. Those are what shipped broken: an `encrypt` with no recipient printed
// its complaint from inside a process substitution, so the exit never reached
// the shell and /bin/bash (3.2, where an empty array is an unbound variable)
// fell over one line later.
//
// The script is run for real rather than reimplemented, against a copy of the
// repo in a tmpdir so nothing here can touch the working tree or a real key.

const REPO = join(import.meta.dirname, "..");
const KEY_RE = /AGE-SECRET-KEY-1[A-Z0-9]+/;

let sandbox: string;

/**
 * Run the script in the sandbox. `spawnSync` rather than `execFileSync`: both
 * streams are wanted whether or not it succeeded, and age-keygen announces the
 * public key on stderr even when all is well.
 */
function run(
  args: string[],
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("./scripts/art-secrets.sh", args, {
    cwd: sandbox,
    encoding: "utf8",
    // HOME is where the default identity path hangs off, so the sandbox owns it
    // too — otherwise a key on this machine would decide the result.
    env: { PATH: process.env.PATH ?? "", HOME: sandbox, ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const ART = "public/oboro/mage";
const SHEETS = ["attack.png", "death.png", "idle.png", "walk.png"];

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "art-secrets-"));
  mkdirSync(join(sandbox, "scripts"), { recursive: true });
  cpSync(join(REPO, "scripts/art-secrets.sh"), join(sandbox, "scripts/art-secrets.sh"));
  chmodSync(join(sandbox, "scripts/art-secrets.sh"), 0o755);
  mkdirSync(join(sandbox, ART), { recursive: true });
  for (const [i, sheet] of SHEETS.entries()) {
    writeFileSync(join(sandbox, ART, sheet), `not really a png ${i}`);
  }
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

describe("art-secrets refusals", () => {
  it("names a subcommand it does not have", () => {
    expect(run(["frobnicate"]).status).toBe(1);
    expect(run([]).stderr).toContain("usage:");
  });

  it("stops when there is no key to encrypt to", () => {
    // Once printed its complaint from a subshell and carried on regardless,
    // reaching `age` with no recipient at all.
    const { status, stderr } = run(["encrypt"]);
    expect(status).toBe(1);
    expect(stderr).toContain("art:keygen");
    expect(stderr).not.toMatch(/unbound variable|line \d+/);
  });

  it("stops when there is nothing to decrypt", () => {
    const { status, stderr } = run(["decrypt"], { AGE_KEY: "AGE-SECRET-KEY-1PRETEND" });
    expect(status).toBe(1);
    expect(stderr).toContain("nothing to decrypt");
  });

  it("says where it looked for a key, so a fresh clone knows what to run", () => {
    writeFileSync(join(sandbox, ART, "idle.png.age"), "ciphertext");
    const { status, stderr } = run(["decrypt"]);
    expect(status).toBe(1);
    expect(stderr).toContain(".age/isometric-prototype.txt");
    expect(stderr).toContain("art:keygen");
  });
});

// `age` is not a dependency of this repo and CI does not install it for tests,
// so the half that needs the binary says so rather than failing.
const hasAge = (): boolean => {
  try {
    execFileSync("age", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

describe.runIf(hasAge())("art-secrets round trip", () => {
  const IDENTITY = ".age/isometric-prototype.txt";

  const keygen = (): void => {
    const { status, stderr } = run(["keygen"]);
    expect(status, stderr).toBe(0);
  };

  it("leaves nothing to do between making a key and using it", () => {
    keygen();
    expect(run(["encrypt"]).status).toBe(0);
  });

  it("encrypts to the recipient and decrypts back to the same bytes", () => {
    keygen();
    expect(run(["encrypt"]).status).toBe(0);

    const before = SHEETS.map((s) => readFileSync(join(sandbox, ART, s), "utf8"));
    for (const s of SHEETS) rmSync(join(sandbox, ART, s));

    // No AGE_IDENTITY_FILE and no AGE_KEY: the default path is the whole point,
    // since a fresh clone has no way to be told one.
    expect(run(["decrypt"]).status).toBe(0);
    expect(SHEETS.map((s) => readFileSync(join(sandbox, ART, s), "utf8"))).toEqual(before);
  });

  it("takes the key as material, which is the only shape CI can pass", () => {
    keygen();
    run(["encrypt"]);
    const identity = readFileSync(join(sandbox, IDENTITY), "utf8");
    for (const s of SHEETS) rmSync(join(sandbox, ART, s));
    rmSync(join(sandbox, ".age"), { recursive: true });

    expect(run(["decrypt"], { AGE_KEY: KEY_RE.exec(identity)![0] }).status).toBe(0);
  });

  it("will not replace a key the committed ciphertext is encrypted to", () => {
    keygen();
    const identity = readFileSync(join(sandbox, IDENTITY), "utf8");
    run(["keygen"]);
    expect(readFileSync(join(sandbox, IDENTITY), "utf8")).toBe(identity);
  });
});
