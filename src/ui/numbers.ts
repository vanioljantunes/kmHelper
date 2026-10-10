/** Read a list of numbers typed or pasted with any mix of spaces, commas, tabs or newlines. */
export function parseNumberList(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

/** A single number, or null when the field is empty or not a number. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
