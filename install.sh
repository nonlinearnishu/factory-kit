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

KIT_VERSION="$( cat "${KIT_ROOT}/VERSION" 2>/dev/null || echo "unknown" )"
KIT_COMMIT="$( git -C "${KIT_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "no-git" )"

echo "Installing factory-kit v${KIT_VERSION} (${KIT_COMMIT}) from ${KIT_ROOT}"
echo "Target: ${CLAUDE_ROOT}"
echo "Tip: 'git checkout v${KIT_VERSION}' before re-running to pin a release; HEAD is the moving edge."
echo

for subdir in skills agents commands; do
  echo "[${subdir}]"
  link_dir "${subdir}"
  echo
done

# Top-level CLAUDE.md — user-level, loaded into every project
echo "[CLAUDE.md]"
link_top_level_file() {
  local name="$1"
  local src="${KIT_ROOT}/${name}"
  local dst="${CLAUDE_ROOT}/${name}"

  if [[ ! -f "${src}" ]]; then
    echo "  miss ${name} (not in kit)"
    return
  fi

  if [[ -L "${dst}" ]]; then
    local current_target
    current_target="$( readlink "${dst}" )"
    if [[ "${current_target}" == "${src}" ]]; then
      echo "  ok   ${name} (already linked)"
      return
    fi
    echo "  relink ${name} (was -> ${current_target})"
    ln -sfn "${src}" "${dst}"
    return
  fi

  if [[ -e "${dst}" ]]; then
    echo "  skip ${name} (file exists at destination, not a symlink)"
    return
  fi

  ln -s "${src}" "${dst}"
  echo "  link ${name}"
}
link_top_level_file "CLAUDE.md"
echo

echo "Done. Run Claude Code from any project — skills auto-load, agents callable via Agent tool."
