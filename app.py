# -*- coding: utf-8 -*-
"""KKSF UKD Performans Takip ve İlerleme Analiz Sistemi (Streamlit).

Veri Kaynağı: https://kksfed.org/ukd-lists
Dönemler: Mayıs 2022 - Ekim 2026 (49 Yayınlanmış Dönem)
"""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from data_loader import build_dataset, load_dataset, player_catalog

# --- Sayfa Yapılandırması ----------------------------------------------------
st.set_page_config(
    page_title="KKSF UKD Progress Explorer",
    page_icon="♟️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Özel Stil (CSS) ---------------------------------------------------------
st.markdown(
    """
    <style>
    .metric-card {
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 12px;
    }
    .metric-title {
        font-size: 0.82rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94A3B8;
        margin-bottom: 4px;
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #F8FAFC;
        line-height: 1.2;
    }
    .metric-delta-pos {
        color: #10B981;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .metric-delta-neg {
        color: #EF4444;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .player-badge {
        display: inline-block;
        background: rgba(59, 130, 246, 0.15);
        color: #60A5FA;
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 0.82rem;
        font-weight: 600;
        margin-right: 6px;
        margin-bottom: 6px;
    }
    .stat-badge {
        display: inline-block;
        background: rgba(148, 163, 184, 0.12);
        color: #CBD5E1;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 0.82rem;
        margin-right: 6px;
        margin-bottom: 6px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# --- Veri Önbelleği ---------------------------------------------------------
@st.cache_data(show_spinner="UKD veritabanı yükleniyor...")
def get_dataset() -> pd.DataFrame:
    return load_dataset(refresh=False)


@st.cache_data(show_spinner="Tüm dönemler kksfed.org üzerinden güncelleniyor...")
def refresh_dataset() -> pd.DataFrame:
    return build_dataset(force_download=True)


try:
    df = get_dataset()
except Exception as e:
    st.error(f"Veri yüklenemedi: {e}")
    st.stop()

catalog = player_catalog(df)
label_to_lisans = dict(zip(catalog["label"], catalog["lisans_no"]))
lisans_to_label = dict(zip(catalog["lisans_no"], catalog["label"]))
all_labels = sorted(catalog["label"].tolist())

# Kronolojik dönem listesi
periods_df = (
    df[["period_index", "period_name", "date", "tournaments_count", "tournaments_str"]]
    .drop_duplicates(subset=["period_name"])
    .sort_values("date")
    .reset_index(drop=True)
)
period_names = periods_df["period_name"].tolist()
period_name_to_date = dict(zip(periods_df["period_name"], periods_df["date"]))
period_name_to_index = dict(zip(periods_df["period_name"], periods_df["period_index"]))

# --- Kenar Çubuğu (Sidebar) -------------------------------------------------
st.sidebar.title("♟️ KKSF UKD Explorer")
st.sidebar.caption(
    f"**{df['lisans_no'].nunique():,}** sporcu • "
    f"**{len(period_names)}** dönem ({period_names[0]} → {period_names[-1]}) • "
    f"**{len(df):,}** toplam kayıt"
)

if st.sidebar.button("🔄 Verileri Güncelle (kksfed.org)"):
    st.cache_data.clear()
    refresh_dataset()
    st.rerun()

st.sidebar.markdown("---")
page = st.sidebar.radio(
    "Analiz Menüsü",
    [
        "📈 Oyuncu Gelişimi",
        "👥 Çoklu Karşılaştırma",
        "⚡ En Hızlı Yükselen / Düşen",
        "🏛️ Kulüp Analizi",
        "🏆 Genel Sıralama",
        "📜 Dönem & Turnuva Arşivi",
    ],
)
st.sidebar.markdown("---")
st.sidebar.caption("🌐 Kaynak: [kksfed.org/ukd-lists](https://kksfed.org/ukd-lists)")
st.sidebar.caption("Kuzey Kıbrıs Satranç Federasyonu UKD Takip ve İlerleme Sistemi")


# =============================================================================
# SAYFA 1: Oyuncu Gelişimi (Player Progress)
# =============================================================================
if page == "📈 Oyuncu Gelişimi":
    st.title("📈 Oyuncu UKD Gelişim Analizi")
    st.markdown("Bir oyuncunun Mayıs 2022'den günümüze tüm dönemlerdeki rating, sıralama ve maç geçmişini inceleyin.")

    col_sel, col_opt1, col_opt2 = st.columns([3, 2, 2])
    with col_sel:
        default_idx = 0
        selected_label = st.selectbox("Oyuncu Seç (Ad, Lisans No veya Kulüp ile arayın)", all_labels, index=default_idx)
        lisans = label_to_lisans[selected_label]

    with col_opt1:
        time_preset = st.selectbox(
            "İncelenecek Dönem",
            [
                "Tüm Dönemler (Mayıs 2022 – Ekim 2026)",
                "Son 12 Ay",
                "Son 3 Yayımlanmış Dönem",
                "Özel Dönem Aralığı",
            ],
        )

    with col_opt2:
        metric_choice = st.selectbox(
            "Grafik Ölçütü",
            [
                "UKD Puanı",
                "UKD Değişimi (Puan)",
                "Liste Sırası (Rank)",
                "Kümülatif Maç Sayısı",
            ],
        )

    p_data = df[df["lisans_no"] == lisans].sort_values("date").reset_index(drop=True)
    p_rated = p_data[p_data["guncel_ukd"] > 0].copy()

    if p_data.empty:
        st.warning("Bu oyuncuya ait kayıt bulunamadı.")
    else:
        latest_row = p_data.iloc[-1]
        
        # Rozetler
        badges_html = f"""
        <div>
            <span class='player-badge'>Lisans: {latest_row['lisans_no']}</span>
            <span class='stat-badge'>Kulüp: {latest_row['kulup'] if latest_row['kulup'] else 'Bireysel'}</span>
            <span class='stat-badge'>Cinsiyet: {latest_row['cinsiyet']}</span>
            <span class='stat-badge'>Doğum Yılı: {int(latest_row['dogum_yili']) if latest_row['dogum_yili'] > 0 else '—'}</span>
            <span class='stat-badge'>Ünvan: {latest_row['unvan'] if latest_row['unvan'] else '—'}</span>
            <span class='stat-badge'>Vize: {latest_row['durum'] if latest_row['durum'] else 'Bilinmiyor'}</span>
        </div>
        """
        st.markdown(badges_html, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

        if p_rated.empty:
            st.info("ℹ️ Bu sporcunun listelenmiş kayıtları bulunuyor ancak henüz pozitif (dereceli) bir UKD puanı kaydedilmemiş.")
        else:
            # Metrik Kartları
            c1, c2, c3, c4, c5, c6 = st.columns(6)
            cur_ukd = int(p_rated["guncel_ukd"].iloc[-1])
            last_change = int(p_rated["degisim"].iloc[-1]) if pd.notna(p_rated["degisim"].iloc[-1]) else 0
            peak_ukd = int(p_rated["guncel_ukd"].max())
            peak_period = p_rated.loc[p_rated["guncel_ukd"].idxmax(), "period_name"]
            first_ukd = int(p_rated["guncel_ukd"].iloc[0])
            first_period = p_rated["period_name"].iloc[0]
            total_change = cur_ukd - first_ukd
            career_matches = int(p_data["kumulatif_mac_sayisi"].max())
            best_rank = int(p_rated["ukd_sirasi"].min()) if (p_rated["ukd_sirasi"] > 0).any() else 0
            cur_rank = int(p_rated["ukd_sirasi"].iloc[-1]) if p_rated["ukd_sirasi"].iloc[-1] > 0 else 0
            active_cnt = len(p_rated)

            with c1:
                delta_str = f"{last_change:+d} bu dönem" if last_change != 0 else "Değişim yok"
                st.metric("Güncel UKD", f"{cur_ukd:,}", delta=delta_str)
            with c2:
                st.metric("Zirve UKD", f"{peak_ukd:,}", help=f"Ulaşılan Dönem: {peak_period}")
            with c3:
                st.metric("Toplam Değişim", f"{total_change:+d}", delta=f"İlk: {first_ukd} ({first_period})")
            with c4:
                st.metric("Toplam Maç", f"{career_matches:,}", help="Kariyer toplam kümülatif maç sayısı")
            with c5:
                st.metric("Sıralama (Son)", f"#{cur_rank}" if cur_rank > 0 else "—", help=f"En iyi sıra: #{best_rank}")
            with c6:
                st.metric("Aktif Dönem", f"{active_cnt} / {len(period_names)}", help="Dereceli olarak yer aldığı dönem sayısı")

            # Dönem filtreleme
            plot_df = p_rated.copy()
            if time_preset == "Son 12 Ay":
                cutoff = plot_df["date"].max() - pd.DateOffset(months=12)
                plot_df = plot_df[plot_df["date"] >= cutoff]
            elif time_preset == "Son 3 Yayımlanmış Dönem":
                plot_df = plot_df.tail(3)
            elif time_preset == "Özel Dönem Aralığı":
                sub_c1, sub_c2 = st.columns(2)
                start_p = sub_c1.selectbox("Başlangıç Dönemi", period_names, index=0)
                end_p = sub_c2.selectbox("Bitiş Dönemi", period_names, index=len(period_names) - 1)
                plot_df = plot_df[
                    (plot_df["date"] >= period_name_to_date[start_p]) &
                    (plot_df["date"] <= period_name_to_date[end_p])
                ]

            if plot_df.empty:
                st.warning("Seçilen dönem aralığında aktif UKD kaydı bulunmuyor.")
            else:
                # Hover formatı
                plot_df["hover_info"] = (
                    "<b>" + plot_df["period_name"] + "</b><br>" +
                    "UKD: " + plot_df["guncel_ukd"].astype(int).astype(str) + "<br>" +
                    "Dönem Değişimi: " + plot_df["degisim"].apply(lambda x: f"{int(x):+d}" if pd.notna(x) else "0") + "<br>" +
                    "Sıra: #" + plot_df["ukd_sirasi"].astype(int).astype(str) + "<br>" +
                    "Dönem Maçı: " + plot_df["donem_mac_sayisi"].astype(int).astype(str) + "<br>" +
                    "Toplam Maç: " + plot_df["kumulatif_mac_sayisi"].astype(int).astype(str) + "<br>" +
                    "Kulüp: " + plot_df["kulup"] + "<br>" +
                    "Turnuvalar: " + plot_df["tournaments_str"].apply(lambda t: t[:60] + "..." if len(str(t)) > 60 else str(t))
                )

                fig = go.Figure()

                if metric_choice == "UKD Puanı":
                    fig.add_trace(
                        go.Scatter(
                            x=plot_df["period_name"],
                            y=plot_df["guncel_ukd"],
                            mode="lines+markers",
                            name="UKD",
                            line=dict(color="#3B82F6", width=3),
                            marker=dict(size=8, color="#2563EB", line=dict(color="#FFFFFF", width=1.5)),
                            customdata=plot_df["hover_info"],
                            hovertemplate="%{customdata}<extra></extra>",
                        )
                    )
                    # Zirve noktası vurgusu
                    peak_idx = plot_df["guncel_ukd"].idxmax()
                    peak_row = plot_df.loc[peak_idx]
                    fig.add_annotation(
                        x=peak_row["period_name"],
                        y=peak_row["guncel_ukd"],
                        text=f"⭐ Zirve: {int(peak_row['guncel_ukd'])}",
                        showarrow=True,
                        arrowhead=2,
                        arrowsize=1,
                        arrowwidth=2,
                        arrowcolor="#F59E0B",
                        ax=0,
                        ay=-35,
                        font=dict(color="#F59E0B", size=12, family="Arial"),
                        bgcolor="rgba(15, 23, 42, 0.8)",
                        bordercolor="#F59E0B",
                        borderwidth=1,
                    )
                    fig.update_layout(yaxis_title="UKD Derecesi")

                elif metric_choice == "UKD Değişimi (Puan)":
                    colors = ["#10B981" if val >= 0 else "#EF4444" for val in plot_df["degisim"]]
                    fig.add_trace(
                        go.Bar(
                            x=plot_df["period_name"],
                            y=plot_df["degisim"],
                            marker_color=colors,
                            customdata=plot_df["hover_info"],
                            hovertemplate="%{customdata}<extra></extra>",
                            name="Dönem Değişimi",
                        )
                    )
                    fig.update_layout(yaxis_title="Dönemsel UKD Değişimi")

                elif metric_choice == "Liste Sırası (Rank)":
                    fig.add_trace(
                        go.Scatter(
                            x=plot_df["period_name"],
                            y=plot_df["ukd_sirasi"],
                            mode="lines+markers",
                            name="Sıralama",
                            line=dict(color="#8B5CF6", width=3),
                            marker=dict(size=8, color="#7C3AED"),
                            customdata=plot_df["hover_info"],
                            hovertemplate="%{customdata}<extra></extra>",
                        )
                    )
                    fig.update_layout(
                        yaxis_title="Sıralama (1 en üstte)",
                        yaxis=dict(autorange="reversed"),  # 1. sıra en üstte
                    )

                elif metric_choice == "Kümülatif Maç Sayısı":
                    fig.add_trace(
                        go.Scatter(
                            x=plot_df["period_name"],
                            y=plot_df["kumulatif_mac_sayisi"],
                            mode="lines+markers",
                            name="Kümülatif Maç",
                            line=dict(color="#06B6D4", width=3),
                            marker=dict(size=8, color="#0891B2"),
                            customdata=plot_df["hover_info"],
                            hovertemplate="%{customdata}<extra></extra>",
                        )
                    )
                    fig.update_layout(yaxis_title="Kariyer Toplam Maç Sayısı")

                fig.update_layout(
                    title=f"{latest_row['ad_soyad']} — {metric_choice} Zaman Serisi",
                    xaxis_title="Dönem",
                    hovermode="x unified",
                    height=500,
                    margin=dict(l=40, r=40, t=60, b=40),
                )
                st.plotly_chart(fig, use_container_width=True)

                # Detaylı Dönem Tablosu
                with st.expander("📋 Dönem Bazlı Ayrıntılı Kayıt Tablosu"):
                    show_cols = [
                        "period_name", "date", "guncel_ukd", "degisim",
                        "ukd_sirasi", "donem_mac_sayisi", "kumulatif_mac_sayisi",
                        "kulup", "durum", "tournaments_str"
                    ]
                    table_df = plot_df[show_cols].copy()
                    table_df["date"] = table_df["date"].dt.strftime("%Y-%m-%d")
                    table_df = table_df.rename(columns={
                        "period_name": "Dönem",
                        "date": "Yayın Tarihi",
                        "guncel_ukd": "UKD",
                        "degisim": "Değişim",
                        "ukd_sirasi": "Sıra",
                        "donem_mac_sayisi": "Dönem Maçı",
                        "kumulatif_mac_sayisi": "Toplam Maç",
                        "kulup": "Kulüp",
                        "durum": "Durum",
                        "tournaments_str": "Dahil Turnuvalar",
                    })
                    st.dataframe(table_df, use_container_width=True, hide_index=True)


# =============================================================================
# SAYFA 2: Çoklu Karşılaştırma (Multi-Player Comparison)
# =============================================================================
elif page == "👥 Çoklu Karşılaştırma":
    st.title("👥 Çoklu Oyuncu UKD Karşılaştırması")
    st.markdown("2 ile 12 arasında oyuncu seçerek rating gelişimlerini, sıralamalarını veya net kazanımlarını karşılaştırın.")

    c_select, c_metric, c_time = st.columns([3, 2, 2])
    with c_select:
        selected_players = st.multiselect(
            "Karşılaştırılacak Oyuncuları Seçin (En fazla 12)",
            all_labels,
            default=all_labels[:3] if len(all_labels) >= 3 else all_labels,
            max_selections=12,
        )

    with c_metric:
        comp_metric = st.selectbox(
            "Karşılaştırma Ölçütü",
            [
                "UKD Puanı",
                "Kümülatif Net Değişim (İlk Döneme Göre Puan Kazanımı)",
                "Liste Sırası (Rank - Ters Eksen)",
                "Toplam Kariyer Maçı",
            ],
        )

    with c_time:
        comp_time = st.selectbox(
            "Zaman Aralığı",
            [
                "Tüm Dönemler (Mayıs 2022 – Ekim 2026)",
                "Son 12 Ay",
                "Son 6 Dönem",
            ],
        )

    if len(selected_players) < 2:
        st.info("Karşılaştırma grafiği oluşturmak için lütfen en az 2 oyuncu seçin.")
    else:
        fig = go.Figure()
        summary_rows = []

        for p_lbl in selected_players:
            p_lisans = label_to_lisans[p_lbl]
            sub = df[(df["lisans_no"] == p_lisans) & (df["guncel_ukd"] > 0)].sort_values("date")
            if sub.empty:
                continue

            if comp_time == "Son 12 Ay":
                cutoff = sub["date"].max() - pd.DateOffset(months=12)
                sub = sub[sub["date"] >= cutoff]
            elif comp_time == "Son 6 Dönem":
                sub = sub.tail(6)

            p_name = sub["ad_soyad"].iloc[-1]
            cur_rating = int(sub["guncel_ukd"].iloc[-1])
            first_rating = int(sub["guncel_ukd"].iloc[0])
            peak_rating = int(sub["guncel_ukd"].max())
            career_games = int(sub["kumulatif_mac_sayisi"].max())
            club_name = sub["kulup"].iloc[-1]

            summary_rows.append({
                "Oyuncu": p_name,
                "Lisans": p_lisans,
                "Kulüp": club_name,
                "Güncel UKD": cur_rating,
                "Zirve UKD": peak_rating,
                "İlk UKD": first_rating,
                "Net Değişim": cur_rating - first_rating,
                "Toplam Maç": career_games,
            })

            if comp_metric == "UKD Puanı":
                y_vals = sub["guncel_ukd"]
                y_label = "UKD Derecesi"
            elif comp_metric == "Kümülatif Net Değişim (İlk Döneme Göre Puan Kazanımı)":
                y_vals = sub["guncel_ukd"] - sub["guncel_ukd"].iloc[0]
                y_label = "Net Değişim (Puan)"
            elif comp_metric == "Liste Sırası (Rank - Ters Eksen)":
                y_vals = sub["ukd_sirasi"]
                y_label = "Sıralama (1 en üstte)"
            else:
                y_vals = sub["kumulatif_mac_sayisi"]
                y_label = "Kariyer Maç Sayısı"

            fig.add_trace(
                go.Scatter(
                    x=sub["period_name"],
                    y=y_vals,
                    mode="lines+markers",
                    name=p_name,
                    line=dict(width=2.5),
                    marker=dict(size=6),
                )
            )

        if comp_metric == "Liste Sırası (Rank - Ters Eksen)":
            fig.update_layout(yaxis=dict(autorange="reversed"))

        fig.update_layout(
            title=f"Çoklu Karşılaştırma: {comp_metric}",
            xaxis_title="Dönem",
            yaxis_title=y_label,
            hovermode="x unified",
            height=540,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig, use_container_width=True)

        if summary_rows:
            st.subheader("📊 Karşılaştırma Özeti")
            sum_df = pd.DataFrame(summary_rows)
            st.dataframe(sum_df, use_container_width=True, hide_index=True)


# =============================================================================
# SAYFA 3: En Hızlı Yükselen / Düşen (Top Movers)
# =============================================================================
elif page == "⚡ En Hızlı Yükselen / Düşen":
    st.title("⚡ En Hızlı Yükselen ve Düşen Oyuncular")
    st.markdown("Herhangi iki dönem arasındaki net rating değişimini hesaplayın ve dönemin en başarılı sporcularını keşfedin.")

    col1, col2, col3 = st.columns(3)
    with col1:
        start_period = st.selectbox(
            "Başlangıç Dönemi",
            period_names,
            index=max(0, len(period_names) - 5),
        )
    with col2:
        end_period = st.selectbox(
            "Bitiş Dönemi",
            period_names,
            index=len(period_names) - 1,
        )
    with col3:
        top_n = st.slider("Listelenecek Oyuncu Sayısı", 5, 40, 15)

    f_col1, f_col2, f_col3 = st.columns(3)
    with f_col1:
        min_matches = st.slider("Minimum Dönem Maç Sayısı (Gürültüyü önler)", 0, 30, 3)
    with f_col2:
        gender_filter = st.selectbox("Cinsiyet Filtresi", ["(Tümü)", "Erkek", "Kadın"])
    with f_col3:
        clubs_list = ["(Tümü)"] + sorted(x for x in df["kulup"].dropna().unique() if x)
        club_filter = st.selectbox("Kulüp Filtresi", clubs_list)

    if period_name_to_date[start_period] >= period_name_to_date[end_period]:
        st.warning("⚠️ Başlangıç dönemi, bitiş döneminden daha önceki bir tarih olmalıdır.")
    else:
        # İki dönemi filtrele
        df_start = df[(df["period_name"] == start_period) & (df["guncel_ukd"] > 0)]
        df_end = df[(df["period_name"] == end_period) & (df["guncel_ukd"] > 0)]

        # İki dönemde de dereceli olan oyuncuları eşleştir
        merged = df_start.merge(
            df_end,
            on="lisans_no",
            suffixes=("_baslangic", "_bitis"),
        )

        # İki dönem arasındaki maç artışı
        merged["mac_farki"] = merged["kumulatif_mac_sayisi_bitis"] - merged["kumulatif_mac_sayisi_baslangic"]
        merged["ukd_degisimi"] = merged["guncel_ukd_bitis"] - merged["guncel_ukd_baslangic"]
        merged["oyuncu"] = merged["ad_soyad_bitis"].fillna(merged["lisans_no"])

        # Filtreleri uygula
        if min_matches > 0:
            merged = merged[merged["mac_farki"] >= min_matches]
        if gender_filter != "(Tümü)":
            merged = merged[merged["cinsiyet_bitis"] == gender_filter]
        if club_filter != "(Tümü)":
            merged = merged[merged["kulup_bitis"] == club_filter]

        if merged.empty:
            st.warning("Seçilen filtre kriterlerine uygun oyuncu eşleşmesi bulunamadı.")
        else:
            risers = merged.nlargest(top_n, "ukd_degisimi").copy()
            fallers = merged.nsmallest(top_n, "ukd_degisimi").copy()

            col_l, col_r = st.columns(2)
            with col_l:
                st.subheader("📈 En Hızlı Yükselenler")
                fig_up = px.bar(
                    risers.sort_values("ukd_degisimi", ascending=True),
                    x="ukd_degisimi",
                    y="oyuncu",
                    orientation="h",
                    text="ukd_degisimi",
                    color_discrete_sequence=["#10B981"],
                    labels={"ukd_degisimi": "UKD Artışı", "oyuncu": ""},
                )
                fig_up.update_traces(texttemplate="+%{text:.0f}", textposition="outside")
                fig_up.update_layout(height=max(360, 26 * top_n), margin=dict(l=20, r=20, t=30, b=20))
                st.plotly_chart(fig_up, use_container_width=True)

            with col_r:
                st.subheader("📉 En Çok Düşenler")
                fig_down = px.bar(
                    fallers.sort_values("ukd_degisimi", ascending=False),
                    x="ukd_degisimi",
                    y="oyuncu",
                    orientation="h",
                    text="ukd_degisimi",
                    color_discrete_sequence=["#EF4444"],
                    labels={"ukd_degisimi": "UKD Düşüşü", "oyuncu": ""},
                )
                fig_down.update_traces(texttemplate="%{text:.0f}", textposition="outside")
                fig_down.update_layout(height=max(360, 26 * top_n), margin=dict(l=20, r=20, t=30, b=20))
                st.plotly_chart(fig_down, use_container_width=True)

            st.caption(
                f"ℹ️ **{start_period}** → **{end_period}** dönemi karşılaştırıldı. "
                f"Kriterlere uyan toplam **{len(merged):,}** sporcu incelendi."
            )

            with st.expander("📊 Ayrıntılı Değişim Tablosu"):
                display_cols = [
                    "ad_soyad_bitis", "lisans_no", "kulup_bitis", "cinsiyet_bitis",
                    "guncel_ukd_baslangic", "guncel_ukd_bitis", "ukd_degisimi", "mac_farki"
                ]
                tab_df = merged[display_cols].sort_values("ukd_degisimi", ascending=False).reset_index(drop=True)
                tab_df = tab_df.rename(columns={
                    "ad_soyad_bitis": "Oyuncu",
                    "lisans_no": "Lisans",
                    "kulup_bitis": "Kulüp",
                    "cinsiyet_bitis": "Cinsiyet",
                    "guncel_ukd_baslangic": f"{start_period} UKD",
                    "guncel_ukd_bitis": f"{end_period} UKD",
                    "ukd_degisimi": "Net Değişim",
                    "mac_farki": "Oynanan Maç",
                })
                st.dataframe(tab_df, use_container_width=True)


# =============================================================================
# SAYFA 4: Kulüp Analizi (Club Analytics)
# =============================================================================
elif page == "🏛️ Kulüp Analizi":
    st.title("🏛️ Kulüp & Dernek UKD Analizi")
    st.markdown("KKTC Satranç Kulüplerinin sporcu kadrolarını, ortalama ve medyan rating güçlerini inceleyin.")

    c1, c2 = st.columns([1, 2])
    with c1:
        sel_period = st.selectbox("İncelenecek Dönem", period_names, index=len(period_names) - 1)
    
    snap = df[(df["period_name"] == sel_period) & (df["guncel_ukd"] > 0) & (df["kulup"] != "")].copy()
    
    # Kulüp istatistikleri
    club_stats = (
        snap.groupby("kulup")
        .agg(
            sporcu_sayisi=("lisans_no", "count"),
            ortalama_ukd=("guncel_ukd", "mean"),
            medyan_ukd=("guncel_ukd", "median"),
            en_yuksek_ukd=("guncel_ukd", "max"),
            toplam_mac=("kumulatif_mac_sayisi", "sum"),
        )
        .reset_index()
    )
    club_stats["ortalama_ukd"] = club_stats["ortalama_ukd"].round(1)
    club_stats["medyan_ukd"] = club_stats["medyan_ukd"].round(1)

    with c2:
        club_list = ["(Tüm Kulüpler)"] + sorted(club_stats["kulup"].tolist())
        target_club = st.selectbox("Kulüp Seçimi", club_list)

    # Genel kulüp gücü grafiği
    st.subheader(f"📊 {sel_period} Dönemi — Kulüp Ortalama UKD Karşılaştırması (En az 5 sporcusu olanlar)")
    filtered_clubs = club_stats[club_stats["sporcu_sayisi"] >= 5].sort_values("ortalama_ukd", ascending=True)

    fig_clubs = px.bar(
        filtered_clubs,
        x="ortalama_ukd",
        y="kulup",
        orientation="h",
        text="ortalama_ukd",
        color="sporcu_sayisi",
        color_continuous_scale="Blues",
        labels={"ortalama_ukd": "Ortalama UKD", "kulup": "", "sporcu_sayisi": "Sporcu Sayısı"},
    )
    fig_clubs.update_layout(height=max(400, len(filtered_clubs) * 25))
    st.plotly_chart(fig_clubs, use_container_width=True)

    # Seçilen kulüp detayı
    if target_club != "(Tüm Kulüpler)":
        st.markdown("---")
        st.subheader(f"🎯 {target_club} Sporcu Kadrosu ({sel_period})")
        c_players = snap[snap["kulup"] == target_club].sort_values("guncel_ukd", ascending=False).reset_index(drop=True)
        c_players.index += 1

        kpi1, kpi2, kpi3, kpi4 = st.columns(4)
        kpi1.metric("Dereceli Sporcu", len(c_players))
        kpi2.metric("Ortalama UKD", round(c_players["guncel_ukd"].mean(), 1))
        kpi3.metric("Medyan UKD", round(c_players["guncel_ukd"].median(), 1))
        kpi4.metric("En Yüksek UKD", int(c_players["guncel_ukd"].max()))

        disp_cols = ["ad_soyad", "unvan", "cinsiyet", "guncel_ukd", "degisim", "kumulatif_mac_sayisi", "durum"]
        c_disp = c_players[disp_cols].rename(columns={
            "ad_soyad": "Sporcu",
            "unvan": "Ünvan",
            "cinsiyet": "Cinsiyet",
            "guncel_ukd": "UKD",
            "degisim": "Dönem Değişimi",
            "kumulatif_mac_sayisi": "Toplam Maç",
            "durum": "Vize",
        })
        st.dataframe(c_disp, use_container_width=True)


# =============================================================================
# SAYFA 5: Genel Sıralama (Leaderboard / Master List)
# =============================================================================
elif page == "🏆 Genel Sıralama":
    st.title("🏆 Genel UKD Sıralaması (Leaderboard)")
    st.markdown("Yayınlanan döneme göre aktif tüm sporcuların genel kuvvet derecesi sıralaması.")

    f1, f2, f3, f4 = st.columns(4)
    with f1:
        rank_period = st.selectbox("Dönem Seçimi", period_names, index=len(period_names) - 1)
    with f2:
        clubs = ["(Tümü)"] + sorted(x for x in df["kulup"].dropna().unique() if x)
        rank_club = st.selectbox("Kulüp", clubs)
    with f3:
        titles = ["(Tümü)"] + [u for u in ["GM", "IM", "FM", "WGM", "WIM", "WFM", "CM", "WCM", "NM"] if u in df["unvan"].values]
        rank_title = st.selectbox("Ünvan", titles)
    with f4:
        rank_gender = st.selectbox("Cinsiyet", ["(Tümü)", "Erkek", "Kadın"])

    search_query = st.text_input("🔍 İsim veya Lisans Numarası ile Hızlı Arama", "")

    snap_rank = df[(df["period_name"] == rank_period) & (df["guncel_ukd"] > 0)].copy()

    if rank_club != "(Tümü)":
        snap_rank = snap_rank[snap_rank["kulup"] == rank_club]
    if rank_title != "(Tümü)":
        snap_rank = snap_rank[snap_rank["unvan"] == rank_title]
    if rank_gender != "(Tümü)":
        snap_rank = snap_rank[snap_rank["cinsiyet"] == rank_gender]
    if search_query.strip():
        q = search_query.strip().lower()
        snap_rank = snap_rank[
            snap_rank["ad_soyad"].str.lower().str.contains(q, na=False) |
            snap_rank["lisans_no"].str.contains(q, na=False)
        ]

    top_count = st.slider("Görüntülenecek Sporcu Sayısı", 10, 200, 50)
    board = (
        snap_rank.sort_values("guncel_ukd", ascending=False)
        .head(top_count)
        .reset_index(drop=True)
    )
    board.index += 1

    show_board = board[[
        "lisans_no", "ad_soyad", "unvan", "cinsiyet", "kulup",
        "guncel_ukd", "degisim", "kumulatif_mac_sayisi", "durum"
    ]].rename(columns={
        "lisans_no": "Lisans",
        "ad_soyad": "Sporcu",
        "unvan": "Ünvan",
        "cinsiyet": "Cinsiyet",
        "kulup": "Kulüp",
        "guncel_ukd": "UKD",
        "degisim": "Değişim",
        "kumulatif_mac_sayisi": "Toplam Maç",
        "durum": "Vize",
    })

    st.dataframe(show_board, use_container_width=True, height=min(38 * len(show_board) + 40, 750))
    st.caption(f"ℹ️ **{rank_period}** dönemi — Filtrelenen toplam **{len(snap_rank):,}** sporcu listeleniyor.")


# =============================================================================
# SAYFA 6: Dönem & Turnuva Arşivi (Period & Tournament Metadata)
# =============================================================================
elif page == "📜 Dönem & Turnuva Arşivi":
    st.title("📜 KKSF UKD Dönemleri ve Turnuva Arşivi")
    st.markdown("Mayıs 2022'den bu yana yayımlanan 49 dönemin detayları ve her hesaplamaya dahil edilen turnuvalar.")

    p_table = periods_df.copy().sort_values("date", ascending=False).reset_index(drop=True)
    p_table.index += 1
    p_table["date_str"] = p_table["date"].dt.strftime("%Y-%m-%d")

    # Arama
    t_search = st.text_input("Dönem veya Turnuva Adı Ara", "")
    if t_search.strip():
        q = t_search.strip().lower()
        p_table = p_table[
            p_table["period_name"].str.lower().str.contains(q, na=False) |
            p_table["tournaments_str"].str.lower().str.contains(q, na=False)
        ]

    st.dataframe(
        p_table[["period_name", "date_str", "tournaments_count", "tournaments_str"]].rename(columns={
            "period_name": "Dönem Adı",
            "date_str": "Yayın Tarihi",
            "tournaments_count": "Turnuva Sayısı",
            "tournaments_str": "Dahil Edilen Turnuvalar",
        }),
        use_container_width=True,
    )
