import { useEffect, useRef } from 'react';
import type { ResultPage } from '../types/worker.types';
import { PAGE_SIZE } from '../types/worker.types';
import { Icon } from './Icon';
import { LogEventItem } from './LogEventItem';
import { HttpErrorItem } from './HttpErrorItem';

interface Props {
  searchText: string;
  polling?: boolean;
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

export function LogViewer({ searchText, polling, view, loaded, recognizable, busy, generation, feedback, onPage, onCopyEvent, onCopyResults, onExport }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0, left: 0 }); }, [view?.page, generation]);
  const total = view?.total ?? 0;
  const errorsOnly = view?.errorCalls !== undefined;
  const resultLabel = errorsOnly ? total === 1 ? 'chamada com erro encontrada' : 'chamadas com erro encontradas' : total === 1 ? 'evento encontrado' : 'eventos encontrados';
  return <section className="results-panel" aria-labelledby="results-title" aria-busy={busy}>
    <div className="results-toolbar"><div className="results-title"><h2 id="results-title">{errorsOnly ? 'Chamadas com erro' : 'Eventos'}</h2>
      <span className="result-count">{loaded ? `${total.toLocaleString('pt-PT')} ${resultLabel}` : 'À espera de um ficheiro'}</span></div>
      <div className="result-actions">
        <button className="button small secondary" disabled={!total || busy} onClick={onCopyResults}><Icon name="copy" />Copiar resultados</button>
        <button className="button small secondary" disabled={!total || busy} onClick={onExport}><Icon name="download" />Exportar .log</button>
      </div>
    </div>
    <div className="log-scroll" ref={scroller}>
      {!errorsOnly && <div className="log-table-heading log-columns" aria-hidden="true"><span /><span>Timestamp <span className="sort-arrow">↑</span></span><span>Tipo</span><span>Nível</span><span>Componente</span><span>Mensagem</span></div>}
      {total > 0 && view ? <ul className={errorsOnly ? 'http-error-list' : 'event-list'} aria-label={errorsOnly ? 'Chamadas com erro encontradas' : 'Eventos encontrados'} key={generation}>
        {view.errorCalls ? view.errorCalls.map((call) => <HttpErrorItem searchText={searchText} key={call.response.id} call={call} disabled={busy} feedback={feedback} onCopy={onCopyEvent} />)
          : view.events.map((event) => <LogEventItem searchText={searchText} key={event.id} event={event} disabled={busy} feedback={feedback} onCopy={onCopyEvent} />)}
      </ul> : <div className="empty-state">
        <span className="empty-symbol"><Icon name={loaded ? 'search' : 'file'} /></span>
        <h3>{!loaded ? 'Comece por importar um ficheiro' : !recognizable ? 'Nenhum evento reconhecível' : errorsOnly ? 'Nenhuma chamada com erro encontrada para os filtros selecionados.' : 'Nenhum evento encontrado para os filtros selecionados.'}</h3>
        <p>{!loaded ? 'Selecione um ficheiro .log ou .txt para explorar os acontecimentos por data e hora.' : !recognizable ? 'Verifique o formato dos timestamps ou selecione outro ficheiro.' : polling ? 'Ajuste o intervalo ou selecione outro filtro rápido.' : errorsOnly ? 'Ajuste o intervalo ou os campos da transação, ou desative Apenas chamadas com erro para voltar aos restantes eventos.' : 'Ajuste o intervalo ou os campos da transação. Ative Debug total para pesquisar também os restantes eventos.'}</p>
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
