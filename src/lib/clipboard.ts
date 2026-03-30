export async function copyPlainText(
	value: string,
	fallbackTextarea?: HTMLTextAreaElement
): Promise<boolean> {
	if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
		const item = new ClipboardItem({
			'text/plain': new Blob([value], { type: 'text/plain' })
		});

		await navigator.clipboard.write([item]);
		return true;
	}

	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(value);
		return true;
	}

	if (!fallbackTextarea) {
		return false;
	}

	const selectionStart = fallbackTextarea.selectionStart;
	const selectionEnd = fallbackTextarea.selectionEnd;
	const selectionDirection = fallbackTextarea.selectionDirection ?? 'none';

	fallbackTextarea.focus();
	fallbackTextarea.select();
	const didCopy = document.execCommand('copy');
	fallbackTextarea.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
	return didCopy;
}

export function downloadPlainTextFile(value: string, filename = 'plaintext.txt'): void {
	const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}
