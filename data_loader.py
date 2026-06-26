# -*- coding: utf-8 -*-
"""KKSF UKD listelerini indir, ayrıştır ve tek bir zaman serisi tablosuna birleştir.

Veri kaynağı: https://www.kksf.org/node/500  (aylık .xlsx UKD listeleri)

Her liste, oyuncu başına bir satır içerir. Oyuncu kimliği = LİSANS NU.
Ayın UKD değeri = "GÜNCEL UKD". Tarih, dosya adından çıkarılır.
"""
from __future__ import annotations

import io
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

import pandas as pd
import requests

# --- Sabitler ---------------------------------------------------------------
LIST_PAGE = "https://www.kksf.org/node/500"
BASE_URL = "https://www.kksf.org"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

PROJECT_DIR = Path(__file__).resolve().parent
RAW_DIR = PROJECT_DIR / "data" / "raw"
COMBINED_PARQUET = PROJECT_DIR / "data" / "combined_ukd.parquet"
COMBINED_CSV = PROJECT_DIR / "data" / "combined_ukd.csv"

TR_MONTHS = {
    "ocak": 1, "subat": 2, "şubat": 2, "mart": 3, "nisan": 4, "mayis": 5,
    "mayıs": 5, "haziran": 6, "temmuz": 7, "agustos": 8, "ağustos": 8,
    "eylul": 9, "eylül": 9, "ekim": 10, "kasim": 11, "kasım": 11,
    "aralik": 12, "aralık": 12,
}

# Türkçe başlık -> standart sütun adı (alt-dize eşleşmesiyle)
COLUMN_PATTERNS = [
    ("LİSANS", "lisans_no"),
    ("LISANS", "lisans_no"),
    ("SOYADI", "ad_soyad"),
    ("ÜNVAN", "unvan"),
    ("UNVAN", "unvan"),
    ("FİDE", "fide_no"),
    ("FIDE", "fide_no"),
    ("KULÜP", "kulup"),
    ("KULUP", "kulup"),
    ("DERNEK", "kulup"),
    ("DOĞUM", "dogum_yili"),
    ("DOGUM", "dogum_yili"),
    ("MAÇ", "mac_sayisi"),
    ("MAC", "mac_sayisi"),
    ("ÖNCEK", "onceki_ukd"),
    ("ONCEK", "onceki_ukd"),
    ("GÜNCEL", "guncel_ukd"),
    ("GUNCEL", "guncel_ukd"),
    ("DURUM", "durum"),
    ("DEĞİŞİM", "degisim"),
    ("DEGISIM", "degisim"),
]


# --- Yardımcılar ------------------------------------------------------------
def _strip_accents_upper(text: str) -> str:
    """Türkçe karakterleri sadeleştir + büyük harf (eşleştirme için)."""
    text = str(text).strip()
    repl = {"İ": "I", "ı": "i", "Ş": "S", "ş": "s", "Ğ": "G", "ğ": "g",
            "Ü": "U", "ü": "u", "Ö": "O", "ö": "o", "Ç": "C", "ç": "c"}
    for a, b in repl.items():
        text = text.replace(a, b)
    return text.upper()


def parse_month_year(filename: str) -> tuple[int, int] | None:
    """Dosya adından (yıl, ay) çıkar. Örn: '04-nisan_2026_ukd_listesi.xlsx'."""
    name = filename.lower()
    year_m = re.search(r"(20\d{2})", name)
    if not year_m:
        return None
    year = int(year_m.group(1))
    # 1) Baştaki sayı önekini dene (en güvenilir): '04-...', '12-_...'
    lead = re.match(r"\s*(\d{1,2})\s*[-_]", name)
    month = int(lead.group(1)) if lead and 1 <= int(lead.group(1)) <= 12 else None
    # 2) Ay adından doğrula / tamamla
    if month is None:
        for mname, mnum in TR_MONTHS.items():
            if mname in name:
                month = mnum
                break
    if month is None:
        return None
    return year, month


def fetch_list_links() -> list[dict]:
    """node/500 sayfasını tarayıp tüm UKD .xlsx bağlantılarını döndür."""
    r = requests.get(LIST_PAGE, headers=HEADERS, timeout=30)
    r.raise_for_status()
    hrefs = sorted(set(re.findall(r'href="([^"]+\.xlsx)"', r.text)))
    out = []
    for href in hrefs:
        low = href.lower()
        if not any(k in low for k in ("ukd", "liste", "kesin")):
            continue
        url = href if href.startswith("http") else BASE_URL + href
        fname = url.rsplit("/", 1)[-1]
        ym = parse_month_year(fname)
        if ym is None:
            continue
        year, month = ym
        out.append({"url": url, "filename": fname, "year": year,
                    "month": month, "date": date(year, month, 1)})
    out.sort(key=lambda d: d["date"])
    return out


