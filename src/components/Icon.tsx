import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'plus'
  | 'draw'
  | 'fish'
  | 'camera'
  | 'users'
  | 'feed'
  | 'book'
  | 'volume'
  | 'volume-off'
  | 'close'
  | 'dice'
  | 'undo'
  | 'trash'
  | 'brush'
  | 'blend'
  | 'fill'
  | 'eraser'
  | 'download'
  | 'check'
  | 'back'
  | 'lock'
  | 'globe'
  | 'sparkles'
  | 'heart'
  | 'eye-off'
  | 'copy'
  | 'arrow-right'
  | 'help'
  | 'wifi-off'
  | 'wave'
  | 'crab'
  | 'shell'
  | 'star'
  | 'pencil'
  | 'marker'
  | 'crayon'
  | 'spray'
  | 'bow';

/**
 * Hand-drawn UI icons extracted from the supplied icon sheet. Names fall back
 * to the vector paths when no raster art exists (close, wave, lock, etc.).
 */
const ART: Partial<Record<IconName, string>> = {
  plus: '/icons/tambah.webp',
  draw: '/icons/gambar.webp',
  fish: '/icons/goldfish.webp',
  camera: '/icons/foto.webp',
  feed: '/icons/pakan.webp',
  book: '/icons/ikanku.webp',
  volume: '/icons/suara.webp',
  undo: '/icons/undo.webp',
  trash: '/icons/hapus.webp',
  brush: '/icons/kuas.webp',
  blend: '/icons/pipet.webp',
  fill: '/icons/ember.webp',
  eraser: '/icons/penghapus.webp',
  download: '/icons/unduh.webp',
  back: '/icons/kembali.webp',
  pencil: '/icons/edit.webp',
  marker: '/icons/kuas.webp',
  spray: '/icons/efek.webp',
  star: '/icons/stiker.webp',
};

