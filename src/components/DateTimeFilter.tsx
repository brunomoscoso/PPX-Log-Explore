import type { DateTimeRange } from '../services/logFilter';
import { Icon } from './Icon';
import { TransactionFilters } from './TransactionFilters';
import type { TransactionFilter } from '../types/transactionFilters.types';

interface Props {
  range: DateTimeRange;
  filters: TransactionFilter[];
  onFiltersChange: (filters: TransactionFilter[]) => void;
  disabled: boolean;
  searching: boolean;
  dirty: boolean;
  error: string;
  onChange: (range: DateTimeRange) => void;
  onSearch: () => void;
  onReset: () => void;
}

export function DateTimeFilter({ range, filters, onFiltersChange, disabled, searching, dirty, error, onChange, onSearch, onReset }: Props) {
  const fields = [
    ['startDate', 'Data inicial', 'date'], ['startTime', 'Hora inicial', 'time'],
    ['endDate', 'Data final', 'date'], ['endTime', 'Hora final', 'time'],
  ] as const;
  return <section className="filter-panel" aria-labelledby="filter-title">
    <div className="section-heading"><h2 id="filter-title"><Icon name="clock" />Intervalo de pesquisa</h2>
      <span className="section-note">{dirty ? 'Alterações por aplicar' : 'Horário original do ficheiro'}</span></div>
    <form noValidate onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
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
      <TransactionFilters filters={filters} disabled={disabled} onChange={onFiltersChange} />
      {error && <p className="field-error" role="alert" id="range-error">{error}</p>}
    </form>
  </section>;
}
