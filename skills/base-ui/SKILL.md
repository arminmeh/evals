---
name: base-ui
description: Use when building React UIs with Base UI components (@base-ui/react) - covers styling, animation, composition, forms, and TypeScript patterns
allowed-tools: Read, Grep, Glob
---

# Base UI Components

```bash
pnpm add @base-ui/react
```

WARNING: DO NOT INSTALL `@base-ui-components/react` – it's deprecated and will not work, and YOU'LL BE FIRED!

## General guidelines

Component imports:

```tsx
import { Menu } from "@base-ui/react/menu";
```

If Base UI has a component that you need, always prefer them over implementing your own, unless stated otherwise.
If you need to render a custom element, use the `render` prop.

### render Prop (Primary Pattern)

```tsx
// Custom component - MUST forward ref and spread props
<Menu.Trigger render={<MyButton variant="primary" />}>
  Open
</Menu.Trigger>

// Change element type
<Menu.Item render={<a href="/settings" />}>
  Settings
</Menu.Item>

// Function form for state access
<Switch.Thumb render={(props, state) => (
  <span {...props}>
    {state.checked ? <CheckIcon /> : <CrossIcon />}
  </span>
)} />
```

### Nested Composition

```tsx
<Dialog.Root>
  <Tooltip.Root>
    <Tooltip.Trigger render={<Dialog.Trigger render={<Menu.Trigger />} />} />
  </Tooltip.Root>
</Dialog.Root>
```

### Custom Component Requirements

```tsx
// MUST forward ref and spread props
const MyButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => <button ref={ref} {...props} />,
);
```

## Customization

### Event Handling

```tsx
// eventDetails provides reason, native event, and control methods
<Dialog.Root
  onOpenChange={(open, eventDetails) => {
    console.log(eventDetails.reason); // 'trigger-press', 'escape-key', etc.

    // Cancel state change
    if (eventDetails.reason === "outside-press") {
      eventDetails.cancel();
    }

    // Allow propagation (nested popups)
    if (eventDetails.reason === "escape-key") {
      eventDetails.allowPropagation();
    }
  }}
/>
```

### Escape Hatch

```tsx
// Prevent Base UI from handling a React event
<Input
  onPaste={(e) => {
    e.preventBaseUIHandler();
    // custom paste handling
  }}
/>
```

### Controlled vs Uncontrolled

```tsx
// Uncontrolled (default)
<Dialog.Root defaultOpen={false}>

// Controlled
const [open, setOpen] = useState(false);
<Dialog.Root open={open} onOpenChange={setOpen}>
```

| Style with JS state checks | Use data attributes: `[data-checked]` |
| Forget `ref` forwarding in custom components | Always `forwardRef` and spread props |
| Use `preventBaseUIHandler` on native events | Only works with React synthetic events |
| Animate without opacity | Add `opacity: 0.9999` for animation detection |
| Skip animations entirely | Add transitions unless user explicitly opts out |
| Mix controlled/uncontrolled patterns | Pick one approach per component |
| Nest portals incorrectly | Check `keepMounted` for animation libs |

## Quick Reference

| Pattern       | Attributes/Props                                                                  |
| ------------- | --------------------------------------------------------------------------------- |
| Open state    | `[data-open]`, `[data-closed]`, `[data-popup-open]`                               |
| Selection     | `[data-checked]`, `[data-unchecked]`, `[data-selected]`                           |
| Interaction   | `[data-highlighted]`, `[data-pressed]`, `[data-focused]`                          |
| Animation     | `[data-starting-style]`, `[data-ending-style]`                                    |
| Validation    | `[data-dirty]`, `[data-touched]`, `[data-valid]`, `[data-invalid]`                |
| Position vars | `--available-height`, `--available-width`, `--anchor-width`, `--transform-origin` |
| Event control | `eventDetails.cancel()`, `eventDetails.allowPropagation()`                        |

## Additional resources

- [Base UI Styling](styling.md)
- [Base UI Forms](forms.md)
- [Base UI TypeScript](typescript.md)
