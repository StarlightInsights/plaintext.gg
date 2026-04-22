/**
 * Reusable Tailwind class strings for the app's button styles. Keeping them
 * here avoids copy-pasting the same 6-10 line utility chains across every
 * call site, and keeps focus/hover/disabled/aria-checked treatments in sync.
 */

/** Square icon button (toolbar + toggles). Touch targets expand on small screens. */
export const iconButton =
  'inline-flex items-center justify-center bg-transparent border-0 p-1 w-8 h-8 ' +
  'text-muted cursor-pointer touch-manipulation ' +
  'transition-[color,opacity] duration-[160ms] ease-out ' +
  'hover:text-fg ' +
  'focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-2 focus-visible:rounded-[2px] ' +
  'disabled:cursor-default disabled:text-placeholder ' +
  'max-sm:min-h-11 max-sm:min-w-10 max-sm:p-2';

/** Pill-style toggle button used in dialogs (font family, weight, italic, reset, sort). */
export const pillButton =
  'appearance-none bg-transparent border border-line px-2.5 py-1 ' +
  'text-muted font-dialog text-[0.8125rem] cursor-pointer ' +
  'min-w-12 text-center whitespace-nowrap ' +
  'transition-[color,background-color,border-color] duration-[160ms] ease-out ' +
  'hover:text-fg ' +
  'focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-[-1px] ' +
  'aria-checked:bg-line aria-checked:text-fg ' +
  'disabled:opacity-30 disabled:cursor-not-allowed';

/** +/− step button that flanks a numeric value (e.g. font size). */
export const stepButton =
  'inline-flex items-center justify-center bg-transparent ' +
  'border border-line p-1 text-muted cursor-pointer ' +
  'transition-[color,border-color] duration-[160ms] ease-out ' +
  'hover:text-fg ' +
  'focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-muted focus-visible:outline-offset-2 focus-visible:rounded-[2px] ' +
  'disabled:cursor-default disabled:text-placeholder';
