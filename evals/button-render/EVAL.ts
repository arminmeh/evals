import { readFileSync } from "fs";
import { execSync } from "child_process";
import { test, expect } from "vitest";

const content = readFileSync("src/App.tsx", "utf-8");
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

test("uses named import { Button }", () => {
  expect(content).toMatch(
    /import\s+\{[^{]*Button[^}]*\}\s+from\s+['"]@base-ui\/react\/button['"]/
  );
});

test("does not use @base-ui-components/react", () => {
  expect(content).not.toContain("@base-ui-components/react");
});

test("has @base-ui/react in package.json dependencies", () => {
  expect(pkg.dependencies?.["@base-ui/react"]).toBeDefined();
});
