export function convertToCSV<T extends Record<string, unknown>>(data: T[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  for (const row of data) {
    const values = headers.map((header) => {
      let val = "" + (row[header] ?? "");
      // Strip formula injection prefixes (=, +, -, @, \t, \r)
      if (/^[=+\-@\t\r]/.test(val)) {
        val = "'" + val;
      }
      // RFC 4180: escape double quotes by doubling them
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
