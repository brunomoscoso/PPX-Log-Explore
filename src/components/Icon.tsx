type IconName = 'file' | 'upload' | 'search' | 'copy' | 'download' | 'chevron' | 'clock' | 'terminal';

const paths: Record<IconName, string> = {
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  copy: 'M9 9h12v12H9z M15 5V2H2v13h3',
  download: 'M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5',
  chevron: 'M9 5l7 7-7 7',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  terminal: 'M4 6l6 6-6 6 M13 18h7',
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
