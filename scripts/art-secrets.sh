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

encrypt() {
  local args=() plain=() f key
  [[ -f $RECIPIENTS ]] || die "$RECIPIENTS is missing"

  # Read here rather than in a function feeding a pipe or a process
  # substitution: those run in a subshell, where `die` would exit the subshell
  # and leave this one carrying on without any recipients.
  # `|| [[ -n $key ]]` catches a file whose last line has no newline.
  while IFS= read -r key || [[ -n $key ]]; do
    case $key in
      age1*) args+=(-r "$key") ;;
    esac
  done <"$RECIPIENTS"
  [[ ${#args[@]} -gt 0 ]] ||
    die "no age1… recipient in $RECIPIENTS — run 'npm run art:keygen' and add the age1… line it prints"

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

# The public half, taken back off the key rather than asked for: it is derivable,
# so making someone copy it across is a step that exists only to be forgotten.
add_recipient() {
  local recipient
  recipient=$(age-keygen -y "$DEFAULT_IDENTITY")
  if grep -qxF "$recipient" "$RECIPIENTS" 2>/dev/null; then
    echo "$RECIPIENTS already lists this key"
    return
  fi
  # A file that does not end in a newline would otherwise take the key onto the
  # end of its last comment, where nothing will ever read it.
  if [[ -s $RECIPIENTS ]] && [[ -n $(tail -c1 "$RECIPIENTS") ]]; then
    printf '\n' >>"$RECIPIENTS"
  fi
  printf '%s\n' "$recipient" >>"$RECIPIENTS"
  echo "added $recipient to $RECIPIENTS"
}

keygen() {
  if [[ -f $DEFAULT_IDENTITY ]]; then
    # Never replaced: every committed .age file is encrypted to it. Re-running
    # is how you repair a recipients file, so this is a note rather than an error.
    echo "keeping the key already at $DEFAULT_IDENTITY"
  else
    mkdir -p "$(dirname "$DEFAULT_IDENTITY")"
    chmod 700 "$(dirname "$DEFAULT_IDENTITY")"
    age-keygen -o "$DEFAULT_IDENTITY"
    chmod 600 "$DEFAULT_IDENTITY"
  fi

  add_recipient
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
