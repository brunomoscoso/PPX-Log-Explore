import { Fragment } from 'react';

export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = [...text.matchAll(pattern)];
  return <>{matches.map((match, index) => <Fragment key={match.index}>
    {text.slice(index ? matches[index - 1]!.index + matches[index - 1]![0].length : 0, match.index)}
    <mark className="log-search-match">{match[0]}</mark>
  </Fragment>)}{text.slice(matches.length ? matches[matches.length - 1]!.index + matches[matches.length - 1]![0].length : 0)}</>;
}

export function searchPreview(text: string, query: string, fallback: string): string {
  const start = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (start < 0 || fallback.toLowerCase().includes(query.toLowerCase())) return fallback;
  const from = Math.max(0, start - 60);
  const to = Math.min(text.length, start + query.length + 120);
  return `${from ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`;
}
