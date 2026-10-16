# -*- coding: utf-8 -*-
"""KKSF UKD Veri Kazıyıcı ve Zaman Serisi Motoru (kksfed.org).

Veri kaynağı: https://kksfed.org/ukd-lists
API: https://api.kksfed.org/api/publications/public

Mayıs 2022'den günümüze tüm yayınlanmış UKD listelerini indirir,
ayrıştırır, oyuncu kimliklerini eşleştirir ve tek bir Parquet/CSV zaman serisi
tablosuna birleştirir.
"""
from __future__ import annotations

import io
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import pandas as pd
import requests

# --- Sabitler ---------------------------------------------------------------
API_BASE = "https://api.kksfed.org/api"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"
RAW_DIR = DATA_DIR / "raw_kksfed"
META_PATH = DATA_DIR / "publications_meta.json"
COMBINED_PARQUET = DATA_DIR / "combined_ukd.parquet"
COMBINED_CSV = DATA_DIR / "combined_ukd.csv"

RAW_DIR.mkdir(parents=True, exist_ok=True)


# --- Yardımcılar ------------------------------------------------------------
def fetch_publications_meta() -> list[dict]:
    """https://api.kksfed.org/api/publications/public adresinden tüm dönemleri çek."""
    url = f"{API_BASE}/publications/public"
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    pubs = r.json().get("publications", [])
    pubs.sort(key=lambda x: x["publicationDate"])
    META_PATH.write_text(json.dumps(pubs, ensure_ascii=False, indent=2), encoding="utf-8")
    return pubs


