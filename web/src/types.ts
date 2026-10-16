export interface Period {
  id: string;
  name: string;
  date: string;
  tournaments: string[];
}

export interface PlayerRaw {
  id: string;
  n: string; // ad soyad
  g: 'E' | 'K' | ''; // cinsiyet
  t: string; // unvan
  b: number | null; // dogum yili
  f: number | null; // fide no
  s: string; // durum
  u: (number | null)[]; // ukd
  r: (number | null)[]; // rank
  d: (number | null)[]; // degisim
  m: (number | null)[]; // donem maci
  k: (number | null)[]; // kumulatif mac
  c: number[]; // kulup index
}

export interface UkdDataset {
  generated: string;
  source: string;
  periods: Period[];
  clubs: string[];
  players: PlayerRaw[];
}

export interface PlayerSummary {
  player: PlayerRaw;
  latestUkd: number;
  latestChange: number;
  peakUkd: number;
  peakPeriodIndex: number;
  minUkd: number;
  firstUkd: number;
  firstPeriodIndex: number;
  totalChange: number;
  careerGames: number;
  latestRank: number;
  bestRank: number;
  ratedCount: number;
  changesCount: number;
  currentClub: string;
  searchStr: string;
}

export type TabType = 'player' | 'compare' | 'movers' | 'clubs' | 'leaderboard' | 'archive';

export type MetricType = 'ukd' | 'change' | 'rank' | 'games';
