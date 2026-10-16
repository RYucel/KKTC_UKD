import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Zap, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { UkdDataset, PlayerSummary } from '../types';
import { formatUkd, formatDelta } from '../utils';

interface MoversViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const MoversView: React.FC<MoversViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  const nPeriods = dataset.periods.length;
  const [startIdx, setStartIdx] = useState<number>(Math.max(0, nPeriods - 2));
  const [endIdx, setEndIdx] = useState<number>(Math.max(0, nPeriods - 1));
  const [minGames, setMinGames] = useState<number>(1);
  const [genderFilter, setGenderFilter] = useState<'all' | 'E' | 'K'>('all');
  const [clubFilter, setClubFilter] = useState<string>('all');

  // Calculate changes for each player between startIdx and endIdx
  const moverStats = useMemo(() => {
    const list: Array<{
      summary: PlayerSummary;
      startUkd: number;
      endUkd: number;
      delta: number;
      intervalGames: number;
    }> = [];

    for (const s of summaries) {
      const p = s.player;
      if (genderFilter !== 'all' && p.g !== genderFilter) continue;
      if (clubFilter !== 'all' && s.currentClub !== clubFilter) continue;

      const uStart = p.u[startIdx];
      const uEnd = p.u[endIdx];

      // Player must have a rating at end period and either rating at start or was active
      if (uEnd === null || uEnd <= 0) continue;
      if (uStart === null || uStart <= 0) continue;

      // Games played between start and end
      let gamesInInterval = 0;
      for (let i = startIdx + 1; i <= endIdx; i++) {
        gamesInInterval += p.m[i] ?? 0;
      }

      if (gamesInInterval < minGames) continue;

      const delta = uEnd - uStart;
      list.push({
        summary: s,
        startUkd: uStart,
        endUkd: uEnd,
        delta,
        intervalGames: gamesInInterval,
      });
    }

    return list;
  }, [summaries, startIdx, endIdx, minGames, genderFilter, clubFilter]);

  const topGainers = useMemo(() => {
    return [...moverStats].sort((a, b) => b.delta - a.delta).slice(0, 15);
  }, [moverStats]);

  const topLosers = useMemo(() => {
    return [...moverStats].sort((a, b) => a.delta - b.delta).slice(0, 15);
  }, [moverStats]);

  // Bar Chart Option for Gainers
  const gainersChartOption = useMemo(() => {
    const data = [...topGainers].reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = data[params[0].dataIndex];
          return `
            <div>
              <strong>${item.summary.player.n}</strong><br/>
              Kazanç: <span style="color:#10b981; font-weight:700;">+${item.delta.toFixed(1)}</span><br/>
              ${formatUkd(item.startUkd)} → ${formatUkd(item.endUkd)}<br/>
              Oynanan Maç: ${item.intervalGames}
            </div>
          `;
        },
      },
      grid: { left: 10, right: 30, top: 10, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.summary.player.n),
        axisLabel: { color: '#e2e8f0', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => Math.round(d.delta)),
          itemStyle: {
            color: '#10b981',
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }, [topGainers]);

  // Bar Chart Option for Losers
  const losersChartOption = useMemo(() => {
    const data = [...topLosers].reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(244, 63, 94, 0.3)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = data[params[0].dataIndex];
          return `
            <div>
              <strong>${item.summary.player.n}</strong><br/>
              Kayıp: <span style="color:#f43f5e; font-weight:700;">${item.delta.toFixed(1)}</span><br/>
              ${formatUkd(item.startUkd)} → ${formatUkd(item.endUkd)}<br/>
              Oynanan Maç: ${item.intervalGames}
            </div>
          `;
        },
      },
      grid: { left: 10, right: 30, top: 10, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.summary.player.n),
        axisLabel: { color: '#e2e8f0', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => Math.round(d.delta)),
          itemStyle: {
            color: '#f43f5e',
            borderRadius: [4, 0, 0, 4],
          },
        },
      ],
    };
  }, [topLosers]);

  return (
    <div>
      {/* Filters Bar */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="glass-card-header">
          <div className="card-title">
            <Zap size={20} color="var(--accent-sky)" />
            Dönemsel Rating Hareketleri
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {moverStats.length} dereceli sporcu incelendi
          </div>
        </div>

        <div className="controls-row" style={{ gap: 16 }}>
          {/* Start Period */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Başlangıç Dönemi
            </label>
            <select
              className="select-control"
              value={startIdx}
              onChange={(e) => {
                const val = Number(e.target.value);
                setStartIdx(val);
                if (val >= endIdx) setEndIdx(Math.min(nPeriods - 1, val + 1));
              }}
            >
              {dataset.periods.map((p, i) => (
                <option key={p.id} value={i} disabled={i >= endIdx}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* End Period */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Bitiş Dönemi
            </label>
            <select
              className="select-control"
              value={endIdx}
              onChange={(e) => {
                const val = Number(e.target.value);
                setEndIdx(val);
                if (val <= startIdx) setStartIdx(Math.max(0, val - 1));
              }}
            >
              {dataset.periods.map((p, i) => (
                <option key={p.id} value={i} disabled={i <= startIdx}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Min Games Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Min. Aralık Maçı
            </label>
            <select
              className="select-control"
              value={minGames}
              onChange={(e) => setMinGames(Number(e.target.value))}
            >
              <option value={0}>Filtresiz (0+)</option>
              <option value={1}>En az 1 maç</option>
              <option value={3}>En az 3 maç</option>
              <option value={5}>En az 5 maç</option>
            </select>
          </div>

          {/* Gender Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Cinsiyet
            </label>
            <select
              className="select-control"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
            >
              <option value="all">Tümü (Erkek & Kadın)</option>
              <option value="E">Yalnızca Erkek</option>
              <option value="K">Yalnızca Kadın</option>
            </select>
          </div>

          {/* Club Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Kulüp
            </label>
            <select
              className="select-control"
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
            >
              <option value="all">Tüm Kulüpler</option>
              {dataset.clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Two Column Gainers / Losers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        {/* Top Gainers */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="card-title" style={{ color: 'var(--accent-emerald)' }}>
              <TrendingUp size={20} />
              En Çok Yükselenler (+Δ)
            </div>
          </div>

          <div style={{ height: 320, width: '100%', marginBottom: 16 }}>
            <ReactECharts option={gainersChartOption} style={{ height: '100%', width: '100%' }} />
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sporcu</th>
                  <th>Kulüp</th>
                  <th className="text-right">Önceki</th>
                  <th className="text-right">Sonraki</th>
                  <th className="text-right">Fark</th>
                  <th className="text-right">Maç</th>
                </tr>
              </thead>
              <tbody>
                {topGainers.map((item, idx) => (
                  <tr key={item.summary.player.id}>
                    <td>
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onClick={() => onSelectPlayer(item.summary.player.id)}
                      >
                        {idx + 1}. {item.summary.player.n}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {item.summary.currentClub || '—'}
                    </td>
                    <td className="text-right font-mono">{formatUkd(item.startUkd)}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(item.endUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className="delta-badge delta-pos">+{item.delta.toFixed(1)}</span>
                    </td>
                    <td className="text-right font-mono">{item.intervalGames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Losers */}
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="card-title" style={{ color: 'var(--accent-rose)' }}>
              <TrendingDown size={20} />
              En Çok Düşenler (-Δ)
            </div>
          </div>

          <div style={{ height: 320, width: '100%', marginBottom: 16 }}>
            <ReactECharts option={losersChartOption} style={{ height: '100%', width: '100%' }} />
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sporcu</th>
                  <th>Kulüp</th>
                  <th className="text-right">Önceki</th>
                  <th className="text-right">Sonraki</th>
                  <th className="text-right">Fark</th>
                  <th className="text-right">Maç</th>
                </tr>
              </thead>
              <tbody>
                {topLosers.map((item, idx) => (
                  <tr key={item.summary.player.id}>
                    <td>
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onClick={() => onSelectPlayer(item.summary.player.id)}
                      >
                        {idx + 1}. {item.summary.player.n}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {item.summary.currentClub || '—'}
                    </td>
                    <td className="text-right font-mono">{formatUkd(item.startUkd)}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(item.endUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className="delta-badge delta-neg">{item.delta.toFixed(1)}</span>
                    </td>
                    <td className="text-right font-mono">{item.intervalGames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
