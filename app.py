# -*- coding: utf-8 -*-
"""KKSF UKD Performans Takip Uygulaması (Streamlit).

Çalıştırma:  streamlit run app.py
"""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from data_loader import build_dataset, load_dataset, player_label

st.set_page_config(page_title="KKSF UKD Performans Takibi",
                   page_icon="♟️", layout="wide")


# --- Veri yükleme (önbellekli) ---------------------------------------------
@st.cache_data(show_spinner="UKD listeleri yükleniyor...")
def get_data() -> pd.DataFrame:
    return load_dataset(refresh=False)


@st.cache_data(show_spinner="Tüm listeler kksf.org'dan indiriliyor...")
def refresh_data() -> pd.DataFrame:
    return build_dataset(force_download=False)  # yeni ayları indirir


def rating_series(df_player: pd.DataFrame) -> pd.DataFrame:
    """Yalnızca UKD'si olan (>0) ayları döndür."""
    s = df_player[df_player["guncel_ukd"] > 0].sort_values("date")
    return s[["date", "guncel_ukd", "mac_sayisi", "durum", "kulup"]]


# --- Başlat ----------------------------------------------------------------
try:
    df = get_data()
except Exception as e:  # noqa: BLE001
    st.error(f"Veri yüklenemedi: {e}")
    st.stop()

labels = player_label(df)
label_to_lisans = dict(zip(labels["label"], labels["lisans_no"]))
all_labels = sorted(label_to_lisans.keys())
months = sorted(df["date"].dt.strftime("%Y-%m").unique())

# --- Kenar çubuğu -----------------------------------------------------------
st.sidebar.title("♟️ KKSF UKD Takibi")
st.sidebar.caption(
    f"{df['lisans_no'].nunique():,} oyuncu • {len(months)} ay "
    f"({months[0]} → {months[-1]})")

if st.sidebar.button("🔄 Verileri güncelle (kksf.org)"):
    st.cache_data.clear()
    refresh_data()
    st.rerun()

page = st.sidebar.radio(
    "Görünüm",
    ["Oyuncu Performansı", "Çoklu Karşılaştırma",
     "En Çok Yükselen / Düşen", "Genel Sıralama"],
)
st.sidebar.markdown("---")
st.sidebar.caption("Kaynak: kksf.org/node/500 — UKD aylık listeleri")


# === SAYFA 1: Oyuncu Performansı ===========================================
if page == "Oyuncu Performansı":
    st.header("Oyuncu UKD Performansı")
    sel = st.selectbox("Oyuncu seç (ad veya lisans no ile ara)", all_labels)
    lisans = label_to_lisans[sel]
    p = df[df["lisans_no"] == lisans]
    s = rating_series(p)

    if s.empty:
        st.warning("Bu oyuncunun henüz UKD değeri (vize/maç) yok.")
    else:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Güncel UKD", int(s["guncel_ukd"].iloc[-1]))
        c2.metric("En yüksek", int(s["guncel_ukd"].max()))
        c3.metric("İlk → Son değişim",
                  int(s["guncel_ukd"].iloc[-1] - s["guncel_ukd"].iloc[0]),
                  delta=int(s["guncel_ukd"].iloc[-1] - s["guncel_ukd"].iloc[0]))
        c4.metric("Toplam maç", int(p["mac_sayisi"].max()))

        fig = px.line(s, x="date", y="guncel_ukd", markers=True,
                      labels={"date": "Tarih", "guncel_ukd": "UKD"},
                      title=f"{p['ad_soyad'].iloc[-1]} — UKD Gelişimi")
        fig.update_traces(line=dict(width=3))
        fig.update_layout(hovermode="x unified", height=480)
        st.plotly_chart(fig, use_container_width=True)

        st.caption(f"Kulüp: {p['kulup'].iloc[-1]}  •  Lisans: {lisans}")
        with st.expander("Ayrıntılı tablo"):
            st.dataframe(s.assign(date=s["date"].dt.strftime("%Y-%m")),
                         use_container_width=True, hide_index=True)


