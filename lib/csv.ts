type Cell = string | number | null | undefined;

function escape(cell: Cell) {
  if (cell === null || cell === undefined) return "";
  const text = String(cell);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
