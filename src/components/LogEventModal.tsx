import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LogEvent } from '../types/log.types';
import { formatEventForDisplay } from '../services/logFormatter';
import { Icon } from './Icon';

interface Props {
  event: LogEvent;
  disabled: boolean;
  feedback: string;
  onCopy: (text: string) => void;
  onDismiss: () => void;
}

export function LogEventModal({ event, disabled, feedback, onCopy, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startedOutside = useRef(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [copyRequested, setCopyRequested] = useState(false);
  const formatted = useMemo(() => formatEventForDisplay(event), [event]);
  const titleId = `event-title-${event.id}`;

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const outside = (x: number, y: number) => {
    const rect = dialog.current!.getBoundingClientRect();
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  };

  return createPortal(<dialog ref={dialog} className="event-modal" aria-labelledby={titleId} aria-modal="true"
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }}
    onCancel={(event) => { event.preventDefault(); onDismiss(); }}
    onPointerDown={(event) => { startedOutside.current = event.target === event.currentTarget && outside(event.clientX, event.clientY); }}
    onClick={(event) => {
      if (startedOutside.current && event.target === event.currentTarget && outside(event.clientX, event.clientY)) onDismiss();
      startedOutside.current = false;
    }}>
    <div className="event-modal-content">
      <header className="event-modal-header">
        <div><h2 id={titleId}>Detalhes do evento</h2><p>{event.timestampText} · {event.type === 'request' ? 'REQUEST' : 'LOG'} · {event.level || 'Sem nível'}</p></div>
        <button className="button quiet modal-close" type="button" aria-label="Fechar detalhes do evento" onClick={onDismiss}>×</button>
      </header>
      <div className="modal-metadata">Linha {event.lineNumber}{event.thread ? ` · Thread ${event.thread}` : ''}{event.component ? ` · ${event.component}` : ''}</div>
      <div className="modal-actions">
        <span>{showOriginal ? 'Texto original' : 'Vista de leitura'}</span>
        <div className="result-actions">
          {formatted !== event.raw && <button className="button small quiet" type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Ver indentado' : 'Ver original'}</button>}
          <button className="button small secondary" type="button" disabled={disabled} onClick={() => { setCopyRequested(true); onCopy(event.raw); }}><Icon name="copy" />Copiar evento</button>
        </div>
      </div>
      <pre tabIndex={0} aria-label={`Conteúdo ${showOriginal ? 'original' : 'legível'} do evento na linha ${event.lineNumber}`}>{showOriginal ? event.raw : formatted}</pre>
      <footer className="modal-footer"><span role="status">{copyRequested ? disabled ? 'A copiar…' : feedback : ''}</span><span>Esc ou clique fora para fechar</span></footer>
    </div>
  </dialog>, document.body);
}
