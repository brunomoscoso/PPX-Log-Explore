export interface LogEvent {
  /** Único dentro do ficheiro; deriva da posição original, não do timestamp. */
  id: string;
  /** Milissegundos numa escala de calendário sem fuso. Não é um instante UTC real. */
  timestamp: number;
  timestampText: string;
  level: string;
  thread?: string;
  component?: string;
  /** Mensagem e continuações, com as quebras de linha originais. */
  message: string;
  /** Segmento exato do texto de entrada, incluindo o terminador de linha final. */
  raw: string;
  /** Linha inicial no ficheiro, a contar de 1. */
  lineNumber: number;
  /** Posições em unidades UTF-16 no texto de entrada; endOffset é exclusivo. */
  startOffset: number;
  endOffset: number;
}

export interface ParseIssue {
  code: 'preamble' | 'invalid-timestamp';
  lineNumber: number;
  /** Mensagem genérica; não reproduz dados do log. */
  message: string;
}

export interface ParseResult {
  /** Ordem original do ficheiro. A ordenação cronológica pertence ao filtro. */
  events: LogEvent[];
  /** Texto anterior ao primeiro evento válido; nunca é descartado silenciosamente. */
  preamble: string;
  issues: ParseIssue[];
}
