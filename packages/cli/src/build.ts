#!/usr/bin/env bun
// Aeron monorepo build script
import { $ } from "bun";

const PACKAGES = [
  "core",
  "database",
  "cache",
  "auth",
  "events",
  "observability",
  "openapi",
  "testing",
  "ai",
  "cli",
];

const ROOT = new URL("../../..", import.meta.url).pathname;

console.log("Building Aeron packages...\n");

let failed = 0;

for (const pkg of PACKAGES) {
  const pkgDir = `${ROOT}packages/${pkg}`;
  process.stdout.write(`  Building @aeron/${pkg}... `);

  const result = await $`bun build --target=bun --outdir=${pkgDir}/dist ${pkgDir}/src/index.ts`
    .quiet()
    .nothrow();

  if (result.exitCode === 0) {
    console.log("done");
  } else {
    console.log("FAILED");
    console.error(result.stderr.toString());
    failed++;
  }
}

console.log(`\nBuild complete. ${PACKAGES.length - failed}/${PACKAGES.length} packages succeeded.`);

if (failed > 0) {
  process.exit(1);
}
