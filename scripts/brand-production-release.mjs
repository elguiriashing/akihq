import assert from "node:assert/strict";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import ts from "typescript";

const releases = {
  hq: {
    repository: "elguiriashing/akihq",
    branch: "main",
    worker: "akihq-management-preview",
    hostname: "akihq.app",
    sourceName: "akihq-management-preview",
  },
  pasa: {
    repository: "elguiriashing/akipasa",
    branch: "master",
    worker: "akipasa",
    hostname: "akipasa.com",
    sourceName: "akipasa",
  },
};

const selected = process.env.AKISUITE_RELEASE_KIND;
const spec = releases[selected];
const action = process.argv[2];
assert.ok(spec && ["prepare", "config", "verify"].includes(action));
assert.equal(
  process.env.GITHUB_REPOSITORY?.toLowerCase(),
  spec.repository.toLowerCase(),
);
assert.equal(process.env.GITHUB_REF, `refs/heads/${spec.branch}`);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
assert.match(commit, /^[a-f0-9]{40}$/);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
assert.equal(account, "501bc9434d8ae555a6ac984a26dd2725");
const filepath = path.join(
  process.env.RUNNER_TEMP,
  "akisuite-production-vars.json",
);

async function request(pathname) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  assert.ok(token, "Missing scoped CLOUDFLARE_API_TOKEN GitHub secret");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4${pathname}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  assert.ok(response.ok && data.success, "Cloudflare release preflight failed");
  return data.result;
}

const brand =
  selected === "hq"
    ? {
        NEXT_PUBLIC_AKISUITE_ROLE_SWAP: "true",
        NEXT_PUBLIC_PRODUCT_NAME: "AkiHQ",
        NEXT_PUBLIC_SITE_URL: "https://akihq.app",
        NEXT_PUBLIC_BUSINESS_URL: "https://akibusiness.com",
        NEXT_PUBLIC_CRM_URL: "https://akihq.app",
      }
    : {};

if (action === "prepare") {
  const [settings, domains] = await Promise.all([
    request(`/accounts/${account}/workers/scripts/${spec.worker}/settings`),
    request(`/accounts/${account}/workers/domains`),
  ]);
  assert.ok(
    domains.some(
      (d) => d.hostname === spec.hostname && d.service === spec.worker,
    ),
    "Production hostname is not assigned to the expected Worker",
  );
  const bindings = settings.bindings || [];
  const vars = Object.fromEntries(
    bindings
      .filter((b) => b.type === "plain_text")
      .map((b) => [b.name, b.text]),
  );
  assert.ok(
    bindings.some((b) => b.name === "ASSETS" && b.type === "assets"),
    "Expected static assets binding is missing",
  );
  assert.ok(
    bindings.some((b) => b.name === "AKIHQ_GATEWAY" && b.type === "service"),
    "Existing AkiHQ gateway binding is missing",
  );
  assert.ok(
    vars.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://"),
    "Production Supabase URL missing",
  );
  assert.ok(
    vars.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !vars.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith("sb_secret_"),
    "Public Supabase key missing or privileged",
  );
  if (selected === "hq") {
    assert.equal(
      vars.NEXT_PUBLIC_AKISUITE_ROLE_SWAP,
      "true",
      "Refuse to change the role-swap state during branding",
    );
  }
  const merged = { ...vars, ...brand };
  writeFileSync(filepath, JSON.stringify(merged), { mode: 0o600 });
  for (const [name, value] of Object.entries(merged)) {
    if (!name.startsWith("NEXT_PUBLIC_")) continue;
    assert.match(name, /^[A-Z0-9_]+$/);
    assert.ok(typeof value === "string" && !/[\r\n]/.test(value));
    if (name === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
      console.log(`::add-mask::${value}`);
    }
    appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
  }
  console.log(
    `Verified ${spec.hostname} Worker bindings and independent AkiHQ source ${commit}`,
  );
} else if (action === "config") {
  const parsed = ts.parseConfigFileTextToJson(
    "wrangler.jsonc",
    readFileSync("wrangler.jsonc", "utf8"),
  );
  assert.equal(parsed.error, undefined);
  const config = parsed.config;
  assert.equal(config.name, spec.sourceName);
  assert.ok(!config.account_id || config.account_id === account);
  const merged = JSON.parse(readFileSync(filepath, "utf8"));
  config.name = spec.worker;
  config.account_id = account;
  config.vars = { ...config.vars, ...merged };
  config.main = path.resolve(config.main);
  config.assets.directory = path.resolve(config.assets.directory);
  if (selected === "hq") {
    assert.ok(
      !config.routes?.length && !config.route,
      "HQ must retain its existing dashboard-managed domain",
    );
    assert.ok(
      !config.triggers?.crons?.length,
      "HQ must not take over AkiPasa schedules",
    );
  } else {
    assert.ok(
      config.routes?.some((r) => r.pattern === spec.hostname),
      "AkiPasa production route missing",
    );
  }
  const dest = ".wrangler/brand-production.json";
  mkdirSync(".wrangler", { recursive: true });
  writeFileSync(dest, JSON.stringify(config, null, 2));
  const stamp = JSON.parse(
    readFileSync(".open-next/assets/release-source.json", "utf8"),
  );
  assert.equal(stamp.sourceCommit, commit);
  console.log(`Validated brand release config and exact source ${commit}`);
} else {
  const tests =
    selected === "hq"
      ? [
          [
            "/brand/hq-mark.svg",
            (s) => s.includes("#111111") && s.includes("#FFC533"),
          ],
          ["/manifest.webmanifest", (s) => s.includes("hq-v2-512.png")],
          [
            "/brand/hq-v2-512.png",
            (_, r) => r.headers.get("content-type")?.includes("image/png"),
          ],
        ]
      : [
          [
            "/brand/hq-mark.svg",
            (s) => s.includes("#111111") && s.includes("#FFC533"),
          ],
          [
            "/brand/conduzco-icon.svg",
            (s) => s.includes("#FF3047") && s.includes("#111111"),
          ],
        ];
  tests.push([
    "/release-source.json",
    (s) => JSON.parse(s).sourceCommit === commit,
  ]);
  let failures = [];
  for (let attempt = 0; attempt < 15; attempt += 1) {
    failures = [];
    for (const [route, validate] of tests) {
      try {
        const url = `https://${spec.hostname}${route}?release=${commit}`;
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        const body = route.endsWith(".png") ? "" : await response.text();
        if (!response.ok || !validate(body, response)) failures.push(route);
      } catch {
        failures.push(route);
      }
    }
    if (!failures.length) break;
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  assert.deepEqual(failures, [], "Production icon/source verification failed");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Verified ${spec.hostname} at source ${commit} with matching favicon/PWA assets.\n`,
  );
  console.log(`Production brand verified on ${spec.hostname}`);
}
