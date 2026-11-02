import { useEffect, useRef } from 'react';
import type { ResultPage } from '../types/worker.types';
import { PAGE_SIZE } from '../types/worker.types';
import { Icon } from './Icon';
import { LogEventItem } from './LogEventItem';

interface Props {
  view: ResultPage | null;
  loaded: boolean;
  recognizable: boolean;
  busy: boolean;
  generation: number;
  feedback: string;
  onPage: (page: number) => void;
  onCopyEvent: (text: string) => void;
  onCopyResults: () => void;
  onExport: () => void;
}

export function LogViewer({ view, loaded, recognizable, busy, generation, feedback, onPage, onCopyEvent, onCopyResults, onExport }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0, left: 0 }); }, [view?.page, generation]);
  const total = view?.total ?? 0;
  return <section className="results-panel" aria-labelledby="results-title" aria-busy={busy}>
    <div className="results-toolbar"><div className="results-title"><h2 id="results-title">Eventos</h2>
      <span className="result-count">{loaded ? `${total.toLocaleString('pt-PT')} ${total === 1 ? 'evento encontrado' : 'eventos encontrados'}` : 'À espera de um ficheiro'}</span></div>
      <div className="result-actions">
        <button className="button small secondary" disabled={!total || busy} onClick={onCopyResults}><Icon name="copy" />Copiar resultados</button>
        <button className="button small secondary" disabled={!total || busy} onClick={onExport}><Icon name="download" />Exportar .log</button>
      </div>
    </div>
    <div className="log-scroll" ref={scroller}>
      <div className="log-table-heading log-columns" aria-hidden="true"><span /><span>Timestamp <span className="sort-arrow">↑</span></span><span>Nível</span><span>Componente</span><span>Mensagem</span></div>
      {total > 0 && view ? <ul className="event-list" aria-label="Eventos encontrados" key={generation}>
        {view.events.map((event) => <LogEventItem key={event.id} event={event} disabled={busy} feedback={feedback} onCopy={onCopyEvent} />)}
      </ul> : <div className="empty-state">
        <span className="empty-symbol"><Icon name={loaded ? 'search' : 'file'} /></span>
        <h3>{!loaded ? 'Comece por importar um ficheiro' : !recognizable ? 'Nenhum evento reconhecível' : 'Nenhum evento encontrado para os filtros selecionados.'}</h3>
        <p>{!loaded ? 'Selecione um ficheiro .log ou .txt para explorar os acontecimentos por data e hora.' : !recognizable ? 'Verifique o formato dos timestamps ou selecione outro ficheiro.' : 'Ajuste o intervalo ou os campos da transação, ou limpe os filtros para consultar todo o ficheiro.'}</p>
      </div>}
    </div>
    <div className="results-footer"><span>{total > 0 && view ? `${(view.page - 1) * PAGE_SIZE + 1}–${Math.min(view.page * PAGE_SIZE, total)} de ${total.toLocaleString('pt-PT')}` : 'Ordem cronológica crescente'}<span className="footer-hint"> · {total > 0 ? 'Clique num evento para ver os detalhes' : 'Todos os níveis incluídos'}</span></span>
      {view && view.pageCount > 1 && <nav className="pagination" aria-label="Paginação de eventos">
        <button className="button small quiet" disabled={busy || view.page === 1} onClick={() => onPage(view.page - 1)}>Anterior</button>
        <span>Página {view.page} de {view.pageCount}</span>
        <button className="button small quiet" disabled={busy || view.page === view.pageCount} onClick={() => onPage(view.page + 1)}>Seguinte</button>
      </nav>}
    </div>
  </section>;
}
