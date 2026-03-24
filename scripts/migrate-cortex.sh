#!/usr/bin/env bash
# Wrapper to run the migration script against the vault's _Cortex.md.
# Edit VAULT_PATH below before running.

VAULT_PATH="${VAULT_PATH:-/home/arago/vault}"
CORTEX_FILE="$VAULT_PATH/_Cortex.md"

if [ ! -f "$CORTEX_FILE" ]; then
  echo "No _Cortex.md found at $CORTEX_FILE"
  exit 1
fi

echo "Backing up $CORTEX_FILE to ${CORTEX_FILE}.bak"
cp "$CORTEX_FILE" "${CORTEX_FILE}.bak"

npx ts-node "$(dirname "$0")/../migrate-cortex.ts" "$CORTEX_FILE"