def download_lists(force: bool = False) -> list[dict]:
    """Eksik (veya force ise tüm) listeleri data/raw/ içine indir."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    links = fetch_list_links()
    for item in links:
        dest = RAW_DIR / item["filename"]
        item["path"] = dest
        if dest.exists() and not force:
            continue
        resp = requests.get(item["url"], headers=HEADERS, timeout=120)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
    return links


def _find_header_row(raw: pd.DataFrame) -> int:
    """'LİSANS' içeren satırı başlık satırı olarak bul."""
    for i in range(min(10, len(raw))):
        row = " ".join(_strip_accents_upper(c) for c in raw.iloc[i].astype(str))
        if "LISANS" in row:
            return i
    return 1  # varsayılan: ikinci satır


def parse_list_file(path: Path, year: int, month: int) -> pd.DataFrame:
    """Tek bir UKD .xlsx dosyasını standart sütunlu DataFrame'e çevir."""
    raw = pd.read_excel(path, header=None, dtype=str)
    hrow = _find_header_row(raw)
    headers = raw.iloc[hrow].tolist()

    colmap = {}
    for idx, h in enumerate(headers):
        hu = _strip_accents_upper(h)
        for pat, std in COLUMN_PATTERNS:
            if _strip_accents_upper(pat) in hu:
                colmap[idx] = std
                break

    data = raw.iloc[hrow + 1:].reset_index(drop=True)
    df = pd.DataFrame()
    for idx, std in colmap.items():
        if std not in df.columns:  # ilk eşleşeni kullan
            df[std] = data[idx]

    if "lisans_no" not in df.columns or "guncel_ukd" not in df.columns:
        return pd.DataFrame()

    # Temizlik
    df = df.dropna(subset=["lisans_no"])
    df["lisans_no"] = df["lisans_no"].astype(str).str.strip()
    df = df[df["lisans_no"].str.match(r"^\d+$", na=False)].copy()
    df["lisans_no"] = df["lisans_no"].str.lstrip("0").replace("", "0")

    for col in ["guncel_ukd", "onceki_ukd", "mac_sayisi", "degisim", "dogum_yili"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(",", ".", regex=False),
                                    errors="coerce")

    for col in ["ad_soyad", "kulup", "unvan", "durum"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().replace({"nan": "", "-": ""})

    df["year"] = year
    df["month"] = month
    df["date"] = pd.Timestamp(year=year, month=month, day=1)
    df["source_file"] = path.name
    return df


def build_dataset(force_download: bool = False) -> pd.DataFrame:
    """Tüm listeleri indirip tek uzun tabloya birleştir ve önbelleğe yaz."""
    links = download_lists(force=force_download)
    frames = []
    for item in links:
        try:
            f = parse_list_file(item["path"], item["year"], item["month"])
            if not f.empty:
                frames.append(f)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {item['filename']} ayrıştırılamadı: {e}")
    if not frames:
        raise RuntimeError("Hiç liste ayrıştırılamadı.")

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.drop_duplicates(subset=["lisans_no", "date"], keep="last")
    combined = combined.sort_values(["lisans_no", "date"]).reset_index(drop=True)

    COMBINED_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    try:
        combined.to_parquet(COMBINED_PARQUET, index=False)
    except Exception:  # pyarrow yoksa
        pass
    combined.to_csv(COMBINED_CSV, index=False, encoding="utf-8-sig")
    return combined


def load_dataset(refresh: bool = False) -> pd.DataFrame:
    """Önbellekten yükle; yoksa veya refresh ise yeniden oluştur."""
    if not refresh:
        if COMBINED_PARQUET.exists():
            try:
                return pd.read_parquet(COMBINED_PARQUET)
            except Exception:
                pass
        if COMBINED_CSV.exists():
            return pd.read_csv(COMBINED_CSV, dtype={"lisans_no": str})
    return build_dataset(force_download=refresh)


def player_label(df: pd.DataFrame) -> pd.DataFrame:
    """Her lisans_no için en güncel ad/kulüp ile etiket tablosu."""
    latest = df.sort_values("date").groupby("lisans_no").tail(1)
    latest = latest.assign(
        label=lambda d: d["ad_soyad"].fillna("?") + "  (" + d["lisans_no"] + ")")
    return latest[["lisans_no", "label", "ad_soyad", "kulup"]].reset_index(drop=True)


if __name__ == "__main__":
    print("UKD listeleri indiriliyor ve birleştiriliyor...")
    data = build_dataset(force_download=False)
    print(f"Toplam {len(data):,} satır, {data['lisans_no'].nunique():,} oyuncu, "
          f"{data['date'].nunique()} ay.")
    print("Aylar:", sorted(data['date'].dt.strftime('%Y-%m').unique()))
