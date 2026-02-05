import { readFileSync, existsSync } from "fs";
import { test, expect } from "vitest";

const appContent = readFileSync("src/App.tsx", "utf-8");

test("imports Dialog from @base-ui/react/dialog", () => {
  expect(appContent).toMatch(
    /import\s+.*Dialog.*from\s+['"]@base-ui\/react\/dialog['"]/,
  );
});

test("uses Dialog.Root component", () => {
  expect(appContent).toMatch(/<Dialog\.Root/);
});

test("uses Dialog.Trigger component", () => {
  expect(appContent).toMatch(/<Dialog\.Trigger/);
});

test("uses Dialog.Portal component", () => {
  expect(appContent).toMatch(/<Dialog\.Portal/);
});

test("uses Dialog.Popup component", () => {
  expect(appContent).toMatch(/<Dialog\.Popup/);
});

test("uses Dialog.Title component", () => {
  expect(appContent).toMatch(/<Dialog\.Title/);
});

test("uses Dialog.Description component", () => {
  expect(appContent).toMatch(/<Dialog\.Description/);
});

test("Dialog.Popup has className prop", () => {
  expect(appContent).toMatch(/<Dialog\.Popup[^>]*className/);
});

test("CSS file exists", () => {
  const cssFiles = ["src/App.css", "src/dialog.css", "src/styles.css"];
  const cssFileExists = cssFiles.some((file) => existsSync(file));
  expect(cssFileExists).toBe(true);
});

test("CSS file uses --available-height variable for max-height", () => {
  const cssFiles = ["src/App.css", "src/dialog.css", "src/styles.css"];
  const cssFile = cssFiles.find((file) => existsSync(file));
  
  if (!cssFile) {
    throw new Error("No CSS file found");
  }
  
  const cssContent = readFileSync(cssFile, "utf-8");
  expect(cssContent).toMatch(/max-height\s*:\s*var\(--available-height\)/);
});

