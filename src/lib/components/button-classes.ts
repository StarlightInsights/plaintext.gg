/**
 * Reusable Panda CSS class strings for the app's button styles. Keeping them
 * here avoids copy-pasting the same style objects across every call site, and
 * keeps focus/hover/disabled/aria-checked treatments in sync. The literal
 * `btn`/`btn-icon` markers are preserved for the e2e suite's selectors.
 */
import { css, cx } from "styled-system/css";

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
    _focusVisible: {
      color: "fg",
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "muted",
      outlineOffset: "2px",
      borderRadius: "2px",
    },
    _disabled: { cursor: "default", color: "placeholder" },
    smDown: { minH: "11", minW: "10", p: "2" },
  }),
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
  _focusVisible: {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "-1px",
  },
  "&[aria-checked=true]": { bg: "line", color: "fg" },
  _disabled: { opacity: "0.3", cursor: "not-allowed" },
});

/** +/− step button that flanks a numeric value (e.g. font size). */
export const stepButton = css({
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
  _focusVisible: {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "2px",
    borderRadius: "2px",
  },
  _disabled: { cursor: "default", color: "placeholder" },
});

/** External-link anchor inside dialogs (muted text, hover/focus-visible treatment). */
export const dialogLink = css({
  color: "muted",
  _hoverable: { _hover: { color: "fg" } },
  _focusVisible: {
    color: "fg",
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "muted",
    outlineOffset: "1px",
    borderRadius: "2px",
  },
  transitionProperty: "color",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
});
