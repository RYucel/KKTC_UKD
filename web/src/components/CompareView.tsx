import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Users, Search, X, TrendingUp } from 'lucide-react';
import { UkdDataset, PlayerSummary } from '../types';
import { formatUkd, formatDelta, CHART_PALETTE, normalizeTr } from '../utils';

interface CompareViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  // Default to top 3 active players with rich local match history
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const active = [...summaries]
      .filter((s) => s.careerGames >= 15 && s.ratedCount >= 10)
      .sort((a, b) => b.latestUkd - a.latestUkd);
    const pool = active.length >= 3 ? active : [...summaries].sort((a, b) => b.latestUkd - a.latestUkd);
    return pool.slice(0, 3).map((s) => s.player.id);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [metric, setMetric] = useState<'ukd' | 'gain' | 'rank' | 'games'>('ukd');
  const [rangeMode, setRangeMode] = useState<'all' | '12m' | '6p'>('all');

  const selectedSummaries = useMemo(() => {
    return selectedIds
      .map((id) => summaries.find((s) => s.player.id === id))
      .filter((s): s is PlayerSummary => s !== undefined);
  }, [selectedIds, summaries]);

  // Turkish-normalized search filter
  const searchResults = useMemo(() => {
    const q = normalizeTr(searchQuery);
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return summaries
      .filter((s) => !selectedIds.includes(s.player.id) && tokens.every((tok) => s.searchStr.includes(tok)))
      .sort((a, b) => b.latestUkd - a.latestUkd)
      .slice(0, 20);
  }, [searchQuery, summaries, selectedIds]);

  const addPlayer = (id: string) => {
    if (selectedIds.length >= 12) return;
    if (!selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
    setSearchQuery('');
    setHighlightIdx(0);
  };

  const removePlayer = (id: string) => {
    if (selectedIds.length <= 1) return;
    setSelectedIds(selectedIds.filter((pid) => pid !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) {
      if (e.key === 'Escape') setSearchQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchResults[highlightIdx] || searchResults[0];
      if (target) addPlayer(target.player.id);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  };

  const periodSlice = useMemo(() => {
    const total = dataset.periods.length;
    if (rangeMode === '6p') return Math.max(0, total - 6);
    if (rangeMode === '12m') return Math.max(0, total - 12);
    return 0;
  }, [rangeMode, dataset.periods.length]);

  const displayedPeriods = dataset.periods.slice(periodSlice);
  const periodIndices = displayedPeriods.map((_, idx) => idx + periodSlice);

  // ECharts Multi-line Option
  const chartOption = useMemo(() => {
    const dates = displayedPeriods.map((p) => p.name);
    const isInverse = metric === 'rank';
    let yAxisName = 'UKD Puanı';
    if (metric === 'gain') yAxisName = 'Kümülatif Net Kazanç (Δ)';
    else if (metric === 'rank') yAxisName = 'Liste Sırası (1 = En Üst)';
    else if (metric === 'games') yAxisName = 'Toplam Maç';

    const series = selectedSummaries.map((summary, idx) => {
      const color = CHART_PALETTE[idx % CHART_PALETTE.length];
      const p = summary.player;

      let data: (number | null)[] = [];
      if (metric === 'ukd') {
        data = periodIndices.map((i) => (p.u[i] && p.u[i]! > 0 ? p.u[i] : null));
      } else if (metric === 'gain') {
        // First valid rating inside the selected window or career
        const firstValid = periodIndices.map((i) => p.u[i]).find((v) => v !== null && v > 0) ?? summary.firstUkd;
        data = periodIndices.map((i) => {
          const v = p.u[i];
          return v && v > 0 && firstValid > 0 ? Math.round((v - firstValid) * 10) / 10 : null;
        });
      } else if (metric === 'rank') {
        data = periodIndices.map((i) => (p.r[i] && p.r[i]! > 0 ? p.r[i] : null));
      } else if (metric === 'games') {
        data = periodIndices.map((i) => p.k[i] ?? 0);
      }

      return {
        name: p.n,
        type: 'line',
        connectNulls: true,
        data,
        smooth: true,
        showSymbol: selectedSummaries.length <= 5,
        symbolSize: 6,
        itemStyle: { color },
        lineStyle: { width: 3, color },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(13, 20, 34, 0.96)',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'Plus Jakarta Sans' },
      },
      legend: {
        data: selectedSummaries.map((s) => s.player.n),
        textStyle: { color: '#cbd5e1', fontSize: 12 },
        top: 0,
      },
      grid: { left: 50, right: 30, top: 45, bottom: 45, containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        inverse: isInverse,
        scale: metric === 'ukd' || metric === 'rank',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series,
    };
  }, [displayedPeriods, periodIndices, selectedSummaries, metric]);

  return (
    <div>
      {/* In-Flow Search and Player Chips Panel */}
      <div className="search-panel">
        <div className="search-panel-header">
          <div className="search-label">
            <Users size={16} />
            <span>Çoklu Sporcu Karşılaştırma ({selectedSummaries.length} / 12 Sporcu Seçili)</span>
          </div>
          <div className="search-hint">Grafikte karşılaştırmak için sporcu ekleyin veya çıkarın</div>
        </div>

        {/* Selected Chips */}
        <div className="chips-container">
          {selectedSummaries.map((s, idx) => {
            const color = CHART_PALETTE[idx % CHART_PALETTE.length];
            return (
              <div
                key={s.player.id}
                className="player-chip"
                style={{
                  background: `${color}1f`,
                  borderColor: color,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    display: 'inline-block',
                  }}
                />
                <span>{s.player.n}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
                  ({formatUkd(s.latestUkd)})
                </span>
                {selectedSummaries.length > 1 && (
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() => removePlayer(s.player.id)}
                    title="Kaldır"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Player Input */}
        {selectedSummaries.length < 12 && (
          <>
            <div className="search-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="input-field"
                placeholder="Karşılaştırmaya sporcu eklemek için isim, lisans no veya kulüp yazın..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightIdx(0);
                }}
                onKeyDown={handleKeyDown}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Aramayı temizle"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* In-Flow Search Results List */}
            {searchQuery.trim().length > 0 && (
              <div className="search-results-panel">
                <div className="search-results-header">
                  <span>
                    {searchResults.length > 0
                      ? `${searchResults.length} eşleşen sporcu bulundu — eklemek için tıklayın:`
                      : `"${searchQuery}" ile eşleşen başka sporcu bulunamadı.`}
                  </span>
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-sky)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                    onClick={() => setSearchQuery('')}
                  >
                    Kapat (Esc)
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="search-results-list">
                    {searchResults.map((s, idx) => (
                      <div
                        key={s.player.id}
                        className={`search-item ${idx === highlightIdx ? 'selected' : ''}`}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        onClick={() => addPlayer(s.player.id)}
                      >
                        <div className="search-item-info">
                          <div className="search-item-name">
                            <span>+ {s.player.n}</span>
                            {s.player.t && <span className="badge badge-title">{s.player.t}</span>}
                            {s.currentClub && <span className="badge badge-club">{s.currentClub}</span>}
                          </div>
                          <div className="search-item-meta">
                            <span>Lisans: #{s.player.id}</span>
                            <span>• Maç: {s.careerGames}</span>
                          </div>
                        </div>
                        <div className="search-item-right">
                          <div className="search-item-ukd">{formatUkd(s.latestUkd)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chart Card */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <TrendingUp size={18} color="var(--accent-sky)" />
            <span>Karşılaştırmalı Gelişim Grafiği</span>
          </div>

          <div className="controls-row">
            <div className="btn-group">
              <button
                type="button"
                className={`btn-group-item ${metric === 'ukd' ? 'active' : ''}`}
                onClick={() => setMetric('ukd')}
              >
                UKD Puanı
              </button>
              <button
                type="button"
                className={`btn-group-item ${metric === 'gain' ? 'active' : ''}`}
                onClick={() => setMetric('gain')}
              >
                Kümülatif Net Kazanç (Δ)
              </button>
              <button
                type="button"
                className={`btn-group-item ${metric === 'rank' ? 'active' : ''}`}
                onClick={() => setMetric('rank')}
              >
                Sıralama (Rank)
              </button>
              <button
                type="button"
                className={`btn-group-item ${metric === 'games' ? 'active' : ''}`}
                onClick={() => setMetric('games')}
              >
                Toplam Maç
              </button>
            </div>

            <div className="btn-group">
              <button
                type="button"
                className={`btn-group-item ${rangeMode === 'all' ? 'active' : ''}`}
                onClick={() => setRangeMode('all')}
              >
                Tümü
              </button>
              <button
                type="button"
                className={`btn-group-item ${rangeMode === '12m' ? 'active' : ''}`}
                onClick={() => setRangeMode('12m')}
              >
                Son 12 Ay
              </button>
              <button
                type="button"
                className={`btn-group-item ${rangeMode === '6p' ? 'active' : ''}`}
                onClick={() => setRangeMode('6p')}
              >
                Son 6 Dönem
              </button>
            </div>
          </div>
        </div>

        <div style={{ height: 420, width: '100%' }}>
          <ReactECharts option={chartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* Comparison Head-to-Head Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">Yan Yana İstatistik Özeti</div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sporcu</th>
                <th>Lisans</th>
                <th>Ünvan</th>
                <th>Kulüp</th>
                <th className="text-right">Güncel UKD</th>
                <th className="text-right">Son Değişim</th>
                <th className="text-right">Kariyer Zirvesi</th>
                <th className="text-right">İlk UKD</th>
                <th className="text-right">Net Gelişim</th>
                <th className="text-right">Toplam Maç</th>
                <th className="text-right">En İyi Sıra</th>
              </tr>
            </thead>
            <tbody>
              {selectedSummaries.map((s, idx) => {
                const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                return (
                  <tr key={s.player.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: color,
                            flexShrink: 0,
                          }}
                        />
                        <button
                          type="button"
                          className="player-link-btn"
                          onClick={() => onSelectPlayer(s.player.id)}
                        >
                          {s.player.n}
                        </button>
                      </div>
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      #{s.player.id}
                    </td>
                    <td>{s.player.t ? <span className="badge badge-title">{s.player.t}</span> : '—'}</td>
                    <td>{s.currentClub || 'Bireysel'}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(s.latestUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span
                        className={`delta-badge ${
                          s.latestChange > 0 ? 'delta-pos' : s.latestChange < 0 ? 'delta-neg' : 'delta-zero'
                        }`}
                      >
                        {formatDelta(s.latestChange)}
                      </span>
                    </td>
                    <td className="text-right font-mono">{formatUkd(s.peakUkd)}</td>
                    <td className="text-right font-mono">{formatUkd(s.firstUkd)}</td>
                    <td className="text-right font-mono">
                      <span
                        className={`delta-badge ${
                          s.totalChange > 0 ? 'delta-pos' : s.totalChange < 0 ? 'delta-neg' : 'delta-zero'
                        }`}
                      >
                        {formatDelta(s.totalChange)}
                      </span>
                    </td>
                    <td className="text-right font-mono">{s.careerGames}</td>
                    <td className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {s.bestRank > 0 ? `#${s.bestRank}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
