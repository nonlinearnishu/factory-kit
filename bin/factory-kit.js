#!/usr/bin/env node
// Install factory-kit into ~/.claude/ via per-file symlinks.
//
// Behaviour mirrors install.sh: idempotent, refreshes symlinks pointing back
// into this kit, skips existing non-symlinked files with a warning.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_ROOT = path.join(os.homedir(), ".claude");

const SUBDIRS = ["skills", "agents", "commands"];
const TOP_LEVEL_FILES = ["CLAUDE.md"];

function readVersion() {
  try {
    return fs.readFileSync(path.join(KIT_ROOT, "VERSION"), "utf8").trim();
  } catch {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(KIT_ROOT, "package.json"), "utf8")
      );
      return pkg.version ?? "unknown";
    } catch {
      return "unknown";
    }
  }
}

function readCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: KIT_ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "no-git";
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function linkOne(srcAbs, dstAbs, label) {
  let stat;
  try {
    stat = fs.lstatSync(dstAbs);
  } catch {
    stat = null;
  }

  if (stat && stat.isSymbolicLink()) {
    const current = fs.readlinkSync(dstAbs);
    if (current === srcAbs) {
      console.log(`  ok     ${label} (already linked)`);
      return { ok: true, action: "ok" };
    }
    fs.unlinkSync(dstAbs);
    fs.symlinkSync(srcAbs, dstAbs);
    console.log(`  relink ${label} (was -> ${current})`);
    return { ok: true, action: "relink" };
  }

  if (stat) {
    console.log(`  skip   ${label} (file exists at destination, not a symlink)`);
    return { ok: false, action: "skip" };
  }

  fs.symlinkSync(srcAbs, dstAbs);
  console.log(`  link   ${label}`);
  return { ok: true, action: "link" };
}

function linkSubdir(subdir, counters) {
  const srcDir = path.join(KIT_ROOT, subdir);
  const dstDir = path.join(CLAUDE_ROOT, subdir);

  let entries;
  try {
    entries = fs.readdirSync(srcDir);
  } catch {
    console.log(`[${subdir}] (none)`);
    return;
  }

  ensureDir(dstDir);

  console.log(`[${subdir}]`);
  const mdEntries = entries.filter((name) => name.endsWith(".md"));
  for (const name of mdEntries) {
    const srcAbs = path.join(srcDir, name);
    const dstAbs = path.join(dstDir, name);
    const result = linkOne(srcAbs, dstAbs, `${subdir}/${name}`);
    counters[result.action] = (counters[result.action] ?? 0) + 1;
    if (subdir === "skills") counters.skills += result.ok ? 1 : 0;
    if (subdir === "agents") counters.agents += result.ok ? 1 : 0;
    if (subdir === "commands") counters.commands += result.ok ? 1 : 0;
  }
  console.log("");
}

function linkTopLevel(name, counters) {
  const srcAbs = path.join(KIT_ROOT, name);
  const dstAbs = path.join(CLAUDE_ROOT, name);
  if (!fs.existsSync(srcAbs)) {
    console.log(`  miss   ${name} (not in kit)`);
    return;
  }
  console.log(`[${name}]`);
  const result = linkOne(srcAbs, dstAbs, name);
  counters[result.action] = (counters[result.action] ?? 0) + 1;
  console.log("");
}

function main() {
  ensureDir(CLAUDE_ROOT);

  const version = readVersion();
  const commit = readCommit();
  console.log(`Installing factory-kit v${version} (${commit}) from ${KIT_ROOT}`);
  console.log(`Target: ${CLAUDE_ROOT}\n`);

  const counters = { skills: 0, agents: 0, commands: 0 };

  for (const subdir of SUBDIRS) {
    linkSubdir(subdir, counters);
  }

  for (const name of TOP_LEVEL_FILES) {
    linkTopLevel(name, counters);
  }

  console.log(`Done. ${counters.skills} skill(s), ${counters.agents} subagent(s), ${counters.commands} command(s) installed.`);
  console.log("Restart Claude Code to pick up the new skills.");
}

try {
  main();
} catch (err) {
  console.error(`factory-kit install failed: ${err.message ?? err}`);
  process.exit(1);
}
