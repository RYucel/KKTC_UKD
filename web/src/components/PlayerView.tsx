import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Search, TrendingUp, Calendar, X, UserCheck } from 'lucide-react';
import { UkdDataset, PlayerSummary, MetricType } from '../types';
import { formatUkd, formatDelta, normalizeTr } from '../utils';

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
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [metric, setMetric] = useState<MetricType>('ukd');
  const [rangeMode, setRangeMode] = useState<'all' | '12m' | '3p' | 'custom'>('all');
  const [customStartIdx, setCustomStartIdx] = useState(0);
  const [customEndIdx, setCustomEndIdx] = useState(Math.max(0, dataset.periods.length - 1));

  // Top active players with rich game history for quick picks & default selection
  const featuredPlayers = useMemo(() => {
    return [...summaries]
      .filter((s) => s.careerGames >= 15 && s.ratedCount >= 10)
      .sort((a, b) => b.latestUkd - a.latestUkd)
      .slice(0, 6);
  }, [summaries]);

  // Default to the highest-rated active player with rich match history if none selected
  const activeSummary = useMemo(() => {
    if (selectedId) {
      const found = summaries.find((s) => s.player.id === selectedId);
      if (found) return found;
    }
    if (featuredPlayers.length > 0) return featuredPlayers[0];
    return [...summaries].sort((a, b) => b.latestUkd - a.latestUkd)[0];
  }, [selectedId, summaries, featuredPlayers]);

  // Turkish-normalized search filter
  const searchResults = useMemo(() => {
    const q = normalizeTr(searchQuery);
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return summaries
      .filter((s) => tokens.every((tok) => s.searchStr.includes(tok)))
      .sort((a, b) => b.latestUkd - a.latestUkd)
      .slice(0, 25);
  }, [searchQuery, summaries]);

  const handleChoosePlayer = (id: string) => {
    onSelectPlayer(id);
    setSearchQuery('');
    setHighlightIdx(0);
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
      if (target) handleChoosePlayer(target.player.id);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  };

  if (!activeSummary) return null;

  const {
    player,
    latestUkd,
    latestChange,
    peakUkd,
    peakPeriodIndex,
    firstUkd,
    firstPeriodIndex,
    totalChange,
    careerGames,
    latestRank,
    bestRank,
    ratedCount,
    currentClub,
  } = activeSummary;

  // Determine period index slice
  const periodIndices = useMemo(() => {
    const total = dataset.periods.length;
    let start = 0;
    let end = total - 1;
    if (rangeMode === '3p') {
      start = Math.max(0, total - 3);
    } else if (rangeMode === '12m') {
      start = Math.max(0, total - 12);
    } else if (rangeMode === 'custom') {
      start = Math.min(customStartIdx, customEndIdx);
      end = Math.max(customStartIdx, customEndIdx);
    }
    const indices: number[] = [];
    for (let i = start; i <= end; i++) {
      indices.push(i);
    }
    return indices;
  }, [rangeMode, dataset.periods.length, customStartIdx, customEndIdx]);

  const displayedPeriods = useMemo(
    () => periodIndices.map((i) => dataset.periods[i]),
    [periodIndices, dataset.periods]
  );

  // ECharts Option
  const chartOption = useMemo(() => {
    const dates = displayedPeriods.map((p) => p.name);
    let seriesData: (number | null)[] = [];
    let yAxisName = 'UKD Puanı';
    let isInverse = false;

    if (metric === 'ukd') {
      seriesData = periodIndices.map((i) => (player.u[i] && player.u[i]! > 0 ? player.u[i] : null));
      yAxisName = 'UKD Puanı';
    } else if (metric === 'change') {
      seriesData = periodIndices.map((i) => player.d[i] ?? 0);
      yAxisName = 'Dönemsel Değişim';
    } else if (metric === 'rank') {
      seriesData = periodIndices.map((i) => (player.r[i] && player.r[i]! > 0 ? player.r[i] : null));
      yAxisName = 'Liste Sırası (1 = En Üst)';
      isInverse = true;
    } else if (metric === 'games') {
      seriesData = periodIndices.map((i) => player.k[i] ?? 0);
      yAxisName = 'Kümülatif Maç';
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(13, 20, 34, 0.96)',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'Plus Jakarta Sans' },
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          const p = params[0];
          const periodIdx = periodIndices[p.dataIndex];
          const periodObj = dataset.periods[periodIdx];
          if (!periodObj) return '';
          const ukdVal = player.u[periodIdx];
          const deltaVal = player.d[periodIdx];
          const rankVal = player.r[periodIdx];
          const matchVal = player.m[periodIdx];
          const cumMatchVal = player.k[periodIdx];
          const tournaments = periodObj.tournaments || [];

          return `
            <div style="min-width: 210px; max-width: 320px; padding: 4px; white-space: normal;">
              <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px;">${periodObj.name} (${periodObj.date})</div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
                <span style="color: #94a3b8;">UKD:</span>
                <span style="font-family: JetBrains Mono; font-weight: 700;">${formatUkd(ukdVal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
                <span style="color: #94a3b8;">Değişim:</span>
                <span style="font-family: JetBrains Mono; font-weight: 700; color: ${(deltaVal ?? 0) > 0 ? '#10b981' : (deltaVal ?? 0) < 0 ? '#f43f5e' : '#94a3b8'}">${formatDelta(deltaVal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
                <span style="color: #94a3b8;">Sıra:</span>
                <span style="font-family: JetBrains Mono;">${rankVal ? '#' + rankVal : '—'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                <span style="color: #94a3b8;">Dönem / Top. Maç:</span>
                <span style="font-family: JetBrains Mono;">${matchVal ?? 0} / ${cumMatchVal ?? 0}</span>
              </div>
              ${
                tournaments.length > 0
                  ? `<div style="border-top: 1px solid rgba(255,255,255,0.12); padding-top: 6px; font-size: 11px; color: #cbd5e1;">
                      <div style="font-weight: 600; color: #94a3b8; margin-bottom: 2px;">Turnuvalar (${tournaments.length}):</div>
                      ${tournaments.map((t) => `• ${t}`).slice(0, 4).join('<br/>')}
                      ${tournaments.length > 4 ? `<br/><i>+${tournaments.length - 4} turnuva daha</i>` : ''}
                     </div>`
                  : ''
              }
            </div>
          `;
        },
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
      series: [
        {
          name: yAxisName,
          type: metric === 'change' ? 'bar' : 'line',
          connectNulls: true,
          data: seriesData,
          smooth: metric !== 'change',
          showSymbol: true,
          symbolSize: 7,
          itemStyle: {
            color:
              metric === 'change'
                ? (params: any) => (params.value >= 0 ? '#10b981' : '#f43f5e')
                : '#38bdf8',
          },
          lineStyle: { width: 3, color: '#38bdf8' },
          markPoint:
            metric === 'ukd'
              ? {
                  data: [{ type: 'max', name: 'Zirve' }],
                  symbolSize: 48,
                  itemStyle: { color: '#f59e0b' },
                  label: { color: '#090d16', fontWeight: 'bold', fontSize: 10 },
                }
              : undefined,
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
                      { offset: 0, color: 'rgba(56, 189, 248, 0.25)' },
                      { offset: 1, color: 'rgba(56, 189, 248, 0.0)' },
                    ],
                  },
                }
              : undefined,
        },
      ],
    };
  }, [displayedPeriods, periodIndices, player, metric, dataset.periods]);

  return (
    <div>
      {/* In-Flow Search & Player Picker Panel — Never Overlaps With Any Card Below */}
      <div className="search-panel">
        <div className="search-panel-header">
          <div className="search-label">
            <UserCheck size={16} />
            <span>Sporcu Arama ve Seçim Paneli</span>
          </div>
          <div className="search-hint">
            Aktif Sporcu: <strong style={{ color: '#fff' }}>{player.n}</strong> (#{player.id})
          </div>
        </div>

        <div className="search-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="input-field"
            placeholder="Sporcu adı, soyadı, lisans no veya kulüp yazın... (Örn: Cengiz, Kıvanç, 1002, Lefkoşa)"
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

        {/* In-Flow Search Results List (Pushes content down cleanly instead of overlapping) */}
        {searchQuery.trim().length > 0 && (
          <div className="search-results-panel">
            <div className="search-results-header">
              <span>
                {searchResults.length > 0
                  ? `"${searchQuery}" için ${searchResults.length} eşleşen sporcu bulundu — seçmek için tıklayın:`
                  : `"${searchQuery}" ile eşleşen sporcu bulunamadı.`}
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
                    onClick={() => handleChoosePlayer(s.player.id)}
                  >
                    <div className="search-item-info">
                      <div className="search-item-name">
                        <span>{s.player.n}</span>
                        {s.player.t && <span className="badge badge-title">{s.player.t}</span>}
                        {s.currentClub && <span className="badge badge-club">{s.currentClub}</span>}
                      </div>
                      <div className="search-item-meta">
                        <span>Lisans: #{s.player.id}</span>
                        {s.player.b && <span>• Doğum: {s.player.b}</span>}
                        <span>• Maç: {s.careerGames}</span>
                        <span>• Aktif Dönem: {s.ratedCount}</span>
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

        {/* Quick Picks Row when not typing */}
        {!searchQuery.trim() && featuredPlayers.length > 0 && (
          <div className="quick-picks-row">
            <span className="quick-pick-label">Hızlı Seçim:</span>
            {featuredPlayers.map((fp) => (
              <button
                key={fp.player.id}
                type="button"
                className={`quick-pick-btn ${fp.player.id === player.id ? 'active' : ''}`}
                onClick={() => handleChoosePlayer(fp.player.id)}
              >
                {fp.player.n} ({formatUkd(fp.latestUkd)})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Player Header Banner */}
      <div className="glass-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff' }}>{player.n}</h2>
              {player.t && <span className="badge badge-title">{player.t}</span>}
              <span className="badge badge-club">{currentClub || 'Bireysel'}</span>
              <span className={`badge ${player.s === 'Vizeli' ? 'badge-active' : 'badge-inactive'}`}>
                {player.s || 'Vizesiz'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 16,
                color: 'var(--text-secondary)',
                fontSize: '0.86rem',
                flexWrap: 'wrap',
              }}
            >
              <span>
                Lisans No: <strong style={{ color: '#fff' }}>#{player.id}</strong>
              </span>
              {player.b && (
                <span>
                  Doğum Yılı: <strong style={{ color: '#fff' }}>{player.b}</strong>
                </span>
              )}
              {player.g && (
                <span>
                  Cinsiyet: <strong style={{ color: '#fff' }}>{player.g === 'E' ? 'Erkek' : 'Kadın'}</strong>
                </span>
              )}
              {player.f && (
                <span>
                  FIDE ID: <strong style={{ color: '#fff' }}>{player.f}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Güncel UKD
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2.35rem',
                fontWeight: 800,
                color: 'var(--accent-sky)',
                lineHeight: 1.1,
              }}
            >
              {formatUkd(latestUkd)}
            </div>
            <div style={{ marginTop: 6 }}>
              <span
                className={`delta-badge ${
                  latestChange > 0 ? 'delta-pos' : latestChange < 0 ? 'delta-neg' : 'delta-zero'
                }`}
              >
                {latestChange !== 0 ? `${formatDelta(latestChange)} son dönem` : 'Son dönem değişim yok'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics 7-Card Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Kariyer Zirvesi</div>
          <div className="metric-value-row">
            <span className="metric-value">{formatUkd(peakUkd)}</span>
          </div>
          <div className="metric-sub">
            {peakPeriodIndex >= 0 ? dataset.periods[peakPeriodIndex]?.name : '—'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">İlk Kayıt UKD</div>
          <div className="metric-value-row">
            <span className="metric-value">{formatUkd(firstUkd)}</span>
          </div>
          <div className="metric-sub">
            {firstPeriodIndex >= 0 ? dataset.periods[firstPeriodIndex]?.name : '—'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Toplam Net Değişim</div>
          <div className="metric-value-row">
            <span className="metric-value">{formatDelta(totalChange)}</span>
            <span
              className={`delta-badge ${
                totalChange > 0 ? 'delta-pos' : totalChange < 0 ? 'delta-neg' : 'delta-zero'
              }`}
            >
              {totalChange > 0 ? 'Gelişim' : totalChange < 0 ? 'Düşüş' : 'Sabit'}
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
            <span className="metric-value">{bestRank > 0 ? `#${bestRank}` : '—'}</span>
          </div>
          <div className="metric-sub">KKSF genel liste rekoru</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Güncel Sıralama</div>
          <div className="metric-value-row">
            <span className="metric-value">{latestRank > 0 ? `#${latestRank}` : '—'}</span>
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
            <span>{player.n} — Zaman Serisi Grafiği</span>
          </div>

          <div className="controls-row">
            {/* Metric Selector */}
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
                className={`btn-group-item ${metric === 'change' ? 'active' : ''}`}
                onClick={() => setMetric('change')}
              >
                Değişim (Δ)
              </button>
              <button
                type="button"
                className={`btn-group-item ${metric === 'rank' ? 'active' : ''}`}
                onClick={() => setMetric('rank')}
              >
                Liste Sırası
              </button>
              <button
                type="button"
                className={`btn-group-item ${metric === 'games' ? 'active' : ''}`}
                onClick={() => setMetric('games')}
              >
                Toplam Maç
              </button>
            </div>

            {/* Range Selector */}
            <div className="btn-group">
              <button
                type="button"
                className={`btn-group-item ${rangeMode === 'all' ? 'active' : ''}`}
                onClick={() => setRangeMode('all')}
              >
                Tümü (49 Dönem)
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
                className={`btn-group-item ${rangeMode === '3p' ? 'active' : ''}`}
                onClick={() => setRangeMode('3p')}
              >
                Son 3 Dönem
              </button>
              <button
                type="button"
                className={`btn-group-item ${rangeMode === 'custom' ? 'active' : ''}`}
                onClick={() => setRangeMode('custom')}
              >
                Özel Aralık
              </button>
            </div>
          </div>
        </div>

        {rangeMode === 'custom' && (
          <div className="controls-row" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Başlangıç:</span>
              <select
                className="select-control"
                value={customStartIdx}
                onChange={(e) => setCustomStartIdx(Number(e.target.value))}
              >
                {dataset.periods.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Bitiş:</span>
              <select
                className="select-control"
                value={customEndIdx}
                onChange={(e) => setCustomEndIdx(Number(e.target.value))}
              >
                {dataset.periods.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={{ height: 400, width: '100%' }}>
          <ReactECharts option={chartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* Detailed Period Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Calendar size={18} color="var(--accent-sky)" />
            <span>Dönem Bazlı Ayrıntılı Kayıt Tablosu</span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Toplam {displayedPeriods.length} dönem gösteriliyor
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: 440 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dönem</th>
                <th>Yayın Tarihi</th>
                <th className="text-right">UKD</th>
                <th className="text-right">Değişim</th>
                <th className="text-right">Sıra</th>
                <th className="text-right">Dönem Maçı</th>
                <th className="text-right">Toplam Maç</th>
                <th>Kulüp</th>
                <th>Dahil Edilen Turnuvalar</th>
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
                    <td style={{ fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{per.name}</td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{per.date}</td>
                    <td
                      className="text-right font-mono"
                      style={{ fontWeight: 700, color: u && u > 0 ? 'var(--accent-sky)' : 'var(--text-muted)' }}
                    >
                      {formatUkd(u)}
                    </td>
                    <td className="text-right font-mono">
                      <span
                        className={`delta-badge ${
                          (d ?? 0) > 0 ? 'delta-pos' : (d ?? 0) < 0 ? 'delta-neg' : 'delta-zero'
                        }`}
                      >
                        {formatDelta(d)}
                      </span>
                    </td>
                    <td className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {r ? `#${r}` : '—'}
                    </td>
                    <td className="text-right font-mono">{m ?? 0}</td>
                    <td className="text-right font-mono">{k ?? 0}</td>
                    <td>{club}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 340 }}>
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
