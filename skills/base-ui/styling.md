# Base UI Styling skill

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
