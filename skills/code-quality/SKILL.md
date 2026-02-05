---
name: code-quality
description: Enhances code generation with TypeScript best practices, proper documentation, and robust error handling
version: 1.0.0
---

# Code Quality Skill

## When to Use This Skill

Use this skill when generating TypeScript code that needs to be production-ready, well-documented, and handle edge cases properly.

## Guidelines

When generating TypeScript code, always follow these best practices:

### 1. Type Safety

- Use explicit return types on all functions
- Avoid `any` type - use `unknown` if the type is truly unknown
- Use strict TypeScript configuration
- Prefer `const` assertions for literal types

### 2. Documentation

- Add JSDoc comments to all exported functions
- Include `@param` tags for each parameter with descriptions
- Include `@returns` tag describing the return value
- Add `@example` showing typical usage

### 3. Error Handling

- Validate inputs at function boundaries
- Handle edge cases explicitly (null, undefined, NaN, Infinity)
- Use descriptive error messages
- Consider using Result types for operations that can fail

### 4. Code Style

- Use meaningful variable and function names
- Keep functions small and focused (single responsibility)
- Prefer pure functions when possible
- Use early returns to reduce nesting

## Example Implementation

When asked to create a function, structure it like this:

```typescript
/**
 * Calculates the area of a rectangle.
 *
 * @param width - The width of the rectangle
 * @param height - The height of the rectangle
 * @returns The area of the rectangle
 * @throws {TypeError} If either argument is not a finite number
 * @throws {RangeError} If either dimension is negative
 *
 * @example
 * ```ts
 * calculateArea(5, 3); // returns 15
 * calculateArea(2.5, 4); // returns 10
 * ```
 */
export function calculateArea(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new TypeError('Both arguments must be finite numbers');
  }
  if (width < 0 || height < 0) {
    throw new RangeError('Dimensions cannot be negative');
  }
  return width * height;
}
```

## Definition of Done

Code generated with this skill should:

1. Compile without errors under `strict: true`
2. Have JSDoc documentation on all exports
3. Handle edge cases appropriately
4. Follow consistent formatting
5. Be readable and maintainable
