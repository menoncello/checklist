/**
 * Cross-platform clipboard utilities
 * Uses clipboardy for consistent behavior across OS
 */

import clipboardy from 'clipboardy';

export interface ClipboardOptions {
  timeout?: number;
  fallback?: boolean;
}

/**
 * Write text to system clipboard
 */
export async function writeToClipboard(
  text: string,
  options: ClipboardOptions = {}
): Promise<void> {
  const { timeout = 2000, fallback = true } = options;

  try {
    // Simple timeout approach for Bun compatibility
    await Promise.race([
      clipboardy.write(text),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Clipboard write timeout')), timeout)
      ),
    ]);
  } catch (error) {
    if (fallback) {
      // Fallback: Log to console for manual copy
      console.log('Clipboard access failed. Please copy manually:');
      console.log(text);
    } else {
      throw error;
    }
  }
}

/**
 * Read text from system clipboard
 */
export async function readFromClipboard(
  options: ClipboardOptions = {}
): Promise<string> {
  const { timeout = 2000, fallback = true } = options;

  try {
    const text = await Promise.race([
      clipboardy.read(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Clipboard read timeout')), timeout)
      ),
    ]);
    return text;
  } catch (error) {
    if (fallback) {
      // Fallback: Return empty string
      console.warn('Clipboard access failed:', error);
      return '';
    } else {
      throw error;
    }
  }
}

/**
 * Check if clipboard is available
 */
export async function isClipboardAvailable(): Promise<boolean> {
  try {
    // Try a quick read operation
    await readFromClipboard({ timeout: 500, fallback: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear clipboard contents
 */
export async function clearClipboard(
  options: ClipboardOptions = {}
): Promise<void> {
  await writeToClipboard('', options);
}
