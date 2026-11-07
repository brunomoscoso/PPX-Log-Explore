import { HighlightedText, searchPreview } from './HighlightedText';
import { useState } from 'react';
import type { HttpErrorCall } from '../services/httpErrors';
import { LogEventModal } from './LogEventModal';

interface Props { searchText: string; call: HttpErrorCall; disabled: boolean; feedback: string; onCopy: (text: string) => void }

export function HttpErrorItem({ searchText, call, disabled, feedback, onCopy }: Props) {
  const [open, setOpen] = useState(false);
  const { request, response, statusCode } = call;
  return <li className="http-error-item">
    <button type="button" className="http-error-summary" aria-haspopup="dialog"
      aria-label={`Abrir chamada com erro ${statusCode}, ${response.timestampText}, linha ${response.lineNumber}`} onClick={() => setOpen(true)}>
      <span className="http-error-heading"><strong className="http-error-status"><HighlightedText text={`${statusCode} · ${response.http?.status}`} query={searchText} /></strong><span><HighlightedText text={`Response · ${response.timestampText}`} query={searchText} /></span></span>
      <span className="http-error-url"><HighlightedText query={searchText} text={searchPreview(`${request?.raw ?? ''}\n${response.raw}`, searchText, request ? `${request.http?.method} ${request.http?.uri}` : 'Request não identificada')} /></span>
      <span className="http-error-context">{request ? `Request · ${request.timestampText} · Linha ${request.lineNumber}` : 'Sem associação segura pelo identificador de correlação'}
        {call.requestOutsideRange && <strong> · Request fora do intervalo</strong>}
      </span>
    </button>
    {open && <LogEventModal searchText={searchText} event={response} errorCall={call} disabled={disabled} feedback={feedback} onCopy={onCopy} onDismiss={() => setOpen(false)} />}
  </li>;
}
