import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

export function sourceCommit(directory = process.cwd()) {
  execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
    cwd: directory,
  });
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: directory, encoding: "utf8" },
  );
  if (untracked.trim()) {
    throw new Error("Commit untracked source before release packaging");
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error(
      "A full Git source commit is required for release evidence",
    );
  }
  return commit;
}

export function stampReleaseSource(commit, directory = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error("Invalid release source commit");
  }
  writeFileSync(
    path.join(directory, ".open-next/assets/release-source.json"),
    JSON.stringify({ sourceCommit: commit }) + "\n",
  );
}
