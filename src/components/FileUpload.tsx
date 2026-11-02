import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Icon } from './Icon';

interface Props {
  filename: string | null;
  busy: boolean;
  onFile: (file: File) => void;
  onError: (message: string) => void;
}

export function FileUpload({ filename, busy, onFile, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (busy) return;
    if (event.dataTransfer.files.length !== 1) {
      onError('Importe um ficheiro de cada vez, no formato .log ou .txt.');
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return <section className={`upload-panel ${dragging ? 'is-dragging' : ''}`} aria-labelledby="upload-title"
    onDragEnter={(event) => { event.preventDefault(); depth.current += 1; if (!busy) setDragging(true); }}
    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; }}
    onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
    onDrop={drop}>
    <span className="upload-symbol"><Icon name={filename ? 'file' : 'upload'} /></span>
    <div className="upload-description">
      <h2 id="upload-title">{dragging ? 'Largue o ficheiro aqui' : filename ?? 'Importar ficheiro de logs'}</h2>
      <p>{filename ? 'Ficheiro disponível nesta sessão. Pode substituí-lo a qualquer momento.' : 'Arraste um ficheiro para aqui ou selecione-o no seu computador.'}</p>
    </div>
    <span className="file-formats">.log / .txt</span>
    <input ref={input} className="visually-hidden" type="file" accept=".log,.txt" aria-label="Ficheiro de logs" disabled={busy}
      onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onFile(file); }} />
    <button type="button" className="button secondary" disabled={busy} onClick={() => input.current?.click()}>
      <Icon name="upload" />{filename ? 'Substituir ficheiro' : 'Selecionar ficheiro'}
    </button>
  </section>;
}