def get_cached_publications_meta() -> list[dict]:
    """Yerelde varsa meta dosyasından oku, yoksa API'den çek."""
    if META_PATH.exists():
        try:
            with open(META_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return fetch_publications_meta()


def _safe_filename(pub: dict) -> str:
    pdate = pub["publicationDate"][:10]
    pname = pub["name"]
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", f"{pdate}_{pname}").strip("_") + ".xlsx"


def download_publications(force: bool = False, delay: float = 0.5) -> list[tuple[dict, Path]]:
    """Eksik (veya force=True ise tüm) dönemlerin Excel dosyalarını indir."""
    pubs = fetch_publications_meta() if force or not META_PATH.exists() else get_cached_publications_meta()
    out = []

    for idx, pub in enumerate(pubs, 1):
        pid = pub["id"]
        fname = _safe_filename(pub)
        dest = RAW_DIR / fname

        if dest.exists() and dest.stat().st_size > 10000 and not force:
            out.append((pub, dest))
            continue

        url = f"{API_BASE}/publications/public/{pid}/rankings/export"
        print(f"[{idx}/{len(pubs)}] İndiriliyor: {pub['name']} ({pub['publicationDate'][:10]})...", flush=True)

        for attempt in range(5):
            try:
                resp = requests.get(url, headers=HEADERS, timeout=45)
                if resp.status_code == 429:
                    wait_sec = 3 * (attempt + 1)
                    print(f"   [429 Hız Sınırı] {wait_sec}s bekleniyor...", flush=True)
                    time.sleep(wait_sec)
                    continue
                resp.raise_for_status()
                dest.write_bytes(resp.content)
                out.append((pub, dest))
                break
            except Exception as e:
                if attempt == 4:
                    print(f"   [HATA] {pub['name']} indirilemedi: {e}", flush=True)
                time.sleep(2)

        time.sleep(delay)

    return out


def parse_publication_file(dest: Path, pub: dict, period_index: int) -> pd.DataFrame:
    """Tek bir Excel dosyasını standart sütunlara dönüştür."""
    # Satır 0 başlık ("KKSF | Sporcu Takip Uygulaması"), Satır 1 sütun isimleri
    raw = pd.read_excel(dest, header=1)

    col_rename = {
        "S.N.": "sira_no",
        "ÜNVAN": "unvan",
        "LİSANS NU.": "lisans_no",
        "SOYADI ADI": "ad_soyad",
        "C.": "cinsiyet",
        "FİDE NO": "fide_no",
        "KULÜP/DERNEK": "kulup",
        "DOĞUM YILI": "dogum_yili",
        "MAÇ SAYISI": "donem_mac_sayisi",
        "KÜMÜLATİF MAÇ SAYISI": "kumulatif_mac_sayisi",
        "BİR ÖNCEKİ UKD": "onceki_ukd",
        "GÜNCEL UKD": "guncel_ukd",
        "DURUMU": "durum",
        "DEĞİŞİM": "degisim",
    }
    df = raw.rename(columns=col_rename)

    # Lisans no temizliği (boşlukları at, .0 uzantısını kaldır, baştaki sıfırları temizle)
    if "lisans_no" not in df.columns:
        return pd.DataFrame()

    df = df.dropna(subset=["lisans_no"])
    df["lisans_no"] = df["lisans_no"].astype(str).str.strip().str.replace(r"\.0$", "", regex=True)
    df = df[df["lisans_no"].str.match(r"^\d+$", na=False)].copy()
    df["lisans_no"] = df["lisans_no"].str.lstrip("0").replace("", "0")

    # Sayısal alanlar
    numeric_cols = [
        "sira_no", "guncel_ukd", "onceki_ukd", "degisim",
        "donem_mac_sayisi", "kumulatif_mac_sayisi", "dogum_yili",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Metin alanları
    text_cols = ["unvan", "ad_soyad", "cinsiyet", "kulup", "durum"]
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().replace({"nan": "", "None": "", "-": ""})

    # Dönem ve zaman bilgileri
    dt = pd.to_datetime(pub["publicationDate"])
    df["period_id"] = pub["id"]
    df["period_name"] = pub["name"]
    df["date"] = dt
    df["year"] = dt.year
    df["month"] = dt.month
    df["period_index"] = period_index
    df["tournaments_count"] = len(pub.get("tournaments", []))
    df["tournaments_str"] = ", ".join(t.get("name", "") for t in pub.get("tournaments", []))

    return df


def build_dataset(force_download: bool = False) -> pd.DataFrame:
    """Tüm dönem dosyalarını indirir (gerekirse), ayrıştırır ve tek tablo olarak kaydeder."""
    items = download_publications(force=force_download)
    frames = []

    print(f"Toplam {len(items)} dosya ayrıştırılıyor...", flush=True)
    for idx, (pub, dest) in enumerate(items, 1):
        try:
            f = parse_publication_file(dest, pub, period_index=idx)
            if not f.empty:
                frames.append(f)
        except Exception as e:
            print(f"  ! {dest.name} ayrıştırılamadı: {e}", flush=True)

    if not frames:
        raise RuntimeError("Hiçbir liste ayrıştırılamadı!")

    combined = pd.concat(frames, ignore_index=True)

    # Tekilleştirme & sıralama
    combined = combined.drop_duplicates(subset=["lisans_no", "date"], keep="last")
    combined = combined.sort_values(["lisans_no", "date"]).reset_index(drop=True)

    # Oyuncunun ilk aktif olduğu dönemden bugüne kümülatif rating değişimi
    # (Önemli: UKD > 0 olan ilk gözlem baz alınır)
    rated_mask = combined["guncel_ukd"] > 0

    # Excel dosyalarındaki "DEĞİŞİM" sütunu sayı değil "↑"/"↓" oku içerdiği için
    # dönemsel UKD değişimini ardışık dereceli dönemlerin farkından hesapla:
    combined["degisim"] = 0.0
    period_diff = combined[rated_mask].groupby("lisans_no")["guncel_ukd"].diff()
    first_period_fallback = combined.loc[rated_mask].apply(
        lambda r: (r["guncel_ukd"] - r["onceki_ukd"]) if r["onceki_ukd"] > 0 else 0.0,
        axis=1,
    )
    combined.loc[rated_mask, "degisim"] = period_diff.fillna(first_period_fallback).round(1)

    first_ratings = (
        combined[rated_mask]
        .groupby("lisans_no")["guncel_ukd"]
        .first()
        .rename("ilk_ukd")
    )
    combined = combined.merge(first_ratings, on="lisans_no", how="left")
    combined["toplam_degisim"] = combined["guncel_ukd"] - combined["ilk_ukd"]

    # Gerçek UKD sırası: Excel'deki "S.N." alfabetik sıradır, sıralama değildir.
    # Resmi site (API) ile aynı tanım: o dönemde UKD > 0 olanlar arasında
    # UKD'ye göre azalan sıra (eşitlikte aynı sıra).
    combined["ukd_sirasi"] = 0
    combined.loc[rated_mask, "ukd_sirasi"] = (
        combined[rated_mask]
        .groupby("date")["guncel_ukd"]
        .rank(method="min", ascending=False)
        .astype(int)
    )

    # Disk önbelleğine yaz
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        combined.to_parquet(COMBINED_PARQUET, index=False)
    except Exception as e:
        print(f"Parquet kaydedilemedi: {e}", flush=True)

    combined.to_csv(COMBINED_CSV, index=False, encoding="utf-8-sig")
    print(f"Veri seti başarıyla oluşturuldu: {len(combined):,} satır, "
          f"{combined['lisans_no'].nunique():,} oyuncu, {combined['date'].nunique()} dönem.", flush=True)
    return combined


def load_dataset(refresh: bool = False) -> pd.DataFrame:
    """Yerel önbellekten (Parquet/CSV) yükle; yoksa veya refresh=True ise oluştur."""
    if not refresh:
        if COMBINED_PARQUET.exists():
            try:
                df = pd.read_parquet(COMBINED_PARQUET)
                df["date"] = pd.to_datetime(df["date"])
                return df
            except Exception:
                pass
        if COMBINED_CSV.exists():
            df = pd.read_csv(COMBINED_CSV, dtype={"lisans_no": str})
            df["date"] = pd.to_datetime(df["date"])
            return df

    return build_dataset(force_download=refresh)


def player_catalog(df: pd.DataFrame) -> pd.DataFrame:
    """Oyuncuların en güncel profil bilgilerini ve arama etiketlerini içeren katalog."""
    latest = df.sort_values("date").groupby("lisans_no").tail(1)
    
    # En yüksek UKD
    max_ukd = df[df["guncel_ukd"] > 0].groupby("lisans_no")["guncel_ukd"].max().rename("zirve_ukd")
    active_periods = df[df["guncel_ukd"] > 0].groupby("lisans_no")["date"].count().rename("aktif_donem_sayisi")
    
    latest = latest.merge(max_ukd, on="lisans_no", how="left").merge(active_periods, on="lisans_no", how="left")
    latest["zirve_ukd"] = latest["zirve_ukd"].fillna(0).astype(int)
    latest["aktif_donem_sayisi"] = latest["aktif_donem_sayisi"].fillna(0).astype(int)

    # Arama etiketi: AD SOYAD (Lisans: XXX | Kulüp | UKD)
    def make_label(row):
        name = row["ad_soyad"] if row["ad_soyad"] else "Bilinmeyen"
        ukd_str = f" • UKD: {int(row['guncel_ukd'])}" if row["guncel_ukd"] > 0 else " • Derecesiz"
        club_str = f" • {row['kulup']}" if row["kulup"] else ""
        title_str = f"[{row['unvan']}] " if row["unvan"] else ""
        return f"{title_str}{name} (No: {row['lisans_no']}{ukd_str}{club_str})"

    latest["label"] = latest.apply(make_label, axis=1)
    cols = [
        "lisans_no", "label", "ad_soyad", "kulup", "unvan",
        "cinsiyet", "dogum_yili", "guncel_ukd", "zirve_ukd",
        "kumulatif_mac_sayisi", "aktif_donem_sayisi", "durum"
    ]
    return latest[cols].reset_index(drop=True)


if __name__ == "__main__":
    print("KKSF UKD Veri Seti İnşa Ediliyor...")
    data = build_dataset(force_download=False)
    print(f"Toplam {len(data):,} satır, {data['lisans_no'].nunique():,} oyuncu.")
    print("Dönemler:", sorted(data["period_name"].unique()))
