/**
 * Responsabilidad única: ordenar nombres alfabéticamente, insensible a
 * mayúsculas y con los números en orden natural (`2` antes que `10`).
 */
export class NameComparator {
  compare(a: string, b: string): number {
    return (
      a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}) ||
      a.localeCompare(b)
    );
  }
}
