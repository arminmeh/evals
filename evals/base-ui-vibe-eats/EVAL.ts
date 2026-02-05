import { test, expect, describe } from "vitest";
import { readFileSync } from "fs";

const FILE_PATH = "./src/App.tsx";

function getFileContent(): string {
  return readFileSync(FILE_PATH, "utf-8");
}

describe("base-ui-vibe-eats eval", () => {
  test("all Base UI components are imported from @base-ui/react package", () => {
    const content = getFileContent();

    // Check for any imports from @base-ui-components/* (old/wrong package)
    const wrongImportPattern = /@base-ui-components\//g;
    const wrongImports = content.match(wrongImportPattern);

    expect(
      wrongImports,
      "Found imports from @base-ui-components/* instead of @base-ui/react",
    ).toBeNull();

    // Verify at least one import from @base-ui/react exists
    const baseUiImportPattern = /from\s+['"]@base-ui\/react\//g;
    const correctImports = content.match(baseUiImportPattern);

    expect(
      correctImports && correctImports.length > 0,
      "Expected at least one import from @base-ui/react",
    ).toBe(true);
  });

  test("Form component is being used", () => {
    const content = getFileContent();

    // Check for Form import from @base-ui/react
    const formImportPattern =
      /import\s+.*\bForm\b.*from\s+['"]@base-ui\/react['"]/;
    const hasFormImport = formImportPattern.test(content);

    // Check for Form component usage in JSX
    const formUsagePattern = /<Form[\s.>]/;
    const hasFormUsage = formUsagePattern.test(content);

    expect(
      hasFormImport,
      "Form component should be imported from @base-ui/react",
    ).toBe(true);

    expect(
      hasFormUsage,
      "Form component should be used in the application",
    ).toBe(true);
  });
});
