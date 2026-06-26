# KKSF UKD Performans Takip Uygulaması ♟️

KKTC Satranç Federasyonu'nun (KKSF) yayınladığı aylık **UKD** (FIDE ELO'su ile
aynı mantıkta ulusal kuvvet derecesi) listelerini otomatik indirip, oyuncuların
UKD performans değişimini interaktif grafiklerle gösteren bir Streamlit uygulaması.

**Veri kaynağı:** https://www.kksf.org/node/500 (aylık `.xlsx` UKD listeleri)

## Özellikler
- **Oyuncu Performansı** — bir oyuncuyu ada/lisans no'ya göre ara, UKD gelişim grafiği + istatistikler.
- **Çoklu Karşılaştırma** — 2+ oyuncunun UKD eğrilerini tek grafikte üst üste çiz.
- **En Çok Yükselen / Düşen** — seçilen iki ay arasında UKD'si en çok artan/azalan oyuncular.
- **Genel Sıralama** — seçilen ayın en yüksek UKD'li oyuncuları (kulübe göre filtrelenebilir).

## Kurulum
```bash
cd E:\Projeler\KDV_charts
pip install -r requirements.txt
```

## Çalıştırma
```bash
streamlit run app.py
```
Uygulama **http://localhost:8600** adresinde açılır. (Bu makinede varsayılan
8501 portu Windows tarafından rezerve edildiğinden `.streamlit/config.toml`
içinde port 8600'e sabitlendi. Bu portu değiştirmek isterseniz o dosyayı
düzenleyin.)

İlk açılışta tüm aylık listeler kksf.org'dan indirilir ve `data/` altında
önbelleğe alınır. Kenar çubuğundaki **🔄 Verileri güncelle** ile yeni aylar çekilir.

> **Not (port hatası):** `RuntimeError ... server.start()` hatası alırsanız
> port doludur. Başka bir port deneyin: `streamlit run app.py --server.port 8700`

### Sadece veriyi hazırlamak (UI olmadan)
```bash
python data_loader.py
```
Çıktılar: `data/combined_ukd.csv` ve `data/combined_ukd.parquet`
(tüm aylar birleşik uzun tablo; oyuncu kimliği = `lisans_no`, derece = `guncel_ukd`).

## Veri yapısı (her oyuncu/ay bir satır)
| Sütun | Açıklama |
|---|---|
| `lisans_no` | Oyuncu lisans no (kimlik anahtarı) |
| `ad_soyad`, `kulup`, `unvan` | Ad, kulüp/dernek, ünvan |
| `guncel_ukd` | O aydaki UKD (0 = derecesiz) |
| `onceki_ukd`, `degisim` | Bir önceki UKD ve değişim |
| `mac_sayisi`, `dogum_yili`, `durum` | Maç sayısı, doğum yılı, vize durumu |
| `date`, `year`, `month` | Listenin ait olduğu ay (dosya adından) |

## Notlar
- Federasyon bazı ayları yayınlamamış olabilir (ör. Ağustos 2025); grafikler boşlukları atlar.
- UKD = 0 olan satırlar (henüz vizesi/maçı olmayan) grafiklerde derecesiz sayılır.
