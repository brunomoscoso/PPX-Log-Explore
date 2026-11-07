import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { DateTimeFilter } from './components/DateTimeFilter';
import { LogViewer } from './components/LogViewer';
import { EMPTY_RANGE, parseRange } from './services/logFilter';
import type { DateTimeRange } from './services/logFilter';
import type { TransactionFilter } from './types/transactionFilters.types';
import { validateTransactionFilters } from './services/transactionFilter';
import { copyText, downloadLog, exportFilename } from './services/logExporter';
import { LogWorkerClient } from './services/logWorkerClient';
import type { ResultPage } from './types/worker.types';

type Activity = 'loading' | 'searching' | 'paging' | 'copying' | 'exporting';
const activityLabels: Record<Activity, string> = {
  loading: 'A ler e organizar o ficheiro…', searching: 'A pesquisar eventos…',
  paging: 'A carregar a página…', copying: 'A copiar…', exporting: 'A preparar a exportação…',
};

export default function App() {
  const client = useRef<LogWorkerClient | null>(null);
  const working = useRef(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [bounds, setBounds] = useState<DateTimeRange | null>(null);
  const [range, setRange] = useState<DateTimeRange>(EMPTY_RANGE);
  const [appliedRange, setAppliedRange] = useState<DateTimeRange>(EMPTY_RANGE);
  const [filters, setFilters] = useState<TransactionFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<TransactionFilter[]>([]);
  const [debugTotal, setDebugTotal] = useState(false);
  const [appliedDebugTotal, setAppliedDebugTotal] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [appliedErrorsOnly, setAppliedErrorsOnly] = useState(false);
  const [view, setView] = useState<ResultPage | null>(null);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [warning, setWarning] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => () => client.current?.dispose(), []);

  const runTask = useCallback(async (kind: Activity, operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setActivity(kind);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      working.current = false;
      setActivity(null);
    }
  }, []);

  const loadFile = (file: File) => {
    if (working.current) return;
    if (!/\.(log|txt)$/i.test(file.name)) {
      setError('Formato não suportado. Selecione um ficheiro .log ou .txt.');
      return;
    }
    void runTask('loading', async () => {
      client.current?.dispose();
      client.current = null;
      setFilename(null);
      setBounds(null);
      setView(null);
      setRange(EMPTY_RANGE);
      setAppliedRange(EMPTY_RANGE);
      setFilters([]);
      setAppliedFilters([]);
      setFilterError('');
      setWarning('');
      const nextClient = new LogWorkerClient();
      client.current = nextClient;
      const result = await nextClient.request({ command: 'load', file, debugTotal, errorsOnly });
      if (result.kind !== 'loaded') throw new Error('Não foi possível carregar o ficheiro. Tente novamente.');
      setFilename(file.name);
      setView(result.view);
      setAppliedDebugTotal(debugTotal);
      setAppliedErrorsOnly(errorsOnly);
      setBounds(result.bounds);
      setRange(result.bounds ?? EMPTY_RANGE);
      setAppliedRange(result.bounds ?? EMPTY_RANGE);
      setGeneration((value) => value + 1);
      if (result.bounds) {
        const messages: string[] = [];
        if (result.preamble) messages.push('O texto anterior ao primeiro evento não tem data e fica fora da pesquisa e exportação.');
        if (result.invalidTimestamps) messages.push('Existem linhas com timestamps inválidos; as continuações foram preservadas nos eventos associados.');
        setWarning(messages.join(' '));
        setNotice('Ficheiro carregado. A apresentar o intervalo completo.');
      } else {
        setNotice('O ficheiro não contém eventos com timestamps reconhecíveis.');
      }
    });
  };

  const search = (selectedRange = range, selectedFilters = filters, selectedDebugTotal = debugTotal, selectedErrorsOnly = errorsOnly) => {
    if (!bounds || !client.current || working.current) return;
    try {
      parseRange(selectedRange);
      validateTransactionFilters(selectedFilters);
      setFilterError('');
    } catch (failure) {
      setFilterError((failure as Error).message);
      return;
    }
    void runTask('searching', async () => {
      const result = await client.current!.request({ command: 'search', range: selectedRange, filters: selectedFilters, debugTotal: selectedDebugTotal, errorsOnly: selectedErrorsOnly });
      if (result.kind === 'view') {
        setView(result.view);
        setAppliedRange(selectedRange);
        setAppliedFilters(selectedFilters);
        setAppliedDebugTotal(selectedDebugTotal);
        setAppliedErrorsOnly(selectedErrorsOnly);
        setGeneration((value) => value + 1);
        const noun = selectedErrorsOnly ? result.view.total === 1 ? 'chamada com erro encontrada' : 'chamadas com erro encontradas' : result.view.total === 1 ? 'evento encontrado' : 'eventos encontrados';
        setNotice(`Pesquisa concluída: ${result.view.total.toLocaleString('pt-PT')} ${noun}.`);
      }
    });
  };

  const changePage = (page: number) => {
    void runTask('paging', async () => {
      const result = await client.current!.request({ command: 'page', page });
      if (result.kind === 'view') {
        setView(result.view);
        setNotice(`Página ${result.view.page} de ${result.view.pageCount}.`);
      }
    });
  };

  const copyEvent = useCallback((text: string) => {
    void runTask('copying', async () => {
      await copyText(text);
      setNotice('Evento copiado para a área de transferência.');
    });
  }, [runTask]);

  const exportResults = (copy: boolean) => {
    void runTask(copy ? 'copying' : 'exporting', async () => {
      const result = await client.current!.request({ command: 'export' });
      if (result.kind !== 'export') return;
      if (copy) {
        await copyText(result.text);
        setNotice('Resultados copiados para a área de transferência.');
      } else {
        downloadLog(result.text, exportFilename(appliedRange));
        setNotice('Exportação preparada com todos os eventos da pesquisa.');
      }
    });
  };

  const busy = activity !== null;
  return <>
    <Header filename={filename} />
    <main>
      <FileUpload filename={filename} busy={busy} onFile={loadFile} onError={setError} />
      {error && <div className="message error-message" role="alert">{error}</div>}
      {warning && <div className="message warning-message" role="note">{warning}</div>}
      <DateTimeFilter range={range} filters={filters} disabled={!bounds || busy} searching={activity === 'searching'}
        debugTotal={debugTotal} modeDisabled={busy} onDebugTotalChange={(next) => { setDebugTotal(next); search(range, filters, next); }}
        errorsOnly={errorsOnly} onErrorsOnlyChange={(next) => { setErrorsOnly(next); search(range, filters, debugTotal, next); }}
        dirty={!!bounds && (errorsOnly !== appliedErrorsOnly || debugTotal !== appliedDebugTotal || JSON.stringify(range) !== JSON.stringify(appliedRange) || JSON.stringify(filters) !== JSON.stringify(appliedFilters))} error={filterError}
        onFiltersChange={(next) => { setFilters(next); setFilterError(''); }}
        onChange={(next) => { setRange(next); setFilterError(''); }} onSearch={() => search()}
        onReset={() => { if (bounds) { setRange(bounds); setFilters([]); search(bounds, []); } }} />
      <div className="status-line" role="status" aria-live="polite">
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>{activity ? activityLabels[activity] : notice || 'Os ficheiros são processados apenas no seu navegador.'}</span>
      </div>
      <LogViewer view={view} loaded={filename !== null} recognizable={bounds !== null} busy={busy} generation={generation} feedback={error || notice}
        onPage={changePage} onCopyEvent={copyEvent} onCopyResults={() => exportResults(true)} onExport={() => exportResults(false)} />
      <footer className="app-footer"><span>PPX Log Explorer</span><span>Processamento local · Sem envio ou armazenamento de logs</span></footer>
    </main>
  </>;
}
