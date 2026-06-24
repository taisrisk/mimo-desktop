## 2026-06-15 - Missing ARIA label on custom buttons
**Learning:** SolidJS components using `<div role="button">` for interactive elements (like the compact mode indicator in `MessageNav`) need explicit `aria-label`s, especially when they only contain presentational elements (like empty divs).
**Action:** Always check custom interactive elements (`role="button"`) for accessible names. Use available localization contexts (like `i18n.t`) and dynamic data (like message titles) to construct meaningful ARIA labels.
## 2025-03-24 - Missing ARIA Labels on Icon Buttons in Settings
 **Learning:** IconButtons used for actions like clearing search inputs (e.g., `icon="circle-x"`) were missing `aria-label`s, rendering them inaccessible to screen readers. This pattern was found across multiple settings components (models, keybinds).
 **Action:** Proactively search for icon-only inputs or buttons across components and ensure they include descriptive `aria-label` attributes using the appropriate localization key (e.g., `language.t("dialog.server.default.clear")`).
