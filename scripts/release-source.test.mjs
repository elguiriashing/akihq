import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sourceCommit, stampReleaseSource } from "./release-source.mjs";

test("stamp records the clean checkout and rejects dirty or invalid identity", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "akisuite-release-"));
  try {
    const git = (...args) =>
      execFileSync("git", args, { cwd: directory, stdio: "pipe" });
    git("init");
    git("config", "user.name", "Release Test");
    git("config", "user.email", "release@example.invalid");
    writeFileSync(path.join(directory, "source.txt"), "source\n");
    git("add", "source.txt");
    git("commit", "-m", "test source");
    const commit = sourceCommit(directory);
    mkdirSync(path.join(directory, ".open-next/assets"), { recursive: true });
    stampReleaseSource(commit, directory);
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          path.join(directory, ".open-next/assets/release-source.json"),
        ),
      ),
      { sourceCommit: commit },
    );
    assert.throws(() => stampReleaseSource("fake", directory), /Invalid/);
    writeFileSync(path.join(directory, "untracked.txt"), "untracked source\n");
    assert.throws(() => sourceCommit(directory), /untracked source/);
    rmSync(path.join(directory, "untracked.txt"));
    writeFileSync(path.join(directory, "source.txt"), "changed\n");
    assert.throws(() => sourceCommit(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("every master deployment receives exact-source verification", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/booking-live-smoke.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[master\]/);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m);
});
