import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { UkdDataset, PlayerSummary } from '../types';
import { formatUkd, formatDelta } from '../utils';

interface MoversViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const MoversView: React.FC<MoversViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  const nPeriods = dataset.periods.length;
  // Default to last 5 periods just like app.py (index = len - 5 to len - 1)
  const [startIdx, setStartIdx] = useState<number>(Math.max(0, nPeriods - 5));
  const [endIdx, setEndIdx] = useState<number>(Math.max(0, nPeriods - 1));
  const [minGames, setMinGames] = useState<number>(3);
  const [topN, setTopN] = useState<number>(15);
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
      clubAtEnd: string;
    }> = [];

    for (const s of summaries) {
      const p = s.player;
      if (genderFilter !== 'all' && p.g !== genderFilter) continue;

      const cIdx = p.c[endIdx];
      const clubAtEnd = cIdx >= 0 && cIdx < dataset.clubs.length ? dataset.clubs[cIdx] : s.currentClub;
      if (clubFilter !== 'all' && clubAtEnd !== clubFilter) continue;

      const uStart = p.u[startIdx];
      const uEnd = p.u[endIdx];

      if (uEnd === null || uEnd <= 0) continue;
      if (uStart === null || uStart <= 0) continue;

      // Games played between start and end
      const kStart = p.k[startIdx] ?? 0;
      const kEnd = p.k[endIdx] ?? 0;
      let gamesInInterval = Math.max(0, kEnd - kStart);
      if (gamesInInterval === 0) {
        for (let i = startIdx + 1; i <= endIdx; i++) {
          gamesInInterval += p.m[i] ?? 0;
        }
      }

      if (gamesInInterval < minGames) continue;

      const delta = Math.round((uEnd - uStart) * 10) / 10;
      list.push({
        summary: s,
        startUkd: uStart,
        endUkd: uEnd,
        delta,
        intervalGames: gamesInInterval,
        clubAtEnd,
      });
    }

    return list;
  }, [summaries, startIdx, endIdx, minGames, genderFilter, clubFilter, dataset.clubs]);

  const topGainers = useMemo(() => {
    return [...moverStats]
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, topN);
  }, [moverStats, topN]);

  const topLosers = useMemo(() => {
    return [...moverStats]
      .filter((x) => x.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, topN);
  }, [moverStats, topN]);

  const gainersChartOption = useMemo(() => {
    const data = [...topGainers].reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13, 20, 34, 0.96)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = data[params[0]?.dataIndex];
          if (!item) return '';
          return `
            <div>
              <strong>${item.summary.player.n}</strong><br/>
              Kazanç: <span style="color:#10b981; font-weight:700;">+${item.delta}</span><br/>
              ${formatUkd(item.startUkd)} → ${formatUkd(item.endUkd)}<br/>
              Oynanan Maç: ${item.intervalGames}
            </div>
          `;
        },
      },
      grid: { left: 10, right: 35, top: 10, bottom: 20, containLabel: true },
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

  const losersChartOption = useMemo(() => {
    const data = [...topLosers].reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13, 20, 34, 0.96)',
        borderColor: 'rgba(244, 63, 94, 0.4)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = data[params[0]?.dataIndex];
          if (!item) return '';
          return `
            <div>
              <strong>${item.summary.player.n}</strong><br/>
              Kayıp: <span style="color:#f43f5e; font-weight:700;">${item.delta}</span><br/>
              ${formatUkd(item.startUkd)} → ${formatUkd(item.endUkd)}<br/>
              Oynanan Maç: ${item.intervalGames}
            </div>
          `;
        },
      },
      grid: { left: 10, right: 35, top: 10, bottom: 20, containLabel: true },
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
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Zap size={20} color="var(--accent-sky)" />
            <span>Dönemsel Rating Hareketleri ({dataset.periods[startIdx]?.name} → {dataset.periods[endIdx]?.name})</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Kriterlere uyan <strong style={{ color: '#fff' }}>{moverStats.length}</strong> sporcu incelendi
          </div>
        </div>

        <div className="controls-row" style={{ gap: 16 }}>
          {/* Start Period */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
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
            <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
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
            <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Min. Oynanan Maç
            </label>
            <select
              className="select-control"
              value={minGames}
              onChange={(e) => setMinGames(Number(e.target.value))}
            >
              <option value={0}>Filtresiz (0+ maç)</option>
              <option value={1}>En az 1 maç</option>
              <option value={3}>En az 3 maç</option>
              <option value={5}>En az 5 maç</option>
              <option value={10}>En az 10 maç</option>
            </select>
          </div>

          {/* Top N */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Liste Boyutu
            </label>
            <select
              className="select-control"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              <option value={10}>İlk 10 Sporcu</option>
              <option value={15}>İlk 15 Sporcu</option>
              <option value={25}>İlk 25 Sporcu</option>
            </select>
          </div>

          {/* Gender Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
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
            <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
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

      {/* Responsive Two Column Gainers / Losers */}
      <div className="two-col-grid">
        {/* Top Gainers */}
        <div className="glass-card" style={{ marginBottom: 0 }}>
          <div className="glass-card-header">
            <div className="card-title" style={{ color: 'var(--accent-emerald)' }}>
              <TrendingUp size={20} />
              <span>En Hızlı Yükselenler (+Δ)</span>
            </div>
          </div>

          <div style={{ height: Math.max(300, topGainers.length * 24), width: '100%', marginBottom: 16 }}>
            <ReactECharts option={gainersChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
          </div>

          <div className="table-container" style={{ maxHeight: 400 }}>
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
                        type="button"
                        className="player-link-btn"
                        onClick={() => onSelectPlayer(item.summary.player.id)}
                      >
                        {idx + 1}. {item.summary.player.n}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {item.clubAtEnd || 'Bireysel'}
                    </td>
                    <td className="text-right font-mono">{formatUkd(item.startUkd)}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(item.endUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className="delta-badge delta-pos">{formatDelta(item.delta)}</span>
                    </td>
                    <td className="text-right font-mono">{item.intervalGames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Losers */}
        <div className="glass-card" style={{ marginBottom: 0 }}>
          <div className="glass-card-header">
            <div className="card-title" style={{ color: 'var(--accent-rose)' }}>
              <TrendingDown size={20} />
              <span>En Çok Düşenler (-Δ)</span>
            </div>
          </div>

          <div style={{ height: Math.max(300, topLosers.length * 24), width: '100%', marginBottom: 16 }}>
            <ReactECharts option={losersChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
          </div>

          <div className="table-container" style={{ maxHeight: 400 }}>
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
                        type="button"
                        className="player-link-btn"
                        onClick={() => onSelectPlayer(item.summary.player.id)}
                      >
                        {idx + 1}. {item.summary.player.n}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {item.clubAtEnd || 'Bireysel'}
                    </td>
                    <td className="text-right font-mono">{formatUkd(item.startUkd)}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(item.endUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className="delta-badge delta-neg">{formatDelta(item.delta)}</span>
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
