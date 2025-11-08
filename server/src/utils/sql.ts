/**
 * Optional SQL template helper for building parameterized queries
 * Usage: sql`SELECT * FROM users WHERE email = ${email}`
 */
export function sql(strings: TemplateStringsArray, ...values: any[]): { text: string; values: any[] } {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return { text, values };
}

