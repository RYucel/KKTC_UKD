# -*- coding: utf-8 -*-
"""Birleşik UKD veri setini web arayüzü için kompakt bir JSON'a dönüştür.

Çıktı: web/public/data/ukd.json

Yapı (sütun bazlı, her oyuncu için dönem sayısı uzunluğunda diziler):
  periods : [{id, name, date, tournaments: [..]}]   (kronolojik)
  clubs   : [kulüp adı, ...]
  players : [{id, n, g, t, b, f, s, u, r, d, m, k, c}]
     id = lisans no, n = ad soyad, g = cinsiyet (E/K/""), t = ünvan,
     b = doğum yılı, f = FIDE no, s = son vize durumu
     u = UKD             (null = o dönem listede YOK, 0 = listede ama derecesiz)
     r = UKD sırası      (null/0 = sırasız)
     d = dönem değişimi
     m = dönem maç sayısı
     k = kümülatif maç sayısı
     c = kulüp indeksi   (clubs listesine; -1 = yok)

Önemli: Listede görünmeme (null) ile UKD = 0 ayrı tutulur; böylece eksik
dönemler gerçek rating değişiminden ayrılabilir.
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import pandas as pd

from data_loader import get_cached_publications_meta, load_dataset

PROJECT_DIR = Path(__file__).resolve().parent
OUT_PATH = PROJECT_DIR / "web" / "public" / "data" / "ukd.json"


def _num(v, ndigits: int = 0):
    """NaN -> None; tam sayıya veya ndigits ondalığa yuvarla (JSON boyutu için)."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    v = round(float(v), ndigits)
    return int(v) if v == int(v) else v


def export(out_path: Path = OUT_PATH) -> dict:
    df = load_dataset(refresh=False).copy()
    df["date"] = pd.to_datetime(df["date"])
    if "ukd_sirasi" not in df.columns:
        raise RuntimeError("ukd_sirasi sütunu yok; önce `python data_loader.py` çalıştırın.")

    # --- Dönemler (kronolojik) ---
    meta = {p["id"]: p for p in get_cached_publications_meta()}
    periods_df = (
        df[["period_id", "period_name", "date"]]
        .drop_duplicates("period_id")
        .sort_values("date")
        .reset_index(drop=True)
    )
    period_pos = {pid: i for i, pid in enumerate(periods_df["period_id"])}
    periods = [
        {
            "id": row.period_id,
            "name": row.period_name,
            "date": row.date.strftime("%Y-%m-%d"),
            "tournaments": [t.get("name", "") for t in meta.get(row.period_id, {}).get("tournaments", [])],
        }
        for row in periods_df.itertuples()
    ]
    n_per = len(periods)

    # --- Kulüpler ---
    clubs = sorted(c for c in df["kulup"].fillna("").unique() if c)
    club_pos = {c: i for i, c in enumerate(clubs)}

    # --- Oyuncular ---
    df["period_idx"] = df["period_id"].map(period_pos)
    gender_map = {"Erkek": "E", "Kadın": "K"}
    players = []
    for lic, g in df.sort_values("date").groupby("lisans_no", sort=False):
        last = g.iloc[-1]
        u = [None] * n_per
        r = [None] * n_per
        d = [None] * n_per
        m = [None] * n_per
        k = [None] * n_per
        c = [-1] * n_per
        for row in g.itertuples():
            i = row.period_idx
            u[i] = _num(row.guncel_ukd, 1)
            r[i] = _num(row.ukd_sirasi) or None
            d[i] = _num(row.degisim, 1)
            m[i] = _num(row.donem_mac_sayisi)
            k[i] = _num(row.kumulatif_mac_sayisi)
            c[i] = club_pos.get(row.kulup or "", -1)
        players.append({
            "id": str(lic),
            "n": last["ad_soyad"] or "",
            "g": gender_map.get(last["cinsiyet"], ""),
            "t": last["unvan"] or "",
            "b": _num(last["dogum_yili"]) or None,
            "f": _num(last["fide_no"]) or None,
            "s": last["durum"] or "",
            "u": u, "r": r, "d": d, "m": m, "k": k, "c": c,
        })

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "https://kksfed.org/ukd-lists",
        "periods": periods,
        "clubs": clubs,
        "players": players,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    print(f"Yazıldı: {out_path} ({size_kb:,.0f} KB) — "
          f"{len(players):,} oyuncu, {n_per} dönem, {len(clubs)} kulüp.")
    return payload


if __name__ == "__main__":
    export()
