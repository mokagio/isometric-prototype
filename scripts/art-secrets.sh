#!/usr/bin/env bash

set -euo pipefail

# The one paid asset pack in the tree travels as ciphertext, since the repo is
# public. Both directions live here rather than the decrypt half being inlined
# in the deploy workflow, so the two cannot drift apart.
#
#   keygen   — once per machine. Won't overwrite a key that already exists.
#   encrypt  — after changing a sheet. Needs age-recipients.txt.
#   decrypt  — after a fresh clone, and in CI. Needs a secret key, from
#              AGE_IDENTITY_FILE (a path), AGE_KEY (the key itself), or the
#              default path below.
#
# Reached through `npm run art:*`, which is where the rest of this repo's
# commands live.

cd "$(dirname "$0")/.."

ART_DIR=public/oboro/mage
RECIPIENTS=age-recipients.txt
# age has no default key location and never goes looking, so this is the
# project's own pick rather than a convention. Having one is what keeps a fresh
# clone from needing an env var it has no way to know about.
DEFAULT_IDENTITY=${AGE_IDENTITY_FILE:-$HOME/.age/isometric-prototype.txt}

die() {
  echo "art-secrets: $1" >&2
  exit 1
}

# Only the lines that are keys: the file is mostly the comment explaining itself.
recipient_args() {
  local key found=0
  while IFS= read -r key; do
    case $key in
      age1*)
        printf '%s\n' -r "$key"
        found=1
        ;;
    esac
  done <"$RECIPIENTS"
  [[ $found -eq 1 ]] || die "no age1… recipient in $RECIPIENTS — run age-keygen and add its public line"
}

encrypt() {
  local args=() plain=() f
  [[ -f $RECIPIENTS ]] || die "$RECIPIENTS is missing"
  while IFS= read -r a; do args+=("$a"); done < <(recipient_args)

  shopt -s nullglob
  plain=("$ART_DIR"/*.png)
  shopt -u nullglob
  [[ ${#plain[@]} -gt 0 ]] || die "no PNGs in $ART_DIR — nothing to encrypt"

  for f in "${plain[@]}"; do
    age "${args[@]}" -o "$f.age" "$f"
    echo "encrypted $f"
  done
}

# Global, and the trap tolerates it being unset: the trap runs after `decrypt`
# has returned, so a local would be out of scope by the time it fires.
TMP_IDENTITY=
trap 'rm -f "${TMP_IDENTITY:-}"' EXIT

decrypt() {
  local cipher=() f identity
  shopt -s nullglob
  cipher=("$ART_DIR"/*.png.age)
  shopt -u nullglob
  [[ ${#cipher[@]} -gt 0 ]] || die "no .age files in $ART_DIR — nothing to decrypt"

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

  for f in "${cipher[@]}"; do
    age -d -i "$identity" -o "${f%.age}" "$f"
    echo "decrypted ${f%.age}"
  done
}

keygen() {
  # Checked here as well as by age, which refuses to overwrite but says so as an
  # unexpected error with a bug-report URL. Losing this key would leave every
  # committed .age file undecryptable, so the refusal is the point.
  [[ -f $DEFAULT_IDENTITY ]] &&
    die "a key is already at $DEFAULT_IDENTITY — replacing it makes the committed .age files unreadable"

  mkdir -p "$(dirname "$DEFAULT_IDENTITY")"
  chmod 700 "$(dirname "$DEFAULT_IDENTITY")"
  age-keygen -o "$DEFAULT_IDENTITY"
  chmod 600 "$DEFAULT_IDENTITY"
  echo
  echo "Next: put the age1… line above into $RECIPIENTS, then"
  echo "  npm run art:encrypt"
  echo "  gh secret set AGE_KEY < $DEFAULT_IDENTITY"
}

case ${1:-} in
  keygen) keygen ;;
  encrypt) encrypt ;;
  decrypt) decrypt ;;
  *) die "usage: $0 keygen|encrypt|decrypt" ;;
esac
