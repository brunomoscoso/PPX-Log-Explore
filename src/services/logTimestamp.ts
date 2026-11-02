const TIMESTAMP = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

/**
 * Converte o calendário escrito no log numa chave numérica de comparação.
 * Os métodos UTC apenas evitam o fuso/DST da máquina; o log não passa a ter fuso.
 * Não usar Date.parse(), construtores locais ou toLocaleString() nestes valores.
 */
export function parseLogTimestamp(text: string): number | null {
  const match = TIMESTAMP.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(match[7]);

  if (
    year < 1 || month < 1 || month > 12 || day < 1 || day > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) return null;

  // setUTCFullYear evita a interpretação especial dos anos 00–99 em Date.UTC.
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, millisecond);

  // Date normaliza datas inexistentes; rejeitá-las em vez de as corrigir.
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  ) return null;

  return calendar.getTime();
}
