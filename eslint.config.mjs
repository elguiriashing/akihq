import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // React Compiler is not enabled. Preserve the prior hooks lint contract
  // during this runtime-only upgrade; see docs/NEXT16_RUNTIME_UPGRADE.md.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "**/.wrangler/**",
    ".wrangler-config/**",
    "automation/worker-configuration.d.ts",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
