#!/usr/bin/env node
/**
 * Test ↔ feature traceability generator.
 *
 * Scans every *.test.ts under apps/backend/test/ for describe() and
 * it() strings, then emits an MD page mapping each test file to a
 * feature area (Epics + Architecture sections of these docs).
 *
 * The mapping from test file → epic/architecture page is the only
 * hand-curated bit. Everything else is auto-extracted via lightweight
 * regex parsing (no AST library needed — describe()/it() are simple
 * to scrape, and brittleness here is preferable to a heavyweight
 * dep just for docs).
 *
 * Run: node apps/docs/scripts/generateTraceability.mjs
 *      (or: pnpm --filter @finlink/docs regen-traceability)
 *
 * Wired into the docs build via apps/docs/package.json's `build`
 * script so the matrix can never go stale.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..", "..");

const TEST_ROOT = join(repoRoot, "apps", "backend", "test");
const OUT_FILE = join(
  repoRoot,
  "apps",
  "docs",
  "src",
  "content",
  "docs",
  "testing",
  "traceability.md",
);

// File-to-feature mapping. Hand-curated because filename → epic
// isn't always 1:1. Update when you add a new test file.
const FEATURE_BY_FILE = {
  "activity-classifier.test.ts": {
    epic: "Dividend reporting + Options",
    epicSlug: "dividends",
    arch: "Activity classifier",
    archSlug: "architecture/activity-classifier",
  },
  "applications.test.ts": {
    epic: "Auth & sessions",
    epicSlug: "auth",
  },
  "auth.test.ts": {
    epic: "Auth & sessions",
    epicSlug: "auth",
  },
  "csv-detection.test.ts": {
    epic: "CSV import",
    epicSlug: "csv-import",
  },
  "csv-fidelity-positions.test.ts": {
    epic: "CSV import",
    epicSlug: "csv-import",
  },
  "csv-fidelity-activity-replay.test.ts": {
    epic: "CSV import + Dividend reporting",
    epicSlug: "csv-import",
  },
  "csv-import-errors.test.ts": {
    epic: "CSV import",
    epicSlug: "csv-import",
  },
  "helpers.ts": null, // not a test file
  "link-flow.test.ts": {
    epic: "SnapTrade sync",
    epicSlug: "snaptrade-sync",
  },
  "option-lifecycle-replay.test.ts": {
    epic: "Options",
    epicSlug: "options",
  },
  "option-symbol-parser.test.ts": {
    epic: "Options",
    epicSlug: "options",
  },
  "sandbox.test.ts": {
    epic: "Auth & sessions (demo)",
    epicSlug: "auth",
  },
  "setup.ts": null,
  "snaptrade-helpers.test.ts": {
    epic: "SnapTrade sync",
    epicSlug: "snaptrade-sync",
  },
  "tradier-client.test.ts": {
    epic: "Options (Tradier integration)",
    epicSlug: "options",
  },
  "transactions-sync.test.ts": {
    epic: "SnapTrade sync",
    epicSlug: "snaptrade-sync",
  },
};

// Find every .test.ts file (recursive — ignore subdirs that aren't
// tests, but right now everything is flat under test/).
function findTestFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.warn(`[traceability] test dir not found: ${dir}`);
      return out;
    }
    throw err;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...findTestFiles(full));
    } else if (name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

// Pull every describe(...) and it(...) string from a vitest file.
// Tolerates both single and double quotes; doesn't try to parse
// nested describes (we only care about the top-level shape for the
// matrix).
function extractCases(source) {
  const describes = [];
  const its = [];

  // describe("...", ...)  /  describe('...', ...)
  const reDescribe = /\bdescribe\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = reDescribe.exec(source)) !== null) {
    describes.push(m[2]);
  }

  // it("...", ...)  /  it.each([...])("...", ...)
  // Both styles capture the test description as the first quoted arg.
  const reIt = /\b(?:it|test)(?:\.each\s*\([\s\S]*?\))?\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
  while ((m = reIt.exec(source)) !== null) {
    its.push(m[2]);
  }

  return { describes, its };
}

function main() {
  const files = findTestFiles(TEST_ROOT).sort();

  if (files.length === 0) {
    console.warn("[traceability] no test files found; emitting empty matrix");
  }

  const generatedAt = new Date().toISOString();
  const lines = [];
  lines.push("---");
  lines.push("title: Test ↔ feature traceability");
  lines.push("description: Auto-generated matrix mapping every backend test file to the feature it covers.");
  lines.push("sidebar:");
  lines.push("  order: 4");
  lines.push("---");
  lines.push("");
  lines.push(":::caution[Auto-generated]");
  lines.push(`This page is regenerated by \`scripts/generateTraceability.mjs\` on every docs build. Edits made by hand will be overwritten. Last generated: \`${generatedAt}\`.`);
  lines.push(":::");
  lines.push("");
  lines.push(`## Coverage summary`);
  lines.push("");

  let totalCases = 0;
  let totalFiles = 0;
  const rowsForOverview = [];

  for (const file of files) {
    const name = basename(file);
    const mapping = FEATURE_BY_FILE[name];
    if (mapping === null) continue; // helpers / setup / non-test files
    if (mapping === undefined) {
      console.warn(`[traceability] unmapped test file: ${name} — add to FEATURE_BY_FILE in generateTraceability.mjs`);
    }
    totalFiles++;
    const source = readFileSync(file, "utf8");
    const { describes, its } = extractCases(source);
    totalCases += its.length;

    rowsForOverview.push({
      name,
      cases: its.length,
      describes: describes.length,
      epic: mapping?.epic ?? "Unmapped",
      epicSlug: mapping?.epicSlug,
    });
  }

  lines.push(`- **${totalFiles}** test files mapped`);
  lines.push(`- **${totalCases}** \`it()\` cases`);
  lines.push("");
  lines.push("## Files → features");
  lines.push("");
  lines.push("| File | Cases | Feature |");
  lines.push("|---|---:|---|");
  for (const row of rowsForOverview) {
    const epicLink = row.epicSlug ? `[${row.epic}](/epics/${row.epicSlug}/)` : row.epic;
    const fileLink = `[\`${row.name}\`](https://github.com/kazoosa/Beacon/blob/main/apps/backend/test/${row.name})`;
    lines.push(`| ${fileLink} | ${row.cases} | ${epicLink} |`);
  }

  lines.push("");
  lines.push("## Per-file detail");
  lines.push("");

  for (const file of files) {
    const name = basename(file);
    const mapping = FEATURE_BY_FILE[name];
    if (mapping === null) continue;
    const source = readFileSync(file, "utf8");
    const { describes, its } = extractCases(source);

    lines.push(`### \`${name}\``);
    lines.push("");
    if (mapping) {
      const epicLink = mapping.epicSlug ? `[${mapping.epic}](/epics/${mapping.epicSlug}/)` : mapping.epic;
      lines.push(`**Feature**: ${epicLink}`);
      if (mapping.arch) {
        lines.push("");
        lines.push(`**Architecture**: [${mapping.arch}](/${mapping.archSlug}/)`);
      }
      lines.push("");
    } else {
      lines.push("**Feature**: _unmapped — please update `FEATURE_BY_FILE` in `scripts/generateTraceability.mjs`_");
      lines.push("");
    }
    lines.push(`**Counts**: ${describes.length} describe blocks · ${its.length} cases`);
    lines.push("");

    if (describes.length > 0) {
      lines.push("**Describe blocks**:");
      lines.push("");
      for (const d of describes) {
        lines.push(`- ${d}`);
      }
      lines.push("");
    }

    if (its.length > 0) {
      lines.push("<details>");
      lines.push("<summary>Show all cases</summary>");
      lines.push("");
      for (const t of its) {
        lines.push(`- ${t}`);
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  }

  // Ensure the destination directory exists (it does today, but be safe)
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, lines.join("\n"));
  console.log(`[traceability] wrote ${relative(repoRoot, OUT_FILE)}`);
  console.log(`[traceability] ${totalFiles} files, ${totalCases} cases`);
}

main();
