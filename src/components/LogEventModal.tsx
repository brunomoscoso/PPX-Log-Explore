import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LogEvent } from '../types/log.types';
import { formatEventForDisplay, formatLogMessage, splitRequestSections } from '../services/logFormatter';
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
  const [requestSection, setRequestSection] = useState<'header' | 'body'>('header');
  const formatted = useMemo(() => formatEventForDisplay(event), [event]);
  const requestSections = useMemo(
    () => event.type === 'request' ? splitRequestSections(event.raw) : {},
    [event],
  );
  const availableSections = (['header', 'body'] as const).filter((section) => requestSections[section] !== undefined);
  const selectedSection = availableSections.includes(requestSection) ? requestSection : availableSections[0];
  const sectionRaw = selectedSection ? requestSections[selectedSection]! : '';
  const sectionFormatted = useMemo(() => formatLogMessage(sectionRaw), [sectionRaw]);
  const displayedText = selectedSection
    ? showOriginal ? sectionRaw : sectionFormatted
    : showOriginal ? event.raw : formatted;
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
        {availableSections.length > 0
          ? <div className="request-tabs" role="group" aria-label="Secções do pedido">
            {availableSections.map((section) => <button key={section} className="button small quiet" type="button"
              aria-pressed={selectedSection === section} onClick={() => setRequestSection(section)}>
              {section === 'header' ? 'Header' : 'Body'}
            </button>)}
          </div>
          : <span>{showOriginal ? 'Texto original' : 'Vista de leitura'}</span>}
        <div className="result-actions">
          {(selectedSection ? sectionFormatted !== sectionRaw : formatted !== event.raw) && <button className="button small quiet" type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Ver indentado' : 'Ver original'}</button>}
          <button className="button small secondary" type="button" disabled={disabled} onClick={() => { setCopyRequested(true); onCopy(formatted); }}><Icon name="copy" />Copiar evento</button>
        </div>
      </div>
      <pre tabIndex={0} aria-label={`Conteúdo ${showOriginal ? 'original' : 'legível'} do evento na linha ${event.lineNumber}`}>{displayedText}</pre>
      <footer className="modal-footer"><span role="status">{copyRequested ? disabled ? 'A copiar…' : feedback : ''}</span><span>Esc ou clique fora para fechar</span></footer>
    </div>
  </dialog>, document.body);
}
