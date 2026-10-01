/** Escapa um valor para CSV (aspas duplas, quebras de linha e separador). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);

  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => unknown;
};

/**
 * Gera e baixa um CSV no navegador.
 *
 * Usa `;` como separador e BOM UTF-8 porque o destino quase sempre é o Excel
 * em pt-BR, que com `,` joga a linha inteira numa coluna só e sem BOM
 * estropia os acentos.
 */
export function downloadCsv<Row>(filename: string, columns: CsvColumn<Row>[], rows: Row[]): void {
  const header = columns.map((column) => escapeCell(column.header)).join(';');
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(';'));
  const content = `﻿${[header, ...body].join('\r\n')}`;

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
