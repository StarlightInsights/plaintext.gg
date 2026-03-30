export const controlButtonClass =
	'inline-flex cursor-pointer items-center justify-center bg-transparent p-0 text-[oklch(0.49_0_89.88)] no-underline touch-manipulation transition-colors duration-150 ease-out hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none disabled:cursor-default disabled:text-[var(--text-placeholder)]';

export const iconButtonClass = `${controlButtonClass} h-8 w-8 p-1 max-sm:min-h-11 max-sm:min-w-[2.75rem] max-sm:p-2`;

export const toolbarIconClass = 'pointer-events-none h-[1.3rem] w-[1.3rem] shrink-0 fill-current';

export const dialogButtonClass =
	'appearance-none border-0 bg-transparent p-0 text-[var(--text-secondary)] transition-colors duration-180 ease-out hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none';

export const dialogContentClass =
	'plain-dialog m-auto w-[min(32rem,calc(100vw-1rem))] overflow-y-auto border border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 text-[var(--text-primary)] outline-none transition-[background-color,border-color,color] duration-180 ease-out sm:w-[min(32rem,calc(100vw-2rem))]';

export const dialogTitleClass = 'm-0 text-base font-normal';

export const dialogDescriptionClass =
	'dialog-copy grid gap-4 leading-[1.65] text-[var(--text-primary)]';
