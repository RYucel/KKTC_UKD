import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Landmark, Users, Award, Shield } from 'lucide-react';
import { UkdDataset, PlayerSummary } from '../types';
import { formatUkd, formatDelta } from '../utils';

interface ClubsViewProps {
  dataset: UkdDataset;
  summaries: PlayerSummary[];
  onSelectPlayer: (id: string) => void;
}

export const ClubsView: React.FC<ClubsViewProps> = ({ dataset, summaries, onSelectPlayer }) => {
  // Aggregate club stats
  const clubStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        members: PlayerSummary[];
        ratedMembers: PlayerSummary[];
        avgUkd: number;
        medianUkd: number;
        totalGames: number;
        topPlayer: PlayerSummary | null;
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
        topPlayer: null,
      });
    });

    summaries.forEach((s) => {
      if (s.currentClub && map.has(s.currentClub)) {
        const item = map.get(s.currentClub)!;
        item.members.push(s);
        item.totalGames += s.careerGames;
        if (s.latestUkd > 0) {
          item.ratedMembers.push(s);
        }
      }
    });

    const result = Array.from(map.values())
      .filter((c) => c.members.length > 0)
      .map((c) => {
        // sort rated members descending
        c.ratedMembers.sort((a, b) => b.latestUkd - a.latestUkd);
        c.topPlayer = c.ratedMembers[0] || null;

        if (c.ratedMembers.length > 0) {
          const sum = c.ratedMembers.reduce((acc, m) => acc + m.latestUkd, 0);
          c.avgUkd = Math.round(sum / c.ratedMembers.length);

          const mid = Math.floor(c.ratedMembers.length / 2);
          c.medianUkd =
            c.ratedMembers.length % 2 !== 0
              ? c.ratedMembers[mid].latestUkd
              : Math.round((c.ratedMembers[mid - 1].latestUkd + c.ratedMembers[mid].latestUkd) / 2);
        }

        return c;
      });

    // Default sort by number of rated members then avg ukd
    return result.sort((a, b) => b.ratedMembers.length - a.ratedMembers.length);
  }, [dataset.clubs, summaries]);

  // Selected Club
  const [selectedClubName, setSelectedClubName] = useState<string>(() => {
    return clubStats[0]?.name || dataset.clubs[0] || '';
  });

  const selectedClub = useMemo(() => {
    return clubStats.find((c) => c.name === selectedClubName) || clubStats[0];
  }, [clubStats, selectedClubName]);

  // Bar chart of Top 12 Clubs by Average UKD (with at least 5 rated players)
  const chartOption = useMemo(() => {
    const eligible = clubStats
      .filter((c) => c.ratedMembers.length >= 3)
      .sort((a, b) => b.avgUkd - a.avgUkd)
      .slice(0, 10)
      .reverse();

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const item = eligible[params[0].dataIndex];
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
      grid: { left: 10, right: 30, top: 20, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'Ortalama UKD',
        min: 'dataMin',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: eligible.map((c) => (c.name.length > 22 ? c.name.slice(0, 20) + '…' : c.name)),
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
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div className="glass-card-header">
          <div className="card-title">
            <Landmark size={20} color="var(--accent-sky)" />
            Kulüp & Takım Analizi
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Kulüp Seçimi:
            </label>
            <select
              className="select-control"
              value={selectedClubName}
              onChange={(e) => setSelectedClubName(e.target.value)}
              style={{ minWidth: 260 }}
            >
              {clubStats.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.ratedMembers.length} dereceli)
                </option>
              ))}
            </select>
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
              <span className="metric-value" style={{ fontSize: '1.25rem' }}>
                {selectedClub.topPlayer ? selectedClub.topPlayer.player.n : '—'}
              </span>
            </div>
            <div className="metric-sub">
              {selectedClub.topPlayer ? `${formatUkd(selectedClub.topPlayer.latestUkd)} UKD` : '—'}
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
            Kulüp Güç Sıralaması (En Yüksek Ortalama UKD)
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            En az 3 dereceli sporcusu olan kulüpler
          </div>
        </div>
        <div style={{ height: 320, width: '100%' }}>
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* Selected Club Roster Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Users size={18} color="var(--accent-sky)" />
            {selectedClub.name} — Kadro Listesi ({selectedClub.members.length} Sporcu)
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: 440 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sıra</th>
                <th>Sporcu</th>
                <th>Lisans No</th>
                <th>Ünvan</th>
                <th className="text-right">Güncel UKD</th>
                <th className="text-right">Son Değişim</th>
                <th className="text-right">Zirve UKD</th>
                <th className="text-right">Toplam Maç</th>
                <th>Cinsiyet</th>
                <th>Vize</th>
              </tr>
            </thead>
            <tbody>
              {selectedClub.members
                .sort((a, b) => b.latestUkd - a.latestUkd)
                .map((m, idx) => (
                  <tr key={m.player.id}>
                    <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      #{idx + 1}
                    </td>
                    <td>
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.9rem',
                        }}
                        onClick={() => onSelectPlayer(m.player.id)}
                      >
                        {m.player.n}
                      </button>
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      #{m.player.id}
                    </td>
                    <td>{m.player.t ? <span className="badge badge-title">{m.player.t}</span> : '—'}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>
                      {formatUkd(m.latestUkd)}
                    </td>
                    <td className="text-right font-mono">
                      <span className={`delta-badge ${m.latestChange > 0 ? 'delta-pos' : m.latestChange < 0 ? 'delta-neg' : 'delta-zero'}`}>
                        {formatDelta(m.latestChange)}
                      </span>
                    </td>
                    <td className="text-right font-mono">{formatUkd(m.peakUkd)}</td>
                    <td className="text-right font-mono">{m.careerGames}</td>
                    <td>{m.player.g === 'E' ? 'Erkek' : m.player.g === 'K' ? 'Kadın' : '—'}</td>
                    <td>
                      <span className={`badge ${m.player.s === 'Vizeli' ? 'badge-active' : 'badge-inactive'}`}>
                        {m.player.s || 'Vizesiz'}
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
