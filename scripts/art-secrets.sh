#!/usr/bin/env bash

set -euo pipefail

# The one paid asset pack in the tree travels as ciphertext, since the repo is
# public. Both directions live here rather than the decrypt half being inlined
# in the deploy workflow, so the two cannot drift apart.
#
#   keygen   — once per machine. Won't overwrite a key that already exists.
#   encrypt  — after changing a sheet.
#   decrypt  — after a fresh clone, and in CI. Needs a secret key, from
#              AGE_IDENTITY_FILE (a path), AGE_KEY (the key itself), or the
#              default path below.
#
# Reached through `npm run art:*`, which is where the rest of this repo's
# commands live.

cd "$(dirname "$0")/.."

# Plaintext where the game loads it from; ciphertext outside `public/`, which
# Vite copies wholesale — the encrypted copy is source, and serving it to
# players alongside the art it hides would be pure weight.
ART_DIR=public/oboro/mage
CIPHER_DIR=art-secrets/oboro/mage
# age has no default key location and never goes looking, so this is the
# project's own pick rather than a convention. Having one is what keeps a fresh
# clone from needing an env var it has no way to know about.
DEFAULT_IDENTITY=${AGE_IDENTITY_FILE:-$HOME/.age/isometric-prototype.txt}

die() {
  echo "art-secrets: $1" >&2
  exit 1
}

encrypt() {
  local plain=() f recipient
  # Taken off the key rather than kept in a file of its own: encrypting needs
  # the identity anyway, so a second copy of its public half would only be
  # something to fall out of step. Add `-r` per key here if a second person
  # ever needs to decrypt.
  [[ -f $DEFAULT_IDENTITY ]] || die "no key at $DEFAULT_IDENTITY — run 'npm run art:keygen'"
  recipient=$(age-keygen -y "$DEFAULT_IDENTITY")

  shopt -s nullglob
  plain=("$ART_DIR"/*.png)
  shopt -u nullglob
  [[ ${#plain[@]} -gt 0 ]] || die "no PNGs in $ART_DIR — nothing to encrypt"

  mkdir -p "$CIPHER_DIR"
  for f in "${plain[@]}"; do
    age -r "$recipient" -o "$CIPHER_DIR/$(basename "$f").age" "$f"
    echo "encrypted $f"
  done
}

# Global, and the trap tolerates it being unset: the trap runs after `decrypt`
# has returned, so a local would be out of scope by the time it fires.
TMP_IDENTITY=
trap 'rm -f "${TMP_IDENTITY:-}"' EXIT

decrypt() {
  local cipher=() f out identity
  shopt -s nullglob
  cipher=("$CIPHER_DIR"/*.png.age)
  shopt -u nullglob
  [[ ${#cipher[@]} -gt 0 ]] || die "nothing encrypted in $CIPHER_DIR — nothing to decrypt"

  # AGE_KEY first: CI sets it, and a developer's own key file sitting at the
  # default path should not quietly win over the key the workflow was handed.
  if [[ -n ${AGE_KEY:-} ]]; then
    # A file rather than /dev/stdin: stdin would be consumed by the first sheet
    # and every one after it would fail. Readable only by us, and gone on exit.
    TMP_IDENTITY=$(mktemp)
    chmod 600 "$TMP_IDENTITY"
    printf '%s\n' "$AGE_KEY" >"$TMP_IDENTITY"
    identity=$TMP_IDENTITY
  elif [[ -f $DEFAULT_IDENTITY ]]; then
    identity=$DEFAULT_IDENTITY
  else
    die "no key: expected $DEFAULT_IDENTITY, or set AGE_KEY. Run 'npm run art:keygen' to make one."
  fi

  mkdir -p "$ART_DIR"
  for f in "${cipher[@]}"; do
    out=$ART_DIR/$(basename "${f%.age}")
    age -d -i "$identity" -o "$out" "$f"
    echo "decrypted $out"
  done
}

keygen() {
  if [[ -f $DEFAULT_IDENTITY ]]; then
    # Never replaced: every committed .age file is encrypted to it.
    echo "keeping the key already at $DEFAULT_IDENTITY"
  else
    mkdir -p "$(dirname "$DEFAULT_IDENTITY")"
    chmod 700 "$(dirname "$DEFAULT_IDENTITY")"
    age-keygen -o "$DEFAULT_IDENTITY"
    chmod 600 "$DEFAULT_IDENTITY"
  fi

  echo
  echo "Next:"
  echo "  npm run art:encrypt"
  echo "  gh secret set AGE_KEY < $DEFAULT_IDENTITY"
}

case ${1:-} in
  keygen) keygen ;;
  encrypt) encrypt ;;
  decrypt) decrypt ;;
  *) die "usage: $0 keygen|encrypt|decrypt" ;;
esac
