import { PlayerRaw, PlayerSummary } from './types';

/**
 * Turkish-insensitive string normalizer for search queries.
 * Converts İ/I/ı/i -> i, ş -> s, ğ -> g, ü -> u, ö -> o, ç -> c
 */
export function normalizeTr(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export function buildPlayerSummaries(players: PlayerRaw[], clubs: string[]): PlayerSummary[] {
  return players.map((p) => {
    let latestUkd = 0;
    let latestChange = 0;
    let peakUkd = 0;
    let peakPeriodIndex = -1;
    let minUkd = 999999;
    let firstUkd = 0;
    let firstPeriodIndex = -1;
    let latestRank = 0;
    let bestRank = 999999;
    let careerGames = 0;
    let ratedCount = 0;
    let changesCount = 0;
    let currentClub = '';
    let prevRatedUkd = 0;

    for (let i = 0; i < p.u.length; i++) {
      const u = p.u[i];
      if (u !== null && u > 0) {
        ratedCount++;
        // Ensure p.d[i] is populated if missing
        if ((p.d[i] === null || p.d[i] === 0) && prevRatedUkd > 0 && u !== prevRatedUkd) {
          p.d[i] = Math.round((u - prevRatedUkd) * 10) / 10;
        }
        if ((p.d[i] ?? 0) !== 0) {
          changesCount++;
        }
        prevRatedUkd = u;
        latestUkd = u;
        latestChange = p.d[i] ?? 0;
        if (firstPeriodIndex === -1) {
          firstUkd = u;
          firstPeriodIndex = i;
        }
        if (u > peakUkd) {
          peakUkd = u;
          peakPeriodIndex = i;
        }
        if (u < minUkd) {
          minUkd = u;
        }
      }
      const r = p.r[i];
      if (r !== null && r > 0) {
        latestRank = r;
        if (r < bestRank) bestRank = r;
      }
      const k = p.k[i];
      if (k !== null && k > careerGames) careerGames = k;

      const cIdx = p.c[i];
      if (cIdx >= 0 && cIdx < clubs.length) {
        currentClub = clubs[cIdx];
      }
    }

    if (bestRank === 999999) bestRank = 0;
    if (minUkd === 999999) minUkd = 0;
    const totalChange = firstUkd > 0 ? Math.round((latestUkd - firstUkd) * 10) / 10 : 0;
    const rawSearch = `${p.n} ${p.id} ${currentClub} ${p.t}`;
    const searchStr = normalizeTr(rawSearch);

    return {
      player: p,
      latestUkd,
      latestChange,
      peakUkd,
      peakPeriodIndex,
      minUkd,
      firstUkd,
      firstPeriodIndex,
      totalChange,
      careerGames,
      latestRank,
      bestRank,
      ratedCount,
      changesCount,
      currentClub,
      searchStr,
    };
  });
}

export function formatUkd(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return '—';
  return Math.round(val).toLocaleString('tr-TR');
}

export function formatDelta(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return '0';
  const rounded = Math.round(val * 10) / 10;
  const str = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  return rounded > 0 ? `+${str}` : str;
}

export const CHART_PALETTE = [
  '#38bdf8', // Sky
  '#f43f5e', // Rose
  '#10b981', // Emerald
  '#fbbf24', // Amber
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#eab308', // Yellow
];
