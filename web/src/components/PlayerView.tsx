import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Search, Trophy, TrendingUp, Calendar, Swords, Award, ChevronDown } from 'lucide-react';
import { UkdDataset, PlayerSummary, MetricType } from '../types';
import { formatUkd, formatDelta } from '../utils';

interface PlayerViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  selectedId: string | null;
  onSelectPlayer: (id: string) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  dataset,
  summaries,
  selectedId,
  onSelectPlayer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [metric, setMetric] = useState<MetricType>('ukd');
  const [rangeMode, setRangeMode] = useState<'all' | '12m' | '3p'>('all');
  const searchRef = useRef<HTMLDivElement>(null);

  // Default to the highest rated active player if none selected
  const activeSummary = useMemo(() => {
    if (selectedId) {
      const found = summaries.find((s) => s.player.id === selectedId);
      if (found) return found;
    }
    // Highest rated active player fallback
    return [...summaries].sort((a, b) => b.latestUkd - a.latestUkd)[0];
  }, [selectedId, summaries]);

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return summaries
      .filter((s) => s.searchStr.includes(q))
      .slice(0, 10);
  }, [searchQuery, summaries]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!activeSummary) return null;

  const { player, latestUkd, latestChange, peakUkd, peakPeriodIndex, firstUkd, firstPeriodIndex, totalChange, careerGames, latestRank, bestRank, ratedCount, currentClub } = activeSummary;

  // Filter periods based on range
  const periodSlice = useMemo(() => {
    const total = dataset.periods.length;
    if (rangeMode === '3p') return Math.max(0, total - 3);
    if (rangeMode === '12m') return Math.max(0, total - 12);
    return 0;
  }, [rangeMode, dataset.periods.length]);

  const displayedPeriods = dataset.periods.slice(periodSlice);
  const periodIndices = displayedPeriods.map((_, idx) => idx + periodSlice);

  // ECharts Option
  const chartOption = useMemo(() => {
    const dates = displayedPeriods.map((p) => p.name);
    let seriesData: (number | null)[] = [];
    let yAxisName = 'UKD';
    let isInverse = false;

    if (metric === 'ukd') {
      seriesData = periodIndices.map((i) => (player.u[i] && player.u[i]! > 0 ? player.u[i] : null));
      yAxisName = 'UKD Puanı';
    } else if (metric === 'change') {
      seriesData = periodIndices.map((i) => player.d[i] ?? 0);
      yAxisName = 'Değişim';
    } else if (metric === 'rank') {
      seriesData = periodIndices.map((i) => (player.r[i] && player.r[i]! > 0 ? player.r[i] : null));
      yAxisName = 'Sıralama';
      isInverse = true;
    } else if (metric === 'games') {
      seriesData = periodIndices.map((i) => player.k[i] ?? 0);
      yAxisName = 'Kümülatif Maç';
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'Plus Jakarta Sans' },
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          const p = params[0];
          const periodIdx = periodSlice + p.dataIndex;
          const periodObj = dataset.periods[periodIdx];
          const ukdVal = player.u[periodIdx];
          const deltaVal = player.d[periodIdx];
          const rankVal = player.r[periodIdx];
          const matchVal = player.m[periodIdx];
          const tournaments = periodObj?.tournaments || [];

          return `
            <div style="min-width: 200px; padding: 4px;">
              <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px;">${periodObj?.name} (${periodObj?.date})</div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
                <span style="color: #94a3b8;">UKD:</span>
                <span style="font-family: JetBrains Mono; font-weight: 700;">${formatUkd(ukdVal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
                <span style="color: #94a3b8;">Değişim:</span>
                <span style="font-family: JetBrains Mono; font-weight: 700; color: ${(deltaVal ?? 0) >= 0 ? '#10b981' : '#f43f5e'}">${formatDelta(deltaVal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
                <span style="color: #94a3b8;">Sıra:</span>
                <span style="font-family: JetBrains Mono;">#${rankVal ?? '—'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                <span style="color: #94a3b8;">Dönem Maçı:</span>
                <span style="font-family: JetBrains Mono;">${matchVal ?? 0}</span>
              </div>
              ${
                tournaments.length > 0
                  ? `<div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; font-size: 11px; color: #cbd5e1;">
                      <div style="font-weight: 600; color: #94a3b8; margin-bottom: 2px;">Dahil Turnuvalar (${tournaments.length}):</div>
                      ${tournaments.map((t) => `• ${t}`).slice(0, 4).join('<br/>')}
                      ${tournaments.length > 4 ? `<i>+${tournaments.length - 4} turnuva daha</i>` : ''}
                     </div>`
                  : ''
              }
            </div>
          `;
        },
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
      series: [
        {
          name: yAxisName,
          type: metric === 'change' ? 'bar' : 'line',
          data: seriesData,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          itemStyle: {
            color: metric === 'change' ? (params: any) => (params.value >= 0 ? '#10b981' : '#f43f5e') : '#38bdf8',
          },
          lineStyle: { width: 3, color: '#38bdf8' },
          areaStyle:
            metric === 'ukd'
              ? {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: 'rgba(56, 189, 248, 0.28)' },
                      { offset: 1, color: 'rgba(56, 189, 248, 0.0)' },
                    ],
                  },
                }
              : undefined,
        },
      ],
    };
  }, [displayedPeriods, periodIndices, player, metric, periodSlice, dataset.periods]);

  return (
    <div>
      {/* Search Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px' }} ref={searchRef}>
        <div className="search-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="input-field"
            placeholder="Sporcu adı, lisans numarası veya kulüp ara... (Örn: Hüseyin, 1002, GMBŞK)"
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
                  className={`search-item ${s.player.id === activeSummary.player.id ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectPlayer(s.player.id);
                    setDropdownOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="search-item-info">
                    <div className="search-item-name">
                      {s.player.n} {s.player.t && <span className="badge badge-title" style={{ marginLeft: 6 }}>{s.player.t}</span>}
                    </div>
                    <div className="search-item-meta">
                      <span>Lisans: #{s.player.id}</span>
                      {s.currentClub && <span>• {s.currentClub}</span>}
                      {s.player.b && <span>• D.Yılı: {s.player.b}</span>}
                    </div>
                  </div>
                  <div className="search-item-ukd">{formatUkd(s.latestUkd)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Player Header Banner */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{player.n}</h1>
              {player.t && <span className="badge badge-title">{player.t}</span>}
              {currentClub && <span className="badge badge-club">{currentClub}</span>}
              <span className={`badge ${player.s === 'Vizeli' ? 'badge-active' : 'badge-inactive'}`}>{player.s || 'Vizesiz'}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span>Lisans No: <strong style={{ color: '#fff' }}>#{player.id}</strong></span>
              {player.b && <span>Doğum Yılı: <strong style={{ color: '#fff' }}>{player.b}</strong></span>}
              {player.g && <span>Cinsiyet: <strong style={{ color: '#fff' }}>{player.g === 'E' ? 'Erkek' : 'Kadın'}</strong></span>}
              {player.f && <span>FIDE ID: <strong style={{ color: '#fff' }}>{player.f}</strong></span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Güncel UKD</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-sky)', lineHeight: 1.1 }}>
              {formatUkd(latestUkd)}
            </div>
            <div style={{ marginTop: 4 }}>
              <span className={`delta-badge ${latestChange > 0 ? 'delta-pos' : latestChange < 0 ? 'delta-neg' : 'delta-zero'}`}>
                {formatDelta(latestChange)} son dönem
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics 8-Card Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Kariyer Zirvesi</div>
          <div className="metric-value-row">
            <span className="metric-value">{formatUkd(peakUkd)}</span>
          </div>
          <div className="metric-sub">{peakPeriodIndex >= 0 ? dataset.periods[peakPeriodIndex]?.name : '—'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">İlk Kayıt UKD</div>
          <div className="metric-value-row">
            <span className="metric-value">{formatUkd(firstUkd)}</span>
          </div>
          <div className="metric-sub">{firstPeriodIndex >= 0 ? dataset.periods[firstPeriodIndex]?.name : '—'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Toplam Net Değişim</div>
          <div className="metric-value-row">
            <span className="metric-value">{formatDelta(totalChange)}</span>
            <span className={`delta-badge ${totalChange >= 0 ? 'delta-pos' : 'delta-neg'}`}>
              {totalChange >= 0 ? 'Gelişim' : 'Düşüş'}
            </span>
          </div>
          <div className="metric-sub">İlk listeden bugüne</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Kariyer Toplam Maç</div>
          <div className="metric-value-row">
            <span className="metric-value">{careerGames}</span>
          </div>
          <div className="metric-sub">Resmi federasyon maçı</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">En İyi Sıralama</div>
          <div className="metric-value-row">
            <span className="metric-value">#{bestRank > 0 ? bestRank : '—'}</span>
          </div>
          <div className="metric-sub">KKSF genel liste rekoru</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Güncel Sıralama</div>
          <div className="metric-value-row">
            <span className="metric-value">#{latestRank > 0 ? latestRank : '—'}</span>
          </div>
          <div className="metric-sub">Son yayınlanan liste</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Aktif Dönem Sayısı</div>
          <div className="metric-value-row">
            <span className="metric-value">{ratedCount}</span>
          </div>
          <div className="metric-sub">/ {dataset.periods.length} dönemde dereceli</div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <TrendingUp size={20} color="var(--accent-sky)" />
            Gelişim Grafiği
          </div>

          <div className="controls-row">
            {/* Metric Selector */}
            <div className="btn-group">
              <button
                className={`btn-group-item ${metric === 'ukd' ? 'active' : ''}`}
                onClick={() => setMetric('ukd')}
              >
                UKD Puanı
              </button>
              <button
                className={`btn-group-item ${metric === 'change' ? 'active' : ''}`}
                onClick={() => setMetric('change')}
              >
                Değişim (Δ)
              </button>
              <button
                className={`btn-group-item ${metric === 'rank' ? 'active' : ''}`}
                onClick={() => setMetric('rank')}
              >
                Liste Sırası
              </button>
              <button
                className={`btn-group-item ${metric === 'games' ? 'active' : ''}`}
                onClick={() => setMetric('games')}
              >
                Toplam Maç
              </button>
            </div>

            {/* Range Selector */}
            <div className="btn-group">
              <button
                className={`btn-group-item ${rangeMode === 'all' ? 'active' : ''}`}
                onClick={() => setRangeMode('all')}
              >
                Tümü
              </button>
              <button
                className={`btn-group-item ${rangeMode === '12m' ? 'active' : ''}`}
                onClick={() => setRangeMode('12m')}
              >
                Son 12 Ay
              </button>
              <button
                className={`btn-group-item ${rangeMode === '3p' ? 'active' : ''}`}
                onClick={() => setRangeMode('3p')}
              >
                Son 3 Dönem
              </button>
            </div>
          </div>
        </div>

        <div style={{ height: 380, width: '100%' }}>
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Calendar size={18} color="var(--accent-sky)" />
            Dönem Detayları ve Turnuvalar
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Toplam {displayedPeriods.length} dönem listeleniyor
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: 420 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dönem</th>
                <th>Tarih</th>
                <th className="text-right">UKD</th>
                <th className="text-right">Değişim</th>
                <th className="text-right">Sıra</th>
                <th className="text-right">Maç</th>
                <th className="text-right">Top. Maç</th>
                <th>Kulüp</th>
                <th>Dahil Turnuvalar</th>
              </tr>
            </thead>
            <tbody>
              {[...periodIndices].reverse().map((idx) => {
                const per = dataset.periods[idx];
                const u = player.u[idx];
                const d = player.d[idx];
                const r = player.r[idx];
                const m = player.m[idx];
                const k = player.k[idx];
                const cIdx = player.c[idx];
                const club = cIdx >= 0 && cIdx < dataset.clubs.length ? dataset.clubs[cIdx] : '—';
                const tournaments = per.tournaments || [];

                return (
                  <tr key={per.id}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{per.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{per.date}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(u)}
                    </td>
                    <td className="text-right font-mono">
                      <span className={`delta-badge ${(d ?? 0) > 0 ? 'delta-pos' : (d ?? 0) < 0 ? 'delta-neg' : 'delta-zero'}`}>
                        {formatDelta(d)}
                      </span>
                    </td>
                    <td className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {r ? `#${r}` : '—'}
                    </td>
                    <td className="text-right font-mono">{m ?? 0}</td>
                    <td className="text-right font-mono">{k ?? 0}</td>
                    <td>{club}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 300 }}>
                      {tournaments.length > 0 ? tournaments.join(', ') : '—'}
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
