import { TRANSACTION_FIELDS, TRANSACTION_FILTER_GROUPS } from '../types/transactionFilters.types';
import type { TransactionFilter } from '../types/transactionFilters.types';

interface Props {
  filters: TransactionFilter[];
  disabled: boolean;
  onChange: (filters: TransactionFilter[]) => void;
}

export function TransactionFilters({ filters, disabled, onChange }: Props) {
  const available = TRANSACTION_FIELDS.filter((field) => !filters.some((filter) => filter.field === field.id));
  return <div className="transaction-filters">
    <div className="transaction-filter-heading">
      <label className="visually-hidden" htmlFor="add-filter">Adicionar filtro</label>
      <select id="add-filter" value="" disabled={disabled || available.length === 0}
        onChange={(event) => {
          const field = available.find((item) => item.id === event.target.value);
          if (field) onChange([...filters, { field: field.id, value: '' }]);
        }}>
        <option value="">{available.length ? '+ Adicionar filtro' : 'Todos os filtros adicionados'}</option>
        {TRANSACTION_FILTER_GROUPS.map((group) => {
          const fields = group.fields.flatMap((id) => available.filter((field) => field.id === id));
          return fields.length > 0 && <optgroup key={group.label} label={group.label}>
            {fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
          </optgroup>;
        })}
      </select>
      <span>{filters.length ? 'Combinar todos os filtros · Valores exatos' : 'Campos da transação · Opcional'}</span>
    </div>
    {TRANSACTION_FILTER_GROUPS.map((group) => {
      const groupFilters = filters.filter((filter) => group.fields.includes(filter.field));
      return groupFilters.length > 0 && <fieldset className="transaction-filter-group" key={group.label}>
        <legend>{group.label}</legend>
        <div className="transaction-filter-fields">
      {groupFilters.map((filter) => {
        const definition = TRANSACTION_FIELDS.find((field) => field.id === filter.field)!;
        const id = `filter-${filter.field}`;
        return <div className="transaction-filter-field" key={filter.field}>
          <label htmlFor={id}>{definition.label}</label>
          <div className="transaction-filter-value"><input id={id} type="text" inputMode={definition.kind === 'decimal' ? 'decimal' : 'text'}
            value={filter.value} placeholder={definition.placeholder} disabled={disabled} autoComplete="off" spellCheck={false}
            onChange={(event) => onChange(filters.map((item) => item.field === filter.field ? { ...item, value: event.target.value } : item))} />
            <button type="button" className="button quiet" disabled={disabled} aria-label={`Remover filtro ${definition.label}`}
              onClick={() => onChange(filters.filter((item) => item.field !== filter.field))}>×</button>
          </div>
        </div>;
      })}
        </div>
      </fieldset>;
    })}
  </div>;
}
