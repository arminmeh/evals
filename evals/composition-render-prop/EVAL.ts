import { readFileSync } from "fs";
import { execSync } from "child_process";
import { test, expect } from "vitest";

const content = readFileSync("src/App.tsx", "utf-8");

test("uses render prop for composition", () => {
  expect(content).toMatch(/render\s*=\s*\{/);
});

test("does not use asChild", () => {
  expect(content).not.toContain("asChild");
});

test("composes Menu.Trigger with MyButton", () => {
  expect(content).toMatch(/Menu\.Trigger/);
  expect(content).toMatch(/MyButton/);
});

test("imports Menu from @base-ui/react", () => {
  expect(content).toMatch(
    /import\s+.*Menu.*from\s+['"]@base-ui\/react\/menu['"]/,
  );
});

test("app builds successfully", () => {
  execSync("npm run build", { stdio: "pipe" });
});
