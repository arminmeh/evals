import { test, expect, describe } from "vitest";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

const MATH_FILE_PATH = "./math.ts";

describe("generate-add-function eval", () => {
  test("math.ts file exists", () => {
    expect(existsSync(MATH_FILE_PATH)).toBe(true);
  });

  test("file exports add function", async () => {
    const content = await readFile(MATH_FILE_PATH, "utf-8");
    expect(content).toMatch(/export\s+(const|function)\s+add/);
  });

  test("add function has correct signature", async () => {
    const content = await readFile(MATH_FILE_PATH, "utf-8");
    // Should have two number parameters
    expect(content).toMatch(/add\s*\([^)]*:\s*number[^)]*:\s*number[^)]*\)/);
  });

  test("file includes JSDoc comments", async () => {
    const content = await readFile(MATH_FILE_PATH, "utf-8");
    expect(content).toMatch(/@param/);
    expect(content).toMatch(/@returns/);
  });
});