const PATHS: Record<IconName, ReactNode> = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  draw: (
    <>
      <path d="M4 19h16" />
      <path d="M5 19 7 8l10-4 2 11" />
      <path d="M7 8h10" />
    </>
  ),
  fish: (
    <>
      <path d="M3 12c3.3-4.3 8.2-4.9 12.4-2.2L20 6.6l-1 5.4 1 5.4-4.6-3.2C11.2 16.9 6.3 16.3 3 12Z" />
      <circle cx="8.2" cy="11" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3l1.6-2.2h6.8L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5v7A2 2 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-7.5A1.5 1.5 0 0 1 4.5 8.5Z" />
      <circle cx="12" cy="13.5" r="3.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.8 19c.4-3.2 2.4-5 5.2-5s4.8 1.8 5.2 5" />
      <path d="M15.4 5.8a3.2 3.2 0 0 1 0 6.2" />
      <path d="M16.8 14.4c2.1.5 3.3 2.2 3.6 4.6" />
    </>
  ),
  feed: (
    <>
      <path d="M7.5 9.5h9l-1.4 10.3a1.5 1.5 0 0 1-1.5 1.2h-3.2a1.5 1.5 0 0 1-1.5-1.2L7.5 9.5Z" />
      <path d="M9 9.5V6.8a3 3 0 0 1 6 0v2.7" />
      <circle cx="9.5" cy="4.8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="3.4" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="7.4" cy="2.9" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.2c3-1 5.8-.4 8 1.6 2.2-2 5-2.6 8-1.6v14c-3-1-5.8-.4-8 1.6-2.2-2-5-2.6-8-1.6v-14Z" />
      <path d="M12 6.8v14" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10v4h3.2L12 18V6L7.2 10H4Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M4 10v4h3.2L12 18V6L7.2 10H4Z" />
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    </>
  ),
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="8.6" cy="8.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="15.4" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  undo: <><path d="M9 5 4 9.5 9 14" /><path d="M4 9.5h9.2a5.8 5.8 0 0 1 0 11.6H8" /></>,
  trash: (
    <>
      <path d="M4.5 7.5h15" />
      <path d="M9 7.5V5.2A1.2 1.2 0 0 1 10.2 4h3.6a1.2 1.2 0 0 1 1.2 1.2v2.3" />
      <path d="m6.5 7.5 1 12.3h9l1-12.3" />
      <path d="M10.2 11v5" /><path d="M13.8 11v5" />
    </>
  ),
  brush: (
    <>
      <path d="M14.6 4.4 19.6 9.4 10.8 18.2 5.8 13.2 14.6 4.4Z" />
      <path d="m4 20 1.8-6.8 5 5L4 20Z" />
    </>
  ),
  blend: (
    <>
      <path d="M9 4.5h6l1.2 9.2a4.2 4.2 0 0 1-8.4 0L9 4.5Z" />
      <path d="M9.6 10h4.8" />
      <path d="M17 15.5c1.7 1.2 2.5 2.3 2.5 3.4a2.5 2.5 0 0 1-5 0c0-1.1.8-2.2 2.5-3.4Z" />
    </>
  ),
  fill: (
    <>
      <path d="m5.4 11.2 6.8-6.8 6.4 6.4-6.8 6.8a2 2 0 0 1-2.8 0L5.4 14a2 2 0 0 1 0-2.8Z" />
      <path d="m9 8 6.4 6.4" />
      <path d="M19.5 14.5s1.8 2.1 1.8 3.4a1.8 1.8 0 1 1-3.6 0c0-1.3 1.8-3.4 1.8-3.4Z" />
    </>
  ),
  eraser: (
    <>
      <path d="m13.8 4.8 5.4 5.4-8.4 8.4H6.2l-2.4-2.4 10-11.4Z" />
      <path d="m9.6 9 5.4 5.4" />
      <path d="M10.8 18.6h8.6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7.5 10.8 4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  back: <><path d="m14.5 5-7 7 7 7" /><path d="M8 12h12" /></>,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
      <path d="m18.6 16.6.8 2.6 2.6.8-2.6.8-.8 2.6-.8-2.6-2.6-.8 2.6-.8.8-2.6Z" />
    </>
  ),
  heart: <path d="M12 20s-8-4.8-8-10.2A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8 3.3C20 15.2 12 20 12 20Z" />,
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.3A10.2 10.2 0 0 1 12 6.2c5 0 8.5 3.6 9.6 5.8a2 2 0 0 1 0 1.8 12 12 0 0 1-2.2 3" />
      <path d="M6.4 7.7A12.6 12.6 0 0 0 2.4 13a2 2 0 0 0 0 1.8C3.5 17 7 20.4 12 20.4c1.3 0 2.5-.2 3.6-.7" />
      <path d="M10 10.2a2.8 2.8 0 0 0 3.9 3.9" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v9A2.5 2.5 0 0 0 6.5 18H8" />
    </>
  ),
  'arrow-right': <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.2a2.5 2.5 0 0 1 4.9.7c0 1.7-2.7 1.9-2.7 3.7" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="m3 3 18 18" />
      <path d="M7.5 13.5a7 7 0 0 1 2.7-1.6" />
      <path d="M4.5 10a11 11 0 0 1 3.3-1.7" />
      <path d="M14.5 10.4a11 11 0 0 1 5 2" />
      <path d="M10.5 17a2.2 2.2 0 0 1 3 0" />
    </>
  ),
  wave: (
    <>
      <path d="M3 8.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 3.6-1.6 4.8-.6" />
      <path d="M3 13c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 3.6-1.6 4.8-.6" />
      <path d="M3 17.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 3.6-1.6 4.8-.6" />
    </>
  ),
  crab: (
    <>
      <path d="M8 12a4 4 0 0 1 8 0v2.5a4 4 0 0 1-8 0V12Z" />
      <path d="M8 12 4.5 9.5 4 6.5l3 1 1.5 3" />
      <path d="M16 12 19.5 9.5 20 6.5l-3 1-1.5 3" />
      <path d="M9 17.5 7.5 20M15 17.5l1.5 2.5M12 18.5v2" />
    </>
  ),
  shell: (
    <>
      <path d="M4 18.5h16c-.4-6-3.5-11-8-13.5-4.5 2.5-7.6 7.5-8 13.5Z" />
      <path d="M8.5 18.5c0-4 1.1-7.3 3.5-10" />
      <path d="M15.5 18.5c0-4-1.1-7.3-3.5-10" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />,
  pencil: (
    <>
      <path d="m4.5 19.5 4.2-1 10.6-10.6a2.2 2.2 0 0 0-3.1-3.1L5.6 15.4l-1.1 4.1Z" />
      <path d="m14.8 6.2 3.1 3.1" />
      <path d="m5.6 15.4 3.1 3.1" />
    </>
  ),
  marker: (
    <>
      <path d="M9 14.5 14.4 4a2.2 2.2 0 0 1 3.9-.4l1.9 3.1a2.2 2.2 0 0 1-.8 3.1L9 14.5Z" />
      <path d="m7.8 12.8 4.4 4.4-2.3 2.3a2 2 0 0 1-2.8 0l-1.6-1.6a2 2 0 0 1 0-2.8l2.3-2.3Z" />
      <path d="M4.5 21h9" />
    </>
  ),
  crayon: (
    <>
      <path d="M8 5.2 12.6 3l6.6 10.9-4.3 2.6L8 5.2Z" />
      <path d="m8 5.2-2.4 1.4a2 2 0 0 0-.7 2.7l5.4 9a2 2 0 0 0 2.7.7l2.3-1.4" />
      <path d="m6.2 16.9 3.5 2.1" />
    </>
  ),
  spray: (
    <>
      <path d="M8.5 8.5h6l1.2 10.6a1.4 1.4 0 0 1-1.4 1.5h-5.6a1.4 1.4 0 0 1-1.4-1.5L8.5 8.5Z" />
      <path d="M10.2 8.5V6.3a1.8 1.8 0 0 1 3.6 0v2.2" />
      <path d="M5 4.5h.01M3 7h.01M6 10h.01" />
      <path d="M19 3.5h.01M21 6h.01M18 8h.01" />
    </>
  ),
  bow: (
    <>
      <path d="M12 12c-1.4-1.7-3.4-4.2-5.4-4.2A3.6 3.6 0 0 0 3 11.4c0 2 1.6 3.6 3.6 3.6 2 0 4-2.5 5.4-4.2 1.4 1.7 3.4 4.2 5.4 4.2a3.6 3.6 0 0 0 0-7.2c-2 0-4 2.5-5.4 4.2Z" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, className, style, ...props }: IconProps) {
  const art = ART[name];
  if (art) {
    return (
      <img
        src={art}
        width={size}
        height={size}
        className={`art-icon${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size, ...style }}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
