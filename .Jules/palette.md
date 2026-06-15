## 2026-06-15 - Missing ARIA label on custom buttons
**Learning:** SolidJS components using `<div role="button">` for interactive elements (like the compact mode indicator in `MessageNav`) need explicit `aria-label`s, especially when they only contain presentational elements (like empty divs).
**Action:** Always check custom interactive elements (`role="button"`) for accessible names. Use available localization contexts (like `i18n.t`) and dynamic data (like message titles) to construct meaningful ARIA labels.
