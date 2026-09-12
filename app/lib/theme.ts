// Shared visual language. Dark, calm, one accent. Used across every screen.
export const C = {
  bg: '#0b0b0f',
  card: '#16161c',
  card2: '#1e1e26',
  line: '#2a2a34',
  text: '#f4f4f7',
  dim: '#a0a0ad',
  faint: '#6b6b78',
  accent: '#7c7bff',
  accentDim: '#3a3a6a',
  fine: '#3ecf8e',
  drifting: '#f5a623',
  problem: '#ff5c6c',
  offline: '#5a5a66',
};

export const stateColor = (s: string): string =>
  ({ fine: C.fine, drifting: C.drifting, problem: C.problem, offline: C.offline } as Record<string, string>)[s] || C.offline;

export const stateWord = (s: string): string =>
  ({ fine: 'doing fine', drifting: 'drifting', problem: 'doomscrolling', offline: 'offline' } as Record<string, string>)[s] || s;
