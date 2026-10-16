import React, { useState, useMemo } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import { UkdDataset } from '../types';
import { normalizeTr } from '../utils';

interface ArchiveViewProps {
  dataset: UkdDataset;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ dataset }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const totalTournaments = useMemo(() => {
    return dataset.periods.reduce((acc, p) => acc + (p.tournaments?.length || 0), 0);
  }, [dataset.periods]);

  const filteredPeriods = useMemo(() => {
    const q = normalizeTr(searchQuery);
    if (!q) return [...dataset.periods].reverse();

    return [...dataset.periods].reverse().filter((p) => {
      if (normalizeTr(p.name).includes(q)) return true;
      if (p.date.includes(q)) return true;
      return p.tournaments.some((t) => normalizeTr(t).includes(q));
    });
  }, [dataset.periods, searchQuery]);

  return (
    <div>
      {/* Top Banner */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="card-title">
            <Calendar size={20} color="var(--accent-sky)" />
            <span>KKSF Resmi Dönem ve Turnuva Arşivi</span>
          </div>
        </div>

        <div className="metrics-grid" style={{ marginBottom: 16 }}>
          <div className="metric-card">
            <div className="metric-label">Toplam Yayınlanan Dönem</div>
            <div className="metric-value-row">
              <span className="metric-value">{dataset.periods.length}</span>
            </div>
            <div className="metric-sub">
              {dataset.periods[0]?.name} → {dataset.periods[dataset.periods.length - 1]?.name}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Hesaplanan Turnuva Sayısı</div>
            <div className="metric-value-row">
              <span className="metric-value" style={{ color: 'var(--accent-sky)' }}>
                {totalTournaments}
              </span>
            </div>
            <div className="metric-sub">KKSF UKD hesaplamalarına dahil edilenler</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Resmi Veri Kaynağı</div>
            <div className="metric-value-row">
              <span className="metric-value" style={{ fontSize: '1.25rem' }}>
                kksfed.org
              </span>
            </div>
            <div className="metric-sub">KKSF API v1 Yayınları</div>
          </div>
        </div>

        {/* Search */}
        <div className="search-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="input-field"
            placeholder="Dönem adı, tarih veya turnuva ismi ara... (Örn: 'Şampiyonası', '2024', 'Eylül')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Periods Grid / List */}
      <div className="archive-grid">
        {filteredPeriods.map((p) => (
          <div key={p.id} className="glass-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#fff', marginBottom: 2 }}>{p.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Yayın Tarihi: {p.date}</span>
              </div>
              <span className="pill-badge highlight">{p.tournaments.length} Turnuva</span>
            </div>

            <div style={{ flex: 1 }}>
              {p.tournaments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.tournaments.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-primary)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ color: 'var(--accent-sky)', fontSize: '0.9rem' }}>♟</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                  Bu dönemde doğrudan dahil edilen ayrı turnuva kaydı bulunmuyor.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
