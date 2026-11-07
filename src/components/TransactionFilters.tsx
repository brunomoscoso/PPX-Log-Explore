import { TRANSACTION_FIELDS, type TransactionField, type TransactionFilterValues } from '../services/transactionFilter';
import type { RefObject } from 'react';
import { Icon } from './Icon';

interface Props { values: TransactionFilterValues; disabled: boolean; textSearchDisabled: boolean; textInput: RefObject<HTMLInputElement | null>; onChange: (values: TransactionFilterValues) => void }

export function TransactionFilters({ values, disabled, textSearchDisabled, textInput, onChange }: Props) {
  const available = TRANSACTION_FIELDS.filter(field => values[field.key] === undefined);
  return <div className="transaction-filters">
    <div className="transaction-filter-heading">
      <div className="field polling-text-search comserver-text-search">
        <label className="visually-hidden" htmlFor="comserver-text-search">Buscar texto no log</label>
        <Icon name="search" />
        <input ref={textInput} id="comserver-text-search" type="search" placeholder="Buscar texto no log… (Ctrl+F)"
          value={values.text ?? ''} disabled={textSearchDisabled} onChange={event => onChange({ ...values, text: event.target.value })} />
      </div>
      <label htmlFor="add-filter">Adicionar filtro</label>
      <select id="add-filter" disabled={disabled || !available.length} value=""
        onChange={event => { if (event.target.value) onChange({ ...values, [event.target.value as TransactionField]: '' }); }}>
        <option value="">Selecione um filtro...</option>
        {available.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
      </select>
    </div>
    <div className="transaction-fields">
      {TRANSACTION_FIELDS.filter(field => values[field.key] !== undefined).map(field => <div className="field" key={field.key}>
        <label htmlFor={`transaction-${field.key}`}>{field.label}</label>
        <div className="transaction-input">
          <input id={`transaction-${field.key}`} value={values[field.key]} disabled={disabled} placeholder={field.placeholder} title={field.placeholder}
            inputMode={['quantity', 'total', 'discountedTotal'].includes(field.key) ? 'decimal' : 'text'}
            onChange={event => onChange({ ...values, [field.key]: event.target.value })} />
          <button type="button" className="button quiet small" disabled={disabled} aria-label={`Remover filtro ${field.label}`}
            onClick={() => { const next = { ...values }; delete next[field.key]; onChange(next); }}>×</button>
        </div>
      </div>)}
    </div>
  </div>;
}
