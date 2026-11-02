import { Icon } from './Icon';

export function Header({ filename }: { filename: string | null }) {
  return <header className="app-header">
    <div className="header-inner">
      <div className="brand"><span className="brand-mark"><Icon name="terminal" /></span>
        <div><h1>PPX <span>Log Explorer</span></h1><p>Ferramenta de análise cronológica de logs do PPX</p></div>
      </div>
      <div className="header-file" title={filename ?? undefined}><Icon name="file" /><span>{filename ?? 'Nenhum ficheiro carregado'}</span></div>
    </div>
  </header>;
}
