#!/usr/bin/env bun
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

const appDir = path.resolve(process.cwd());
const repoRoot = path.resolve(appDir, "../..");
const lockPath = path.join(appDir, ".next", "lock");

if (!existsSync(lockPath)) {
  console.log("[e2e] No Next build lock found.");
  process.exit(0);
}

const processTable = readProcessTable();
if (!processTable.ok) {
  refuseToRemoveLock([
    `[e2e] Could not inspect the process table: ${processTable.error}`,
  ]);
}

const processes = processTable.processes;
const ancestors = collectAncestors(processes);
const activeBuilds = [];
const cwdInspectionFailures = [];

for (const proc of processes) {
  if (proc.pid === process.pid || ancestors.has(proc.pid)) continue;
  const buildKind = classifyBuildCommand(proc.command);
  if (!buildKind) continue;

  const cwd = readProcessCwd(proc.pid);
  if (!cwd.ok) {
    if (buildKind === "direct-next") {
      cwdInspectionFailures.push({ proc, error: cwd.error });
    }
    continue;
  }

  if (isWithin(cwd.path, repoRoot) || isWithin(cwd.path, appDir)) {
    activeBuilds.push(proc);
  }
}

const lockOwnership = readOpenFileOwners(lockPath);
const lockOwners = lockOwnership.owners.filter(
  (pid) => pid !== process.pid && !ancestors.has(pid),
);

if (
  cwdInspectionFailures.length > 0 ||
  !lockOwnership.ok ||
  activeBuilds.length > 0 ||
  lockOwners.length > 0
) {
  const details = [];

  if (cwdInspectionFailures.length > 0) {
    details.push("[e2e] Could not inspect cwd for Next build process(es):");
    for (const failure of cwdInspectionFailures) {
      details.push(
        `  pid ${failure.proc.pid}: ${failure.error}; command: ${failure.proc.command}`,
      );
    }
  }

  if (activeBuilds.length > 0) {
    details.push("[e2e] Active Next build process detected:");
    for (const proc of activeBuilds) {
      details.push(`  pid ${proc.pid}: ${proc.command}`);
    }
  }

  if (lockOwners.length > 0) {
    details.push(
      `[e2e] Lock file is currently open by pid(s): ${lockOwners.join(", ")}`,
    );
  }

  if (!lockOwnership.ok) {
    details.push(
      `[e2e] Could not inspect lock ownership: ${lockOwnership.error}`,
    );
  }

  refuseToRemoveLock(details);
}

await rm(lockPath, { force: true });
console.log("[e2e] Removed stale Next build lock at apps/web/.next/lock.");

function readProcessTable() {
  try {
    const output = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
      encoding: "utf8",
    });

    const processes = output
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (!match) return undefined;

        return {
          pid: Number(match[1]),
          ppid: Number(match[2]),
          command: match[3],
        };
      })
      .filter(Boolean);

    return { ok: true, processes };
  } catch (error) {
    return { ok: false, error: formatError(error), processes: [] };
  }
}

function collectAncestors(processes) {
  const parentByPid = new Map(processes.map((proc) => [proc.pid, proc.ppid]));
  const ancestors = new Set();
  let parent = process.ppid;

  while (parent && !ancestors.has(parent)) {
    ancestors.add(parent);
    parent = parentByPid.get(parent);
  }

  return ancestors;
}

function classifyBuildCommand(command) {
  const normalized = command.replace(/\s+/g, " ");
  if (normalized.includes("prepare-e2e-build.mjs")) return false;
  if (normalized.includes("playwright")) return false;

  const directNextBuild =
    /(?:^|\s)(?:node|bun)?\s*(?:\S+[/\\])?next(?:\.js)?\s+build(?:\s|$)/.test(
      normalized,
    ) ||
    /next[/\\]dist[/\\]bin[/\\]next\b.*\bbuild\b/.test(normalized) ||
    /node_modules[/\\]\.bin[/\\]next\b.*\bbuild\b/.test(normalized);
  if (directNextBuild) return "direct-next";

  const packageBuild =
    /\bbun\b.*\brun\b.*\bbuild\b/.test(normalized) ||
    /\b(?:npm|pnpm|yarn)\b.*\brun\b.*\bbuild\b/.test(normalized);
  return packageBuild ? "package-build" : false;
}

function readProcessCwd(pid) {
  if (process.platform === "linux") {
    try {
      return { ok: true, path: readlinkSync(`/proc/${pid}/cwd`) };
    } catch (error) {
      return { ok: false, error: formatError(error) };
    }
  }

  try {
    const output = execFileSync(
      "lsof",
      ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const cwdLine = output.split("\n").find((line) => line.startsWith("n"));
    const cwd = cwdLine?.slice(1);
    if (!cwd) {
      return { ok: false, error: "lsof returned no cwd path" };
    }

    return { ok: true, path: cwd };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

function readOpenFileOwners(filePath) {
  const result = spawnSync("lsof", ["-nP", "-t", filePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    return {
      ok: false,
      error: formatError(result.error),
      owners: [],
    };
  }

  const owners = (result.stdout ?? "")
    .trim()
    .split("\n")
    .map((pid) => Number(pid))
    .filter((pid) => Number.isInteger(pid) && pid > 0);

  if (owners.length > 0) {
    return { ok: true, owners };
  }

  const stderr = result.stderr.trim();
  if (result.status === 0 || (result.status === 1 && stderr.length === 0)) {
    return { ok: true, owners: [] };
  }

  return {
    ok: false,
    error:
      stderr ||
      `lsof exited with status ${result.status ?? "unknown"} while inspecting lock ownership`,
    owners: [],
  };
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function refuseToRemoveLock(details) {
  console.error("[e2e] Refusing to remove apps/web/.next/lock.");
  for (const detail of details) {
    console.error(detail);
  }
  process.exit(1);
}

function formatError(error) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error);
}
