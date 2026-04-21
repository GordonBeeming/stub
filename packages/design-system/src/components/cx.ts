// Tiny class-name joiner. No clsx dep — we only need truthy-string concat.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
