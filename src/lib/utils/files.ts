/**
 * Read a file as text. Returns the file's contents, or an error placeholder
 * for binary files (detected by a null byte in the first 8KB).
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const placeholder = `${file.name} is not a text file`;
    reader.onload = () => {
      const result = reader.result as string;
      resolve(isBinaryContent(result) ? placeholder : result);
    };
    reader.onerror = () => resolve(placeholder);
    reader.readAsText(file);
  });
}

/**
 * Read multiple files and concatenate their contents, joined by newlines.
 * Binary files produce a placeholder message rather than garbage.
 */
export async function readFilesAsText(files: FileList | File[]): Promise<string> {
  const contents = await Promise.all(Array.from(files, readFileAsText));
  return contents.join('\n');
}

function isBinaryContent(content: string): boolean {
  const limit = Math.min(content.length, 8192);
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 0) return true;
  }
  return false;
}
