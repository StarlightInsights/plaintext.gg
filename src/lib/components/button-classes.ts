/**
 * Reusable Panda CSS class strings for the app's button styles. Keeping them
 * here avoids copy-pasting the same style objects across every call site, and
 * keeps focus/hover/disabled/aria-checked treatments in sync. The literal
 * `btn`/`btn-icon` markers are preserved for the e2e suite's selectors.
 */
import { css, cx } from "styled-system/css";

/**
 * Keyboard-only focus ring (Panda `_focusVisible`). Extracted so the one outline
 * treatment stays in sync everywhere it's used — icon buttons, steppers, dialog
 * links, the dialog close button. The two variants differ only by outline
 * offset (`focusRing2` = 2px for buttons, `focusRing1` = 1px for inline links);
 * `cx()` them onto a control instead of re-declaring the block.
 */
export const focusRing2 = css({
  _focusVisible: {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "2px",
    borderRadius: "2px",
  },
});
export const focusRing1 = css({
  _focusVisible: {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "1px",
    borderRadius: "2px",
  },
});

/**
 * Segmented control wrapper: zero gap with a 1px negative inset so adjacent
 * control borders overlap into one shared edge. Ark radio items render as
 * `<label>`, so the overlap targets any adjacent children.
 */
export const segmentedGroup = css({
  display: "flex",
  alignItems: "center",
  gap: "0",
  "& > * + *": { marginLeft: "-1px" },
});

/** Square icon button (toolbar + toggles). Touch targets expand on small screens. */
export const iconButton = cx(
  "btn btn-icon",
  css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    bg: "transparent",
    borderWidth: "0",
    p: "1",
    w: "8",
    h: "8",
    color: "muted",
    cursor: "pointer",
    touchAction: "manipulation",
    transitionProperty: "color, opacity",
    transitionDuration: "160ms",
    transitionTimingFunction: "ease-out",
    _hoverable: { _hover: { color: "fg" } },
    _disabled: { cursor: "default", color: "placeholder" },
    smDown: { minH: "11", minW: "10", p: "2" },
  }),
  focusRing2,
);

/** Pill-style toggle button used in dialogs (font family, weight, italic, reset, sort). */
export const pillButton = css({
  appearance: "none",
  bg: "transparent",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "line",
  px: "2.5",
  py: "1",
  color: "muted",
  fontFamily: "dialog",
  fontSize: "0.8125rem",
  cursor: "pointer",
  minW: "12",
  textAlign: "center",
  whiteSpace: "nowrap",
  transitionProperty: "color, background-color, border-color",
  transitionDuration: "160ms",
  transitionTimingFunction: "ease-out",
  _hoverable: { _hover: { color: "fg" } },
  // Keyboard-only focus ring. Ark sets `data-focus-visible` on these controls
  // even for a mouse click (mirroring native radios), and Panda's `_focusVisible`
  // matches `[data-focus-visible]` — so a click would leave a heavy 2px outline
  // stuck on the segmented control. Key the ring off the *native* `:focus-visible`
  // instead, which is keyboard-only: on the control itself (the plain `reset`
  // button) and on the hidden radio/switch input inside the label. Two rules, not
  // one grouped selector, so the button ring survives engines without `:has()`.
  "&:focus-visible": {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "-1px",
  },
  "&:has(:focus-visible)": {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "-1px",
  },
  // Ark RadioGroup/Switch mark the selected control with data-state="checked"
  // (on a <label>, so :checked/aria-checked don't apply); the plain `reset`
  // button keeps no selected state. Disabled radio items expose data-disabled.
  "&[data-state=checked]": { bg: "line", color: "fg" },
  "&[data-disabled]": { opacity: "0.3", cursor: "not-allowed" },
  _disabled: { opacity: "0.3", cursor: "not-allowed" },
});

/** +/− step button that flanks a numeric value (e.g. font size). */
export const stepButton = cx(
  css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    bg: "transparent",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "line",
    p: "1",
    color: "muted",
    cursor: "pointer",
    transitionProperty: "color, border-color",
    transitionDuration: "160ms",
    transitionTimingFunction: "ease-out",
    _hoverable: { _hover: { color: "fg" } },
    _disabled: { cursor: "default", color: "placeholder" },
  }),
  focusRing2,
);

/** External-link anchor inside dialogs (muted text, hover/focus-visible treatment). */
export const dialogLink = cx(
  css({
    color: "muted",
    _hoverable: { _hover: { color: "fg" } },
    transitionProperty: "color",
    transitionDuration: "180ms",
    transitionTimingFunction: "ease-out",
  }),
  focusRing1,
);
