import { useEffect, useRef } from 'react';
import type { TransactionFilterValues } from '../services/transactionFilter';
import { POLLING_QUICK_FILTERS, type PollingFilters } from '../services/pollingFilter';
import type { DateTimeRange } from '../services/logFilter';
import { Icon } from './Icon';
import { TransactionFilters } from './TransactionFilters';

interface Props {
  transactionFilters: TransactionFilterValues;
  onTransactionChange: (filters: TransactionFilterValues) => void;
  polling?: boolean;
  pollingFilters: PollingFilters;
  onPollingChange: (filters: PollingFilters) => void;
  onPollingTextChange: (text: string) => void;
  textSearchDisabled: boolean;
  range: DateTimeRange;
  disabled: boolean;
  searching: boolean;
  dirty: boolean;
  error: string;
  debugTotal: boolean;
  errorsOnly: boolean;
  onErrorsOnlyChange: (value: boolean) => void;
  modeDisabled: boolean;
  onDebugTotalChange: (value: boolean) => void;
  onChange: (range: DateTimeRange) => void;
  onSearch: () => void;
  onReset: () => void;
}

export function DateTimeFilter({ transactionFilters, onTransactionChange, polling, pollingFilters, onPollingChange, onPollingTextChange, textSearchDisabled, range, disabled, searching, dirty, error, debugTotal, errorsOnly, onErrorsOnlyChange, modeDisabled, onDebugTotalChange, onChange, onSearch, onReset }: Props) {
  const textInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (textSearchDisabled) return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        textInput.current?.focus();
        textInput.current?.select();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [polling, textSearchDisabled]);
  const fields = [
    ['startDate', 'Data inicial', 'date'], ['startTime', 'Hora inicial', 'time'],
    ['endDate', 'Data final', 'date'], ['endTime', 'Hora final', 'time'],
  ] as const;
  return <section className="filter-panel" aria-labelledby="filter-title">
    <div className="section-heading"><h2 id="filter-title"><Icon name="clock" />Intervalo de pesquisa</h2>
      <span className="section-note">{dirty ? 'Alterações por aplicar' : 'Horário original do ficheiro'}</span></div>
    <form noValidate onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
      {!polling && <div className="search-mode">
        <label><input type="checkbox" checked={debugTotal} disabled={modeDisabled || errorsOnly} onChange={(event) => onDebugTotalChange(event.target.checked)} /> Debug total</label>
        <label><input type="checkbox" checked={errorsOnly} disabled={modeDisabled} onChange={(event) => onErrorsOnlyChange(event.target.checked)} /> Apenas chamadas com erro</label>
        <span>{errorsOnly ? 'HTTP 400–599 · Horário da response · Request e response juntas' : debugTotal }</span>
      </div>}
      <div className="filter-fields">
        {fields.map(([key, label, type]) => <div className="field" key={key}>
          <label htmlFor={key}>{label}</label>
          <input id={key} type={type} step={type === 'time' ? 1 : undefined} min={type === 'date' ? '0001-01-01' : undefined} max={type === 'date' ? '9999-12-31' : undefined}
            value={range[key]} disabled={disabled} required aria-invalid={error ? true : undefined} aria-describedby={error ? 'range-error' : undefined}
            onChange={(event) => onChange({ ...range, [key]: event.target.value })} />
        </div>)}
        <div className="filter-buttons">
          <button className="button primary" type="submit" disabled={disabled}><Icon name="search" />{searching ? 'A pesquisar…' : 'Pesquisar'}</button>
          <button className="button quiet" type="button" disabled={disabled} onClick={onReset}>Limpar filtros</button>
        </div>
      </div>
      {polling ? <div className="polling-quick-panel">
        <div className="polling-tools-heading">
          <h3>Filtros rápidos</h3>
          <div className="field polling-text-search">
            <label className="visually-hidden" htmlFor="polling-text-search">Buscar texto no log</label>
            <Icon name="search" />
            <input ref={textInput} id="polling-text-search" type="search" placeholder="Buscar texto no log… (Ctrl+F)" value={pollingFilters.text ?? ''}
              disabled={textSearchDisabled} onChange={event => onPollingTextChange(event.target.value)} />
          </div>
        </div>
        <div className="polling-quick-grid">
          {POLLING_QUICK_FILTERS.map(filter => <button type="button" key={filter.key}
            className="polling-quick-button" disabled={disabled} aria-pressed={pollingFilters.quick.includes(filter.key)}
            onClick={() => onPollingChange({ ...pollingFilters, quick: pollingFilters.quick.includes(filter.key)
              ? pollingFilters.quick.filter(key => key !== filter.key) : [...pollingFilters.quick, filter.key] })}>
            <span aria-hidden="true">{filter.symbol}</span>{filter.label}
          </button>)}
        </div>
      </div> : <TransactionFilters textInput={textInput} textSearchDisabled={textSearchDisabled} values={transactionFilters} onChange={onTransactionChange} disabled={disabled} />}
      {error && <p className="field-error" role="alert" id="range-error">{error}</p>}
    </form>
  </section>;
}
