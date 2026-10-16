import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Users,
  Zap,
  Landmark,
  Trophy,
  Archive,
  RefreshCw,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { UkdDataset, TabType } from './types';
import { buildPlayerSummaries } from './utils';
import { PlayerView } from './components/PlayerView';
import { CompareView } from './components/CompareView';
import { MoversView } from './components/MoversView';
import { ClubsView } from './components/ClubsView';
import { LeaderboardView } from './components/LeaderboardView';
import { ArchiveView } from './components/ArchiveView';

export const App: React.FC = () => {
  const [dataset, setDataset] = useState<UkdDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('player');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/data/ukd.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Veri dosyası yüklenemedi`);
        return res.json();
      })
      .then((data: UkdDataset) => {
        setDataset(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Veri yükleme hatası:', err);
        setError(err.message || 'Veritabanı yüklenirken bir sorun oluştu.');
        setLoading(false);
      });
  }, []);

  // Visitor Counter Effect (Cloudflare Pages Function + KV with multi-tier fallback)
  useEffect(() => {
    let cancelled = false;
    async function trackVisit() {
      try {
        const res = await fetch('/api/counter?mode=hit', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.count === 'number' && data.source === 'kv') {
            if (!cancelled) setVisitorCount(data.count);
            return;
          }
        }
      } catch {
        // Fallback below
      }

      try {
        const ext = await fetch('https://api.counterapi.dev/v1/kktc-ukd-web/visits/up');
        if (ext.ok) {
          const data = await ext.json();
          if (typeof data?.count === 'number') {
            if (!cancelled) setVisitorCount(data.count);
            return;
          }
        }
      } catch {
        // Local storage fallback
      }

      const localKey = 'kksf_ukd_local_visits';
      const prev = parseInt(localStorage.getItem(localKey) || '1', 10) || 1;
      const next = prev + 1;
      localStorage.setItem(localKey, String(next));
      if (!cancelled) setVisitorCount(next);
    }

    trackVisit();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaries = useMemo(() => {
    if (!dataset) return [];
    return buildPlayerSummaries(dataset.players, dataset.clubs);
  }, [dataset]);

  const handleSelectPlayer = (id: string) => {
    setSelectedPlayerId(id);
    setActiveTab('player');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner" />
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
          UKD Veritabanı Yükleniyor...
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          49 dönem ve 1.722 sporcu verisi hazırlanıyor
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="loading-wrapper">
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: 8 }}>
          Veri Yüklenemedi
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{error}</div>
        <button
          className="tab-btn active"
          onClick={() => window.location.reload()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={16} /> Tekrar Dene
        </button>
      </div>
    );
  }

  const firstPeriodName = dataset.periods[0]?.name || '';
  const lastPeriodName = dataset.periods[dataset.periods.length - 1]?.name || '';

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon">♟️</div>
          <div>
            <h1 className="brand-title">KKSF UKD Progress Explorer</h1>
            <p className="brand-subtitle">
              Kuzey Kıbrıs Satranç Federasyonu Resmi UKD Rating ve Gelişim Takip Sistemi
            </p>
          </div>
        </div>

        <div className="header-badges">
          <span className="pill-badge highlight">
            <strong>{dataset.periods.length}</strong> Dönem ({firstPeriodName} → {lastPeriodName})
          </span>
          <span className="pill-badge">
            <strong>{dataset.players.length.toLocaleString('tr-TR')}</strong> Sporcu
          </span>
          <span className="pill-badge">
            <strong>{dataset.clubs.length}</strong> Kulüp
          </span>
          <a
            href="https://kksfed.org/ukd-lists"
            target="_blank"
            rel="noreferrer"
            className="pill-badge"
            style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}
          >
            kksfed.org <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'player' ? 'active' : ''}`}
          onClick={() => setActiveTab('player')}
        >
          <TrendingUp size={18} />
          Oyuncu Gelişimi
        </button>

        <button
          className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          <Users size={18} />
          Çoklu Karşılaştırma
        </button>

        <button
          className={`tab-btn ${activeTab === 'movers' ? 'active' : ''}`}
          onClick={() => setActiveTab('movers')}
        >
          <Zap size={18} />
          En Hızlı Yükselen / Düşen
        </button>

        <button
          className={`tab-btn ${activeTab === 'clubs' ? 'active' : ''}`}
          onClick={() => setActiveTab('clubs')}
        >
          <Landmark size={18} />
          Kulüp Analizi
        </button>

        <button
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <Trophy size={18} />
          Genel Sıralama
        </button>

        <button
          className={`tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveTab('archive')}
        >
          <Archive size={18} />
          Dönem & Turnuva Arşivi
        </button>
      </nav>

      {/* Tab Views */}
      <main>
        {activeTab === 'player' && (
          <PlayerView
            dataset={dataset}
            summaries={summaries}
            selectedId={selectedPlayerId}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {activeTab === 'compare' && (
          <CompareView
            dataset={dataset}
            summaries={summaries}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {activeTab === 'movers' && (
          <MoversView
            dataset={dataset}
            summaries={summaries}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {activeTab === 'clubs' && (
          <ClubsView
            dataset={dataset}
            summaries={summaries}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            dataset={dataset}
            summaries={summaries}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {activeTab === 'archive' && <ArchiveView dataset={dataset} />}
      </main>

      {/* Footer with Centered Visitor Counter */}
      <footer className="app-footer">
        <div className="visitor-counter-pill" title="Toplam Site Ziyaretçi Sayısı">
          <span className="live-dot" />
          <span className="visitor-counter-label">
            <Eye size={15} color="var(--accent-sky)" />
            Toplam Ziyaretçi
          </span>
          <span className="visitor-counter-value">
            {visitorCount !== null ? visitorCount.toLocaleString('tr-TR').padStart(5, '0') : '•••'}
          </span>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          KKSF UKD Progress Explorer • Veri Kaynağı:{' '}
          <a
            href="https://kksfed.org/ukd-lists"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-sky)', textDecoration: 'none' }}
          >
            Kuzey Kıbrıs Satranç Federasyonu (kksfed.org)
          </a>{' '}
          • Resmi UKD listeleri zaman serisi arşivi (Mayıs 2022 – Ekim 2026)
        </div>
      </footer>
    </div>
  );
};

export default App;