# === SAYFA 2: Çoklu Karşılaştırma ==========================================
elif page == "Çoklu Karşılaştırma":
    st.header("Çoklu Oyuncu Karşılaştırma")
    sels = st.multiselect("Oyuncuları seç (2 veya daha fazla)", all_labels,
                          max_selections=12)
    if len(sels) < 2:
        st.info("Karşılaştırmak için en az 2 oyuncu seçin.")
    else:
        fig = go.Figure()
        for sel in sels:
            lisans = label_to_lisans[sel]
            p = df[df["lisans_no"] == lisans]
            s = rating_series(p)
            if s.empty:
                continue
            fig.add_trace(go.Scatter(
                x=s["date"], y=s["guncel_ukd"], mode="lines+markers",
                name=p["ad_soyad"].iloc[-1], line=dict(width=2.5)))
        fig.update_layout(
            title="UKD Karşılaştırması", xaxis_title="Tarih",
            yaxis_title="UKD", hovermode="x unified", height=560,
            legend=dict(orientation="h", yanchor="bottom", y=1.02))
        st.plotly_chart(fig, use_container_width=True)


# === SAYFA 3: En Çok Yükselen / Düşen ======================================
elif page == "En Çok Yükselen / Düşen":
    st.header("En Çok Yükselen ve Düşen Oyuncular")
    c1, c2, c3 = st.columns(3)
    start = c1.selectbox("Başlangıç ayı", months, index=max(0, len(months) - 4))
    end = c2.selectbox("Bitiş ayı", months, index=len(months) - 1)
    topn = c3.slider("Kaç oyuncu?", 5, 30, 15)
    min_games = st.slider("Minimum maç sayısı (gürültüyü azaltır)", 0, 50, 5)

    if start >= end:
        st.warning("Başlangıç ayı bitiş ayından önce olmalı.")
    else:
        a = df[(df["date"].dt.strftime("%Y-%m") == start) & (df["guncel_ukd"] > 0)]
        b = df[(df["date"].dt.strftime("%Y-%m") == end) & (df["guncel_ukd"] > 0)]
        m = a.merge(b, on="lisans_no", suffixes=("_a", "_b"))
        m = m[m["mac_sayisi_b"] >= min_games].copy()
        m["degisim"] = m["guncel_ukd_b"] - m["guncel_ukd_a"]
        m["oyuncu"] = m["ad_soyad_b"].fillna(m["lisans_no"])

        risers = m.nlargest(topn, "degisim")
        fallers = m.nsmallest(topn, "degisim")

        colL, colR = st.columns(2)
        with colL:
            st.subheader("📈 En çok yükselenler")
            fig = px.bar(risers.sort_values("degisim"), x="degisim", y="oyuncu",
                         orientation="h", text="degisim",
                         color_discrete_sequence=["#2E8B57"],
                         labels={"degisim": "UKD değişimi", "oyuncu": ""})
            fig.update_layout(height=20 * topn + 120, yaxis=dict(tickfont=dict(size=11)))
            st.plotly_chart(fig, use_container_width=True)
        with colR:
            st.subheader("📉 En çok düşenler")
            fig = px.bar(fallers.sort_values("degisim", ascending=False),
                         x="degisim", y="oyuncu", orientation="h", text="degisim",
                         color_discrete_sequence=["#C0392B"],
                         labels={"degisim": "UKD değişimi", "oyuncu": ""})
            fig.update_layout(height=20 * topn + 120, yaxis=dict(tickfont=dict(size=11)))
            st.plotly_chart(fig, use_container_width=True)

        st.caption(f"{start} → {end} arası, en az {min_games} maçlı oyuncular "
                   f"({len(m):,} oyuncu karşılaştırıldı).")


# === SAYFA 4: Genel Sıralama ===============================================
elif page == "Genel Sıralama":
    st.header("Genel Sıralama (Leaderboard)")
    c1, c2 = st.columns([1, 2])
    month = c1.selectbox("Ay", months, index=len(months) - 1)
    snap = df[(df["date"].dt.strftime("%Y-%m") == month) & (df["guncel_ukd"] > 0)].copy()

    clubs = ["(Tümü)"] + sorted(x for x in snap["kulup"].dropna().unique() if x)
    club = c2.selectbox("Kulüp / Dernek", clubs)
    if club != "(Tümü)":
        snap = snap[snap["kulup"] == club]

    topn = st.slider("Kaç oyuncu gösterilsin?", 10, 100, 25)
    board = (snap.sort_values("guncel_ukd", ascending=False)
                 .head(topn)
                 .reset_index(drop=True))
    board.index += 1
    show = board[["ad_soyad", "kulup", "guncel_ukd", "degisim", "mac_sayisi", "unvan"]]
    show = show.rename(columns={"ad_soyad": "Oyuncu", "kulup": "Kulüp",
                                "guncel_ukd": "UKD", "degisim": "Değişim",
                                "mac_sayisi": "Maç", "unvan": "Ünvan"})
    st.dataframe(show, use_container_width=True, height=min(35 * topn + 40, 800))
    st.caption(f"{month} — {len(snap):,} dereceli oyuncu.")
