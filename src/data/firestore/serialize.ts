/**
 * Firestore lehnt `undefined`-Feldwerte ab ("Unsupported field value:
 * undefined"), zod-`optional()` lässt sie aber durch den Parse. Vor jedem
 * Write werden undefined-Felder daher rekursiv entfernt — ein fehlender Key
 * und undefined sind für unsere Schemas semantisch identisch.
 *
 * Nur für geparste zod-Payloads gedacht (plain objects/arrays/Primitive).
 * Klassen-Instanzen (Timestamp, FieldValue-Sentinels) laufen nicht durch
 * diesen Helper — Server-Timestamps werden erst nach dem Strip angehängt.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)]),
    ) as T;
  }
  return value;
}
