import React, { useState, useMemo } from 'react';
import { Trophy, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { UkdDataset, PlayerSummary } from '../types';
import { formatUkd, formatDelta } from '../utils';

interface LeaderboardViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  const nPeriods = dataset.periods.length;
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(Math.max(0, nPeriods - 1));
  const [searchQuery, setSearchQuery] = useState('');
  const [titleFilter, setTitleFilter] = useState('all');
  const [clubFilter, setClubFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'E' | 'K'>('all');
  const [visaFilter, setVisaFilter] = useState<'all' | 'Vizeli' | 'Vizesiz'>('all');
  const [onlyRated, setOnlyRated] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const currentPeriod = dataset.periods[selectedPeriodIdx];

  // Titles list
  const availableTitles = useMemo(() => {
    const set = new Set<string>();
    dataset.players.forEach((p) => {
      if (p.t) set.add(p.t);
    });
    return Array.from(set).sort();
  }, [dataset.players]);

  // Compute period leaderboard
  const periodRows = useMemo(() => {
    const rows = [];
    const q = searchQuery.toLowerCase().trim();

    for (let i = 0; i < dataset.players.length; i++) {
      const p = dataset.players[i];
      const u = p.u[selectedPeriodIdx];
      const r = p.r[selectedPeriodIdx];
      const d = p.d[selectedPeriodIdx];
      const m = p.m[selectedPeriodIdx];
      const k = p.k[selectedPeriodIdx];
      const cIdx = p.c[selectedPeriodIdx];
      const club = cIdx >= 0 && cIdx < dataset.clubs.length ? dataset.clubs[cIdx] : '';

      // Skip unlisted in that period
      if (u === null && r === null) continue;
      if (onlyRated && (!u || u <= 0)) continue;

      if (titleFilter !== 'all' && p.t !== titleFilter) continue;
      if (clubFilter !== 'all' && club !== clubFilter) continue;
      if (genderFilter !== 'all' && p.g !== genderFilter) continue;
      if (visaFilter !== 'all' && p.s !== visaFilter) continue;

      if (q) {
        const str = `${p.n} ${p.id} ${club} ${p.t}`.toLowerCase();
        if (!str.includes(q)) continue;
      }

      rows.push({
        player: p,
        ukd: u ?? 0,
        rank: r ?? 999999,
        delta: d ?? 0,
        matches: m ?? 0,
        totalMatches: k ?? 0,
        club,
      });
    }

    // Sort by rank or ukd descending
    return rows.sort((a, b) => {
      if (a.ukd !== b.ukd) return b.ukd - a.ukd;
      return a.rank - b.rank;
    });
  }, [dataset, selectedPeriodIdx, onlyRated, titleFilter, clubFilter, genderFilter, visaFilter, searchQuery]);

  const totalPages = Math.ceil(periodRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return periodRows.slice(start, start + pageSize);
  }, [periodRows, page, pageSize]);

  return (
    <div>
      {/* Filters and Period Selection */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="glass-card-header">
          <div className="card-title">
            <Trophy size={20} color="var(--accent-amber)" />
            Resmi UKD Genel Sıralaması
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Dönem:
            </label>
            <select
              className="select-control"
              value={selectedPeriodIdx}
              onChange={(e) => {
                setSelectedPeriodIdx(Number(e.target.value));
                setPage(1);
              }}
              style={{ minWidth: 220 }}
            >
              {[...dataset.periods].reverse().map((p, revI) => {
                const actualIdx = dataset.periods.length - 1 - revI;
                return (
                  <option key={p.id} value={actualIdx}>
                    {p.name} ({p.date})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="controls-row" style={{ gap: 12 }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="input-field"
              placeholder="İsim, lisans no veya kulüp ara..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Title */}
          <select
            className="select-control"
            value={titleFilter}
            onChange={(e) => {
              setTitleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tüm Ünvanlar</option>
            {availableTitles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Club */}
          <select
            className="select-control"
            value={clubFilter}
            onChange={(e) => {
              setClubFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tüm Kulüpler</option>
            {dataset.clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Gender */}
          <select
            className="select-control"
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">Cinsiyet (Tümü)</option>
            <option value="E">Yalnızca Erkek</option>
            <option value="K">Yalnızca Kadın</option>
          </select>

          {/* Visa */}
          <select
            className="select-control"
            value={visaFilter}
            onChange={(e) => {
              setVisaFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">Vize (Tümü)</option>
            <option value="Vizeli">Vizeli</option>
            <option value="Vizesiz">Vizesiz</option>
          </select>

          {/* Only Rated Checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={onlyRated}
              onChange={(e) => {
                setOnlyRated(e.target.checked);
                setPage(1);
              }}
            />
            Yalnızca Dereceli (UKD &gt; 0)
          </label>
        </div>

        {/* Period Summary Stats */}
        <div style={{ marginTop: 16, display: 'flex', gap: 16, color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <span>Filtrelenen Sporcu: <strong style={{ color: '#fff' }}>{periodRows.length.toLocaleString('tr-TR')}</strong></span>
          {currentPeriod.tournaments.length > 0 && (
            <span>Dahil Turnuva: <strong style={{ color: 'var(--accent-sky)' }}>{currentPeriod.tournaments.length}</strong></span>
          )}
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <div className="glass-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Sıra</th>
                <th>Sporcu</th>
                <th>Lisans No</th>
                <th>Ünvan</th>
                <th>Kulüp</th>
                <th className="text-right">UKD Puanı</th>
                <th className="text-right">Dönem Δ</th>
                <th className="text-right">Dönem Maç</th>
                <th className="text-right">Kümülatif Maç</th>
                <th>Cinsiyet</th>
                <th>Vize</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => {
                const globalIndex = (page - 1) * pageSize + idx + 1;
                return (
                  <tr key={row.player.id}>
                    <td className="font-mono" style={{ color: globalIndex <= 3 ? 'var(--accent-amber)' : 'var(--text-secondary)', fontWeight: 700 }}>
                      #{globalIndex}
                    </td>
                    <td>
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.92rem',
                        }}
                        onClick={() => onSelectPlayer(row.player.id)}
                      >
                        {row.player.n}
                      </button>
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      #{row.player.id}
                    </td>
                    <td>{row.player.t ? <span className="badge badge-title">{row.player.t}</span> : '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.club || '—'}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 800, color: 'var(--accent-sky)', fontSize: '1rem' }}>
                      {formatUkd(row.ukd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className={`delta-badge ${row.delta > 0 ? 'delta-pos' : row.delta < 0 ? 'delta-neg' : 'delta-zero'}`}>
                        {formatDelta(row.delta)}
                      </span>
                    </td>
                    <td className="text-right font-mono">{row.matches}</td>
                    <td className="text-right font-mono">{row.totalMatches}</td>
                    <td>{row.player.g === 'E' ? 'Erkek' : row.player.g === 'K' ? 'Kadın' : '—'}</td>
                    <td>
                      <span className={`badge ${row.player.s === 'Vizeli' ? 'badge-active' : 'badge-inactive'}`}>
                        {row.player.s || 'Vizesiz'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Sayfa {page} / {totalPages} (Toplam {periodRows.length} kayıt)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-group-item"
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)' }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Önceki
              </button>
              <button
                className="btn-group-item"
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)' }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sonraki <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
