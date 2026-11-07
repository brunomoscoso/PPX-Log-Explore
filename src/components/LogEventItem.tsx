import { HighlightedText, searchPreview } from './HighlightedText';
import { memo, useState } from 'react';
import type { LogEvent } from '../types/log.types';
import { LogEventModal } from './LogEventModal';
import { Icon } from './Icon';

interface Props { searchText: string; event: LogEvent; onCopy: (text: string) => void; disabled: boolean; feedback: string }

export const LogEventItem = memo(function LogEventItem({ searchText, event, onCopy, disabled, feedback }: Props) {
  const [open, setOpen] = useState(false);
  const level = ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL'].includes(event.level) ? event.level.toLowerCase() : 'other';
  const shortComponent = event.component?.split('.').at(-1) || '—';
  const preview = event.http?.method ? `${event.http.method} ${event.http.uri}` : event.http?.status ? `StatusCode: ${event.http.status}` : event.message.slice(0, 500).split(/[\r\n]/, 1)[0] || '—';
  return <li className={`event-item ${open ? 'is-selected' : ''}`}>
    <button className="event-summary log-columns" type="button" aria-haspopup="dialog"
      aria-label={`Abrir evento ${event.timestampText}, linha ${event.lineNumber}`}
      onClick={() => setOpen(true)}>
      <Icon name="chevron" className="expand-chevron" />
      <span className="event-timestamp"><HighlightedText text={event.timestampText} query={searchText} /></span>
      <span className={`event-type event-type-${event.type}`}><HighlightedText text={event.type.toUpperCase()} query={searchText} /></span>
      <span><span className={`level level-${level}`}><HighlightedText text={event.level || '—'} query={searchText} /></span></span>
      <span className="event-component" title={event.component}><HighlightedText text={shortComponent} query={searchText} /></span>
      <span className="event-preview">
        <HighlightedText text={searchPreview(event.raw, searchText, preview)} query={searchText} />
        {event.searchContext && <small className="event-relation">Par na linha {event.searchContext.relatedLineNumber}{event.searchContext.includedByCorrelation ? ' · Incluída por correlação' : ''}{event.searchContext.outsideRange ? ' · Fora do intervalo' : ''}</small>}
      </span>
    </button>
    {open && <LogEventModal searchText={searchText} event={event} onCopy={onCopy} disabled={disabled} feedback={feedback} onDismiss={() => setOpen(false)} />}
  </li>;
});
