import type { TransactionFilterValues } from './services/transactionFilter';
import type { ReactNode } from 'react';
import { EMPTY_POLLING_FILTERS, type PollingFilters } from './services/pollingFilter';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { DateTimeFilter } from './components/DateTimeFilter';
import { LogViewer } from './components/LogViewer';
import { EMPTY_RANGE, parseRange } from './services/logFilter';
import type { DateTimeRange } from './services/logFilter';
import { copyText, downloadLog, exportFilename } from './services/logExporter';
import { LogWorkerClient } from './services/logWorkerClient';
import type { ResultPage } from './types/worker.types';

type Activity = 'loading' | 'searching' | 'paging' | 'copying' | 'exporting';
const activityLabels: Record<Activity, string> = {
  loading: 'A ler e organizar o ficheiro…', searching: 'A pesquisar eventos…',
  paging: 'A carregar a página…', copying: 'A copiar…', exporting: 'A preparar a exportação…',
};

export default function App() {
  const [tab, setTab] = useState<'comserver' | 'polling'>('comserver');
  const tabs = <nav className="log-tabs" aria-label="Tipo de log">
    {(['comserver', 'polling'] as const).map((value) => <button key={value} type="button"
      className={`button ${tab === value ? 'primary' : 'secondary'}`} aria-pressed={tab === value}
      onClick={() => setTab(value)}>{value === 'comserver' ? 'ComServer' : 'PollingV6'}</button>)}
  </nav>;
  return <>{(['comserver', 'polling'] as const).map((format) =>
    <LogWorkspace key={format} format={format} active={tab === format} tabs={tabs} />)}</>;
}

function LogWorkspace({ format, active, tabs }: { format: 'comserver' | 'polling'; active: boolean; tabs: ReactNode }) {
  const polling = format === 'polling';
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilterValues>({});
  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilterValues>({});
  const [pollingFilters, setPollingFilters] = useState<PollingFilters>(EMPTY_POLLING_FILTERS);
  const [appliedPollingFilters, setAppliedPollingFilters] = useState<PollingFilters>(EMPTY_POLLING_FILTERS);
  const client = useRef<LogWorkerClient | null>(null);
  const working = useRef(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [bounds, setBounds] = useState<DateTimeRange | null>(null);
  const [range, setRange] = useState<DateTimeRange>(EMPTY_RANGE);
  const [appliedRange, setAppliedRange] = useState<DateTimeRange>(EMPTY_RANGE);
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
      setFilterError('');
      setWarning('');
      const nextClient = new LogWorkerClient();
      client.current = nextClient;
      const result = await nextClient.request({ command: 'load', file, format, debugTotal, errorsOnly });
      if (result.kind !== 'loaded') throw new Error('Não foi possível carregar o ficheiro. Tente novamente.');
      setFilename(file.name);
      setTransactionFilters({});
      setAppliedTransactionFilters({});
      setPollingFilters(EMPTY_POLLING_FILTERS);
      setAppliedPollingFilters(EMPTY_POLLING_FILTERS);
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

  const search = (selectedRange = range, selectedDebugTotal = debugTotal, selectedErrorsOnly = errorsOnly, selectedPollingFilters = pollingFilters, selectedTransactionFilters = transactionFilters) => {
    if (!bounds || !client.current || working.current) return;
    try {
      parseRange(selectedRange);
      setFilterError('');
    } catch (failure) {
      setFilterError((failure as Error).message);
      return;
    }
    void runTask('searching', async () => {
      const result = await client.current!.request({ command: 'search', transactionFilters: selectedTransactionFilters, range: selectedRange, pollingFilters: selectedPollingFilters, debugTotal: selectedDebugTotal, errorsOnly: selectedErrorsOnly });
      if (result.kind === 'view') {
        setView(result.view);
        setAppliedRange(selectedRange);
        setAppliedTransactionFilters(selectedTransactionFilters);
        setAppliedPollingFilters(selectedPollingFilters);
        setAppliedDebugTotal(selectedDebugTotal);
        setAppliedErrorsOnly(selectedErrorsOnly);
        setGeneration((value) => value + 1);
        const noun = selectedErrorsOnly ? result.view.total === 1 ? 'chamada com erro encontrada' : 'chamadas com erro encontradas' : result.view.total === 1 ? 'evento encontrado' : 'eventos encontrados';
        setNotice(`Pesquisa concluída: ${result.view.total.toLocaleString('pt-PT')} ${noun}.`);
      }
    });
  };

  useEffect(() => {
    const text = polling ? pollingFilters.text : transactionFilters.text;
    const appliedText = polling ? appliedPollingFilters.text : appliedTransactionFilters.text;
    if (!active || !bounds || activity || (text ?? '') === (appliedText ?? '')) return;
    const timer = window.setTimeout(() => search(), 250);
    return () => window.clearTimeout(timer);
  }, [polling, active, bounds, activity, pollingFilters.text, appliedPollingFilters.text, transactionFilters.text, appliedTransactionFilters.text, range, debugTotal, errorsOnly]);

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
  if (!active) return null;
  return <>
    <Header filename={filename} />
    <main>
      {tabs}
      <FileUpload filename={filename} busy={busy} onFile={loadFile} onError={setError} />
      {error && <div className="message error-message" role="alert">{error}</div>}
      {warning && <div className="message warning-message" role="note">{warning}</div>}
      <DateTimeFilter textSearchDisabled={!bounds || activity === 'loading'} onPollingTextChange={(text) => setPollingFilters(current => ({ ...current, text }))} transactionFilters={transactionFilters} onTransactionChange={setTransactionFilters} polling={polling} pollingFilters={pollingFilters} onPollingChange={(next) => { setPollingFilters(next); search(range, debugTotal, errorsOnly, next); }} range={range} disabled={!bounds || busy} searching={activity === 'searching'}
        debugTotal={debugTotal} modeDisabled={busy} onDebugTotalChange={(next) => { setDebugTotal(next); search(range, next); }}
        errorsOnly={errorsOnly} onErrorsOnlyChange={(next) => { setErrorsOnly(next); search(range, debugTotal, next); }}
        dirty={!!bounds && (JSON.stringify(transactionFilters) !== JSON.stringify(appliedTransactionFilters) || JSON.stringify(pollingFilters) !== JSON.stringify(appliedPollingFilters) || errorsOnly !== appliedErrorsOnly || debugTotal !== appliedDebugTotal || JSON.stringify(range) !== JSON.stringify(appliedRange))} error={filterError}
        onChange={(next) => { setRange(next); setFilterError(''); }} onSearch={() => search()}
        onReset={() => { if (bounds) { setRange(bounds); setTransactionFilters({}); setPollingFilters(EMPTY_POLLING_FILTERS); search(bounds, debugTotal, errorsOnly, EMPTY_POLLING_FILTERS, {}); } }} />
      <div className="status-line" role="status" aria-live="polite">
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>{activity ? activityLabels[activity] : notice || 'Os ficheiros são processados apenas no seu navegador.'}</span>
      </div>
      <LogViewer searchText={(polling ? appliedPollingFilters.text : appliedTransactionFilters.text) ?? ''} polling={polling} view={view} loaded={filename !== null} recognizable={bounds !== null} busy={busy} generation={generation} feedback={error || notice}
        onPage={changePage} onCopyEvent={copyEvent} onCopyResults={() => exportResults(true)} onExport={() => exportResults(false)} />
      <footer className="app-footer"><span>PPX Log Explorer</span><span>Processamento local · Sem envio ou armazenamento de logs</span></footer>
    </main>
  </>;
}
