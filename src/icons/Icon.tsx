const PATHS: Record<string, string> = {
  overview: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  library: 'M4 4h16v16H4zM4 9h16M9 4v16',
  ai: 'M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z',
  schedule: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
  networks: 'M8 11l8-4M8 13l8 4M5 10h2v4H5zM17 4h2v4h-2zM17 16h2v4h-2z',
  shopee: 'M5 8h14l-1 12H6zM9 8a3 3 0 016 0',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  goodmorning: 'M12 4v2M4.9 6.9l1.4 1.4M3 15h18M7 15a5 5 0 0110 0',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 115 .5c0 1.5-2.5 2-2.5 3.5M12 17v.01',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  guide: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8l6 4-6 4z',
  captions: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  pairing: 'M9 7H6a3 3 0 000 6h3M15 7h3a3 3 0 010 6h-3M8 10h8M9 17h6M12 14v6',
  calculator: 'M5 3h14v18H5zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2',
  publishing: 'M3 12l18-8-6 16-3-7zM12 13l9-9',
  autopilot: 'M12 3l8 4v5c0 4-3 7-8 9-5-2-8-5-8-9V7zM9 12l2 2 4-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.overview} />
    </svg>
  );
}
