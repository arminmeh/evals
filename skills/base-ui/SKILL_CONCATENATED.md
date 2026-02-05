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


## Styling

If not provided in the context, ask which styling solution to use - Tailwind CSS, CSS Modules, or plain CSS.

### Data Attributes (Primary State Targeting)

```css
/* State attributes - check component API for full list */
.Switch[data-checked] {
}
.Switch[data-unchecked] {
}
.Menu[data-popup-open] {
}
.MenuItem[data-highlighted] {
}
.Field[data-dirty] {
}
.Field[data-touched] {
}
```

### Dynamic className/style

```tsx
// Function form for state-dependent styling
<Switch.Thumb className={(state) => state.checked ? 'checked' : 'unchecked'} />
<Switch.Thumb style={(state) => ({ color: state.checked ? 'green' : 'gray' })} />
```

### CSS Variables

Components expose sizing/positioning variables:

```css
.Popup {
  max-height: var(--available-height);
  max-width: var(--available-width);
}
.Popover {
  width: var(--anchor-width);
}
.Popup {
  transform-origin: var(--transform-origin);
}
```

### CSS Transitions

```css
.Popup {
  transition:
    transform 150ms,
    opacity 150ms;
  transform-origin: var(--transform-origin);
}

/* Entry/exit states */
.Popup[data-starting-style],
.Popup[data-ending-style] {
  opacity: 0;
  transform: scale(0.9);
}
```

### CSS Keyframe Animations

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.Popup[data-open] {
  animation: fadeIn 200ms ease-out;
}
.Popup[data-closed] {
  animation: fadeOut 150ms ease-in;
}
```

### Animation Detection Gotcha

Base UI uses `element.getAnimations()` to detect completion. If animating without opacity (e.g., drawer slide), add near-invisible opacity change:

```css
/* BAD - drawer won't detect animation end */
.Drawer[data-starting-style] {
  transform: translateX(-100%);
}

/* GOOD - opacity change enables detection */
.Drawer[data-starting-style] {
  transform: translateX(-100%);
  opacity: 0.9999;
}
.Drawer[data-ending-style] {
  transform: translateX(-100%);
  opacity: 0.9999;
}
```

### JavaScript Animation (Framer Motion)

```tsx
// Unmounted components - use keepMounted + AnimatePresence
<AnimatePresence>
  {open && (
    <Dialog.Portal keepMounted>
      <Dialog.Popup render={<motion.div />}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      />
    </Dialog.Portal>
  )}
</AnimatePresence>

// Mounted components - use render prop
<Collapsible.Panel
  render={(props) => (
    <motion.div {...props}
      animate={{ height: open ? 'auto' : 0 }}
    />
  )}
/>
```


## Forms

### Field Structure

```tsx
<Field.Root>
  <Field.Label>Email</Field.Label>
  <Field.Control type="email" required />
  <Field.Description>We'll never share your email</Field.Description>
  <Field.Error match="valueMissing">Required</Field.Error>
  <Field.Error match="typeMismatch">Invalid email</Field.Error>
</Field.Root>
```

### Validation Modes

```tsx
// onSubmit (default) - validate on submit, revalidate on change
<Field.Root validationMode="onSubmit">

// onBlur - validate when focus leaves
<Field.Root validationMode="onBlur">

// onChange - real-time (use with debounce for async)
<Field.Root validationMode="onChange" validationDebounceTime={500}>
```

### Custom Validation

```tsx
<Field.Control
  required
  validate={(value) => {
    if (value.length < 3) return "Too short";
    return null; // valid
  }}
/>
```

### Server Errors

```tsx
<Form errors={{ email: "Already taken" }}>
  <Field.Root name="email">
    <Field.Control />
    <Field.Error /> {/* Shows server error */}
  </Field.Root>
</Form>
```

### Checkbox/Radio Groups

```tsx
<Field.Root>
  <Field.Label>Plan</Field.Label>
  <RadioGroup>
    <Field.Item>
      <Field.Label>
        <Radio value="free" /> Free
      </Field.Label>
    </Field.Item>
    <Field.Item>
      <Field.Label>
        <Radio value="pro" /> Pro
      </Field.Label>
    </Field.Item>
  </RadioGroup>
</Field.Root>
```

### Hidden Input Positioning

```tsx
// Wrap in relative container for validation bubble positioning
<div style={{ position: "relative" }}>
  <Select name="country">{/* hidden input positioned near control */}</Select>
</div>
```


## TypeScript

### Namespace Types

```tsx
import { Tooltip } from '@base-ui/react/tooltip';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';

// Props type for wrapper components
function MyTooltip(props: Tooltip.Root.Props) {
  return <Tooltip.Root {...props} />;
}

// State type for positioned elements
type PopupState = Tooltip.Positioner.State;
// { open, side, align, anchorHidden }

// Event types
type OpenChangeDetails = Dialog.Root.ChangeEventDetails;
type OpenChangeReason = Dialog.Root.ChangeEventReason;

// Actions for imperative control
const actionsRef = useRef<Menu.Root.Actions>(null);
<Menu.Root actionsRef={actionsRef}>
// actionsRef.current?.open()
```
