import { readFileSync } from "fs";
import { test, expect } from "vitest";

const content = readFileSync("src/App.tsx", "utf-8");

test("imports Form from @base-ui/react/form", () => {
  expect(content).toMatch(
    /import\s+.*Form.*from\s+['"]@base-ui\/react\/form['"]/,
  );
});

test("imports Field from @base-ui/react/field", () => {
  expect(content).toMatch(
    /import\s+.*Field.*from\s+['"]@base-ui\/react\/field['"]/,
  );
});

test("uses Form component", () => {
  expect(content).toMatch(/<Form/);
});

test("uses Field.Root with name='email'", () => {
  expect(content).toMatch(/<Field\.Root\s+name=["']email["']/);
});

test("uses Field.Control with type='email'", () => {
  expect(content).toMatch(/<Field\.Control[^>]*type=["']email["']/);
});

test("uses Field.Control with required prop", () => {
  expect(content).toMatch(/<Field\.Control[^>]*required/);
});

test("uses Field.Error with match='valueMissing'", () => {
  expect(content).toMatch(
    /<Field\.Error[^>]*match=["']valueMissing["']/,
  );
});

test("uses Field.Error with match='typeMismatch' or match='patternMismatch'", () => {
  expect(
    content.match(/<Field\.Error[^>]*match=["'](typeMismatch|patternMismatch)["']/),
  ).toBeTruthy();
});

test("has custom error message for required field", () => {
  expect(content).toContain("Email is required");
});

test("has custom error message for email format", () => {
  expect(content).toContain("Please enter a valid email address");
});

test("does not use Field.Error without match prop", () => {
  // Find all Field.Error opening tags and ensure each has a match prop
  const fieldErrorMatches = content.match(/<Field\.Error[^>]*>/g);
  if (fieldErrorMatches) {
    fieldErrorMatches.forEach((tag) => {
      expect(tag).toMatch(/match=/);
    });
  }
});
