# Base UI TypeScript skill

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
