#!/bin/sh
# Starts the NEXUS Data MCP server with Node 18 or newer.
# Claude started from the Dock or Start menu often lacks the shell's PATH, so look
# for node in the usual install folders, then ask the login shell, before giving up.

SERVER="$(dirname "$0")/index.mjs"

usable() {
  [ -x "$1" ] && "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' 2>/dev/null
}

try() {
  for n in "$@"; do
    if usable "$n"; then exec "$n" "$SERVER"; fi
  done
}

# 1. Whatever is on PATH already.
try "$(command -v node 2>/dev/null)"

# 2. Installer, Homebrew, Volta, asdf, fnm, mise, Linux packages.
try /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.volta/bin/node" "$HOME/.asdf/shims/node" \
  "$HOME/.local/share/fnm/aliases/default/bin/node" "$HOME/.local/share/mise/shims/node" \
  "$HOME/.local/bin/node" /usr/bin/node

# 3. nvm: the default alias first, then any installed version, newest name first.
if [ -d "$HOME/.nvm/versions/node" ]; then
  default=$(cat "$HOME/.nvm/alias/default" 2>/dev/null)
  try "$HOME/.nvm/versions/node/v${default#v}/bin/node"
  for d in $(ls -r "$HOME/.nvm/versions/node" 2>/dev/null); do try "$HOME/.nvm/versions/node/$d/bin/node"; done
fi

# 4. Ask the user's login shell, which loads their profile.
found=$("${SHELL:-/bin/zsh}" -lic 'command -v node' </dev/null 2>/dev/null | tail -n 1)
try "$found"

echo "nexus-data: Node.js 18 or newer was not found. Install the LTS version from https://nodejs.org and restart Claude." >&2
exit 1
