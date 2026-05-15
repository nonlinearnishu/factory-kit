#!/usr/bin/env bash
# Install factory-kit into ~/.claude/ via per-file symlinks.
#
# Safe to re-run. Existing files at destinations are skipped with a warning.
# Symlinks pointing back into this repo are refreshed (relink).

set -euo pipefail

KIT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLAUDE_ROOT="${HOME}/.claude"

link_dir() {
  local subdir="$1"
  local src_dir="${KIT_ROOT}/${subdir}"
  local dst_dir="${CLAUDE_ROOT}/${subdir}"

  mkdir -p "${dst_dir}"

  shopt -s nullglob
  for src in "${src_dir}"/*.md; do
    local name
    name="$( basename "${src}" )"
    local dst="${dst_dir}/${name}"

    if [[ -L "${dst}" ]]; then
      local current_target
      current_target="$( readlink "${dst}" )"
      if [[ "${current_target}" == "${src}" ]]; then
        echo "  ok   ${subdir}/${name} (already linked)"
        continue
      fi
      echo "  relink ${subdir}/${name} (was -> ${current_target})"
      ln -sfn "${src}" "${dst}"
      continue
    fi

    if [[ -e "${dst}" ]]; then
      echo "  skip ${subdir}/${name} (file exists at destination, not a symlink)"
      continue
    fi

    ln -s "${src}" "${dst}"
    echo "  link ${subdir}/${name}"
  done
  shopt -u nullglob
}

echo "Installing factory-kit from ${KIT_ROOT}"
echo "Target: ${CLAUDE_ROOT}"
echo

for subdir in skills agents commands; do
  echo "[${subdir}]"
  link_dir "${subdir}"
  echo
done

echo "Done. Run Claude Code from any project — skills auto-load, agents callable via Agent tool."
