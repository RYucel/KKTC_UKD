import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Users, Search, X, TrendingUp } from 'lucide-react';
import { UkdDataset, PlayerSummary, MetricType } from '../types';
import { formatUkd, formatDelta, CHART_PALETTE } from '../utils';

interface CompareViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  // Default to top 3 rated players for quick initial insight
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const sorted = [...summaries].sort((a, b) => b.latestUkd - a.latestUkd);
    return sorted.slice(0, 3).map((s) => s.player.id);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [metric, setMetric] = useState<'ukd' | 'gain' | 'rank' | 'games'>('ukd');
  const searchRef = useRef<HTMLDivElement>(null);

  const selectedSummaries = useMemo(() => {
    return selectedIds
      .map((id) => summaries.find((s) => s.player.id === id))
      .filter((s): s is PlayerSummary => s !== undefined);
  }, [selectedIds, summaries]);

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return summaries
      .filter((s) => !selectedIds.includes(s.player.id) && s.searchStr.includes(q))
      .slice(0, 8);
  }, [searchQuery, summaries, selectedIds]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addPlayer = (id: string) => {
    if (selectedIds.length >= 12) return;
    if (!selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const removePlayer = (id: string) => {
    if (selectedIds.length <= 1) return;
    setSelectedIds(selectedIds.filter((pid) => pid !== id));
  };

  // ECharts Multi-line Option
  const chartOption = useMemo(() => {
    const dates = dataset.periods.map((p) => p.name);
    const isInverse = metric === 'rank';
    let yAxisName = 'UKD Puanı';
    if (metric === 'gain') yAxisName = 'Kümülatif Kazanç (Δ)';
    else if (metric === 'rank') yAxisName = 'Liste Sırası';
    else if (metric === 'games') yAxisName = 'Toplam Maç';

    const series = selectedSummaries.map((summary, idx) => {
      const color = CHART_PALETTE[idx % CHART_PALETTE.length];
      const p = summary.player;

      let data: (number | null)[] = [];
      if (metric === 'ukd') {
        data = p.u.map((v) => (v && v > 0 ? v : null));
      } else if (metric === 'gain') {
        const base = summary.firstUkd;
        data = p.u.map((v) => (v && v > 0 && base > 0 ? Math.round(v - base) : null));
      } else if (metric === 'rank') {
        data = p.r.map((v) => (v && v > 0 ? v : null));
      } else if (metric === 'games') {
        data = p.k.map((v) => v ?? 0);
      }

      return {
        name: p.n,
        type: 'line',
        data,
        smooth: true,
        showSymbol: selectedSummaries.length <= 4,
        symbolSize: 6,
        itemStyle: { color },
        lineStyle: { width: 3, color },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'Plus Jakarta Sans' },
      },
      legend: {
        data: selectedSummaries.map((s) => s.player.n),
        textStyle: { color: '#94a3b8' },
        top: 0,
      },
      grid: { left: 50, right: 30, top: 40, bottom: 40, containLabel: true },
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
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series,
    };
  }, [dataset.periods, selectedSummaries, metric]);

  return (
    <div>
      {/* Search and Player Chips */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="glass-card-header">
          <div className="card-title">
            <Users size={20} color="var(--accent-sky)" />
            Sporcu Karşılaştırma ({selectedSummaries.length}/12 Seçili)
          </div>
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
                  background: `${color}18`,
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
                <span style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                  ({formatUkd(s.latestUkd)})
                </span>
                {selectedSummaries.length > 1 && (
                  <button
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
          <div className="search-wrapper" ref={searchRef}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="input-field"
              placeholder="Karşılaştırmaya sporcu ekleyin... (İsim, lisans no)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
            />
            {dropdownOpen && searchResults.length > 0 && (
              <div className="search-results-dropdown">
                {searchResults.map((s) => (
                  <div
                    key={s.player.id}
                    className="search-item"
                    onClick={() => addPlayer(s.player.id)}
                  >
                    <div className="search-item-info">
                      <div className="search-item-name">
                        {s.player.n}{' '}
                        {s.player.t && (
                          <span className="badge badge-title" style={{ marginLeft: 6 }}>
                            {s.player.t}
                          </span>
                        )}
                      </div>
                      <div className="search-item-meta">
                        <span>Lisans: #{s.player.id}</span>
                        {s.currentClub && <span>• {s.currentClub}</span>}
                      </div>
                    </div>
                    <div className="search-item-ukd">{formatUkd(s.latestUkd)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Card */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <TrendingUp size={18} color="var(--accent-sky)" />
            Karşılaştırmalı Gelişim Grafiği
          </div>

          <div className="btn-group">
            <button
              className={`btn-group-item ${metric === 'ukd' ? 'active' : ''}`}
              onClick={() => setMetric('ukd')}
            >
              UKD Puanı
            </button>
            <button
              className={`btn-group-item ${metric === 'gain' ? 'active' : ''}`}
              onClick={() => setMetric('gain')}
            >
              Kümülatif Net Kazanç (Δ)
            </button>
            <button
              className={`btn-group-item ${metric === 'rank' ? 'active' : ''}`}
              onClick={() => setMetric('rank')}
            >
              Sıralama (Rank)
            </button>
            <button
              className={`btn-group-item ${metric === 'games' ? 'active' : ''}`}
              onClick={() => setMetric('games')}
            >
              Toplam Maç
            </button>
          </div>
        </div>

        <div style={{ height: 420, width: '100%' }}>
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
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
                <th>Ünvan</th>
                <th>Kulüp</th>
                <th className="text-right">Güncel UKD</th>
                <th className="text-right">Son Değişim</th>
                <th className="text-right">Kariyer Zirvesi</th>
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
                          }}
                        />
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            textAlign: 'left',
                          }}
                          onClick={() => onSelectPlayer(s.player.id)}
                        >
                          {s.player.n}
                        </button>
                      </div>
                    </td>
                    <td>{s.player.t ? <span className="badge badge-title">{s.player.t}</span> : '—'}</td>
                    <td>{s.currentClub || '—'}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(s.latestUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className={`delta-badge ${s.latestChange > 0 ? 'delta-pos' : s.latestChange < 0 ? 'delta-neg' : 'delta-zero'}`}>
                        {formatDelta(s.latestChange)}
                      </span>
                    </td>
                    <td className="text-right font-mono">{formatUkd(s.peakUkd)}</td>
                    <td className="text-right font-mono">
                      <span className={`delta-badge ${s.totalChange >= 0 ? 'delta-pos' : 'delta-neg'}`}>
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
