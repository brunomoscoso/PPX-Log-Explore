import { memo, useState } from 'react';
import type { LogEvent } from '../types/log.types';
import { LogEventModal } from './LogEventModal';
import { Icon } from './Icon';

interface Props { event: LogEvent; onCopy: (text: string) => void; disabled: boolean; feedback: string }

export const LogEventItem = memo(function LogEventItem({ event, onCopy, disabled, feedback }: Props) {
  const [open, setOpen] = useState(false);
  const level = ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL'].includes(event.level) ? event.level.toLowerCase() : 'other';
  const shortComponent = event.component?.split('.').at(-1) || '—';
  return <li className={`event-item ${open ? 'is-selected' : ''}`}>
    <button className="event-summary log-columns" type="button" aria-haspopup="dialog"
      aria-label={`Abrir evento ${event.timestampText}, linha ${event.lineNumber}`}
      onClick={() => setOpen(true)}>
      <Icon name="chevron" className="expand-chevron" />
      <span className="event-timestamp">{event.timestampText}</span>
      <span><span className={`level level-${level}`}>{event.level || '—'}</span></span>
      <span className="event-component" title={event.component}>{shortComponent}</span>
      <span className="event-preview">{event.message.slice(0, 500).split(/[\r\n]/, 1)[0] || '—'}</span>
    </button>
    {open && <LogEventModal event={event} onCopy={onCopy} disabled={disabled} feedback={feedback} onDismiss={() => setOpen(false)} />}
  </li>;
});
