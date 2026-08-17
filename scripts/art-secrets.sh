#!/usr/bin/env bash

set -euo pipefail

# The one paid asset pack in the tree travels as ciphertext, since the repo is
# public. Both directions live here rather than the decrypt half being inlined
# in the deploy workflow, so the two cannot drift apart.
#
#   encrypt  — after changing a sheet. Needs age-recipients.txt.
#   decrypt  — after a fresh clone, and in CI. Needs a secret key, from
#              AGE_IDENTITY_FILE (a path) or AGE_KEY (the key itself).

cd "$(dirname "$0")/.."

ART_DIR=public/oboro/mage
RECIPIENTS=age-recipients.txt

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

  if [[ -n ${AGE_IDENTITY_FILE:-} ]]; then
    identity=$AGE_IDENTITY_FILE
  elif [[ -n ${AGE_KEY:-} ]]; then
    # A file rather than /dev/stdin: stdin would be consumed by the first sheet
    # and every one after it would fail. Readable only by us, and gone on exit.
    TMP_IDENTITY=$(mktemp)
    chmod 600 "$TMP_IDENTITY"
    printf '%s\n' "$AGE_KEY" >"$TMP_IDENTITY"
    identity=$TMP_IDENTITY
  else
    die "set AGE_IDENTITY_FILE or AGE_KEY"
  fi

  for f in "${cipher[@]}"; do
    age -d -i "$identity" -o "${f%.age}" "$f"
    echo "decrypted ${f%.age}"
  done
}

case ${1:-} in
  encrypt) encrypt ;;
  decrypt) decrypt ;;
  *) die "usage: $0 encrypt|decrypt" ;;
esac
