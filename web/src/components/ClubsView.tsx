import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Landmark, Users, Shield } from 'lucide-react';
import { UkdDataset, PlayerSummary } from '../types';
import { formatUkd, formatDelta } from '../utils';

interface ClubsViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const ClubsView: React.FC<ClubsViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  const nPeriods = dataset.periods.length;
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(Math.max(0, nPeriods - 1));

  // Aggregate club stats for the selected period
  const clubStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        members: Array<{
          summary: PlayerSummary;
          periodUkd: number;
          periodDelta: number;
          periodGames: number;
        }>;
        ratedMembers: Array<{
          summary: PlayerSummary;
          periodUkd: number;
          periodDelta: number;
          periodGames: number;
        }>;
        avgUkd: number;
        medianUkd: number;
        totalGames: number;
        topPlayerName: string;
        topPlayerUkd: number;
      }
    >();

    dataset.clubs.forEach((club) => {
      map.set(club, {
        name: club,
        members: [],
        ratedMembers: [],
        avgUkd: 0,
        medianUkd: 0,
        totalGames: 0,
        topPlayerName: '',
        topPlayerUkd: 0,
      });
    });

    summaries.forEach((s) => {
      const p = s.player;
      const cIdx = p.c[selectedPeriodIdx];
      const club = cIdx >= 0 && cIdx < dataset.clubs.length ? dataset.clubs[cIdx] : '';
      if (!club || !map.has(club)) return;

      const u = p.u[selectedPeriodIdx];
      if (u === null) return; // Not in this period's list

      const d = p.d[selectedPeriodIdx] ?? 0;
      const k = p.k[selectedPeriodIdx] ?? 0;
      const entry = { summary: s, periodUkd: u ?? 0, periodDelta: d, periodGames: k };

      const item = map.get(club)!;
      item.members.push(entry);
      item.totalGames += k;
      if (u > 0) {
        item.ratedMembers.push(entry);
      }
    });

    const result = Array.from(map.values())
      .filter((c) => c.members.length > 0)
      .map((c) => {
        c.ratedMembers.sort((a, b) => b.periodUkd - a.periodUkd);
        c.members.sort((a, b) => b.periodUkd - a.periodUkd);
        if (c.ratedMembers.length > 0) {
          c.topPlayerName = c.ratedMembers[0].summary.player.n;
          c.topPlayerUkd = c.ratedMembers[0].periodUkd;

          const sum = c.ratedMembers.reduce((acc, m) => acc + m.periodUkd, 0);
          c.avgUkd = Math.round((sum / c.ratedMembers.length) * 10) / 10;

          const mid = Math.floor(c.ratedMembers.length / 2);
          c.medianUkd =
            c.ratedMembers.length % 2 !== 0
              ? c.ratedMembers[mid].periodUkd
              : Math.round((c.ratedMembers[mid - 1].periodUkd + c.ratedMembers[mid].periodUkd) / 2);
        }
        return c;
      });

    return result.sort((a, b) => b.ratedMembers.length - a.ratedMembers.length);
  }, [dataset.clubs, summaries, selectedPeriodIdx]);

  const [selectedClubName, setSelectedClubName] = useState<string>(() => {
    return clubStats[0]?.name || dataset.clubs[0] || '';
  });

  const selectedClub = useMemo(() => {
    return clubStats.find((c) => c.name === selectedClubName) || clubStats[0];
  }, [clubStats, selectedClubName]);

  const chartOption = useMemo(() => {
    const eligible = clubStats
      .filter((c) => c.ratedMembers.length >= 5)
      .sort((a, b) => b.avgUkd - a.avgUkd)
      .slice(0, 14)
      .reverse();

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13, 20, 34, 0.96)',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = eligible[params[0]?.dataIndex];
          if (!item) return '';
          return `
            <div>
              <strong>${item.name}</strong><br/>
              Ortalama UKD: <span style="color:#38bdf8; font-weight:700;">${item.avgUkd}</span><br/>
              Medyan UKD: ${item.medianUkd}<br/>
              Dereceli Sporcu: ${item.ratedMembers.length} (Toplam: ${item.members.length})
            </div>
          `;
        },
      },
      grid: { left: 10, right: 35, top: 20, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'Ortalama UKD',
        scale: true,
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: eligible.map((c) => (c.name.length > 26 ? c.name.slice(0, 24) + '…' : c.name)),
        axisLabel: { color: '#e2e8f0', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.15)' } },
      },
      series: [
        {
          type: 'bar',
          data: eligible.map((c) => c.avgUkd),
          itemStyle: {
            color: '#38bdf8',
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }, [clubStats]);

  if (!selectedClub) return null;

  return (
    <div>
      {/* Top Section */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Landmark size={20} color="var(--accent-sky)" />
            <span>Kulüp & Dernek UKD Analizi</span>
          </div>

          <div className="controls-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Dönem:
              </label>
              <select
                className="select-control"
                value={selectedPeriodIdx}
                onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
              >
                {[...dataset.periods].reverse().map((p, revI) => {
                  const actualIdx = dataset.periods.length - 1 - revI;
                  return (
                    <option key={p.id} value={actualIdx}>
                      {p.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Kulüp Seçimi:
              </label>
              <select
                className="select-control"
                value={selectedClub.name}
                onChange={(e) => setSelectedClubName(e.target.value)}
                style={{ minWidth: 250 }}
              >
                {clubStats.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.ratedMembers.length} dereceli)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Club Metrics */}
        <div className="metrics-grid" style={{ marginBottom: 0 }}>
          <div className="metric-card">
            <div className="metric-label">Toplam Sporcu</div>
            <div className="metric-value-row">
              <span className="metric-value">{selectedClub.members.length}</span>
            </div>
            <div className="metric-sub">{selectedClub.ratedMembers.length} aktif dereceli</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Ortalama UKD</div>
            <div className="metric-value-row">
              <span className="metric-value" style={{ color: 'var(--accent-sky)' }}>
                {selectedClub.avgUkd || '—'}
              </span>
            </div>
            <div className="metric-sub">Dereceli sporcular ortalaması</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Medyan UKD</div>
            <div className="metric-value-row">
              <span className="metric-value">{selectedClub.medianUkd || '—'}</span>
            </div>
            <div className="metric-sub">Kulüp ortanca değeri</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Kulüp Lideri (1. Masa)</div>
            <div className="metric-value-row">
              <span className="metric-value" style={{ fontSize: '1.18rem' }}>
                {selectedClub.topPlayerName || '—'}
              </span>
            </div>
            <div className="metric-sub">
              {selectedClub.topPlayerUkd ? `${formatUkd(selectedClub.topPlayerUkd)} UKD` : '—'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Toplam Kulüp Maçı</div>
            <div className="metric-value-row">
              <span className="metric-value">{selectedClub.totalGames.toLocaleString('tr-TR')}</span>
            </div>
            <div className="metric-sub">Resmi kümülatif maç toplamı</div>
          </div>
        </div>
      </div>

      {/* Club League Comparison Chart */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Shield size={18} color="var(--accent-sky)" />
            <span>{dataset.periods[selectedPeriodIdx]?.name} — Kulüp Güç Sıralaması (Ortalama UKD)</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            En az 5 dereceli sporcusu olan kulüpler
          </div>
        </div>
        <div style={{ height: 340, width: '100%' }}>
          <ReactECharts option={chartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* Selected Club Roster Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Users size={18} color="var(--accent-sky)" />
            <span>
              {selectedClub.name} — Kadro Listesi ({selectedClub.members.length} Sporcu)
            </span>
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: 460 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sıra</th>
                <th>Sporcu</th>
                <th>Lisans No</th>
                <th>Ünvan</th>
                <th className="text-right">Dönem UKD</th>
                <th className="text-right">Dönem Δ</th>
                <th className="text-right">Kariyer Zirvesi</th>
                <th className="text-right">Toplam Maç</th>
                <th>Cinsiyet</th>
                <th>Vize</th>
              </tr>
            </thead>
            <tbody>
              {selectedClub.members.map((m, idx) => (
                <tr key={m.summary.player.id}>
                  <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    #{idx + 1}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="player-link-btn"
                      onClick={() => onSelectPlayer(m.summary.player.id)}
                    >
                      {m.summary.player.n}
                    </button>
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    #{m.summary.player.id}
                  </td>
                  <td>
                    {m.summary.player.t ? <span className="badge badge-title">{m.summary.player.t}</span> : '—'}
                  </td>
                  <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                    {formatUkd(m.periodUkd)}
                  </td>
                  <td className="text-right font-mono">
                    <span
                      className={`delta-badge ${
                        m.periodDelta > 0 ? 'delta-pos' : m.periodDelta < 0 ? 'delta-neg' : 'delta-zero'
                      }`}
                    >
                      {formatDelta(m.periodDelta)}
                    </span>
                  </td>
                  <td className="text-right font-mono">{formatUkd(m.summary.peakUkd)}</td>
                  <td className="text-right font-mono">{m.periodGames}</td>
                  <td>{m.summary.player.g === 'E' ? 'Erkek' : m.summary.player.g === 'K' ? 'Kadın' : '—'}</td>
                  <td>
                    <span className={`badge ${m.summary.player.s === 'Vizeli' ? 'badge-active' : 'badge-inactive'}`}>
                      {m.summary.player.s || 'Vizesiz'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
