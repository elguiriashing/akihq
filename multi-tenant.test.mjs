import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./assets/app-v32.js", import.meta.url), "utf8");

test("loads only database-authorized workspaces and routes", () => {
  assert.match(app, /crm_workspace_members/);
  assert.match(app, /crm_workspace_entitlements/);
  assert.match(app, /function canUseRoute/);
  assert.match(app, /workspace-live-sync:\$\{state\.workspace/);
  assert.match(app, /workspaceRows\.unshift\(platformWorkspace\)/);
  assert.match(app, /sidebar-workspace-switcher/);
  assert.match(app, /availableWorkspaces\.map\(workspace/);
});

test("business teams use tenant roles and the four-seat RPC", () => {
  assert.match(app, /crm_add_workspace_member/);
  assert.match(app, /crm_remove_workspace_member/);
  assert.match(app, /\["Admin", "Manager", "Staff", "Viewer"\]/);
  assert.match(app, /owner plus three team seats/);
});

test("smart inventory is ledger-backed for business workspaces", () => {
  assert.match(app, /crm_inventory_items/);
  assert.match(app, /crm_inventory_movements/);
  assert.match(app, /crm_inventory_recommendations/);
  assert.match(app, /Smart replenishment/);
  assert.match(app, /Stock movement ledger/);
  assert.match(app, /cost_cents,sale_price_cents/);
});

test("point of sale is entitlement-gated and records atomic inventory sales", () => {
  assert.match(app, /pos: "pos"/);
  assert.match(app, /pos: renderPOS/);
  assert.match(app, /crm_record_pos_sale/);
  assert.match(app, /Every completed sale reduces this workspace's inventory immediately/);
  assert.match(app, /p_lines: lines\.map/);
});

test("business dashboard activity and platform metrics stay workspace scoped", () => {
  assert.match(app, /workspaceId: state\.workspace\?\.id/);
  assert.match(app, /activity\.workspaceId === state\.workspace\.id/);
  assert.match(app, /platform && liveStats/);
  assert.match(app, /No workspace activity yet/);
});

test("AkiPasa staff can manage complimentary workspace modules", () => {
  assert.match(app, /crm_staff_business_overview/);
  assert.match(app, /crm_staff_set_workspace_tool/);
  assert.match(app, /workspace\.toolKeys = nextActive/);
  assert.match(app, /Search account, company or workspace ID/);
  assert.match(app, /function formatCount\(value\)/);
  assert.doesNotMatch(app, /renderMetric\("Business accounts", number\(/);
  assert.match(app, /history\.replaceState\(null, "", `\$\{location\.pathname\}\$\{location\.search\}#\/\$\{ui\.route\}`\)/);
  assert.match(app, /data-business-search/);
  assert.match(app, /toggle-business-account/);
  assert.match(app, /const pageSize = 20/);
  assert.match(app, /workspaceSwitchingId = workspace\.id;[\s\S]*activateWorkspace\(workspace\);[\s\S]*render\(\);/);
});
