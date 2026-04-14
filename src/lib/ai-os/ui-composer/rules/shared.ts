/**
 * Shared helpers for composer rules.
 */

/**
 * Normalise an agent's `data` payload into a row array. Agents either return
 * the array directly (most specialist agents) or wrap it in a keyed object
 * such as `{ employees: [...] }` / `{ requests: [...] }` / `{ items: [...] }`.
 * Callers pass the candidate wrapper keys.
 */
export function coerceRows(
  data: unknown,
  ...keys: string[]
): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as Array<Record<string, unknown>>;
    }
  }
  return [];
}
