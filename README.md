# KKSF UKD Progress Explorer ♟️

Kuzey Kıbrıs Satranç Federasyonu'nun (KKSF) yeni web sitesi olan **[kksfed.org/ukd-lists](https://kksfed.org/ukd-lists)** üzerinde yayımlanan **Mayıs 2022 – Ekim 2026** arasındaki **49 döneme** ait resmi UKD listelerini otomatik toplayan, zaman serisi olarak eşleştiren ve derinlemesine oyuncu & kulüp analizi sunan interaktif web uygulaması.

**Veri kaynağı:** `https://kksfed.org/ukd-lists` (API: `https://api.kksfed.org/api/publications/public`)  
**Kapsam:** 49 Dönem, 1.722 Oyuncu, 78.115 Dönemsel Kayıt

---

## 🚀 Özellikler

1. **📈 Oyuncu Gelişimi (Player Progress)**:
   - İsim veya lisans numarası ile oyuncu arama.
   - Detaylı profil rozetleri (Ünvan, kulüp, cinsiyet, doğum yılı, vize durumu).
   - Metrik kartları: Güncel UKD, son dönem değişimi, kariyer zirve UKD'si (hangi dönemde ulaşıldığıyla), ilk gözlemlenen UKD, toplam net rating değişimi, kariyer toplam maç sayısı, en iyi liste sıralaması ve aktif dereceli dönem sayısı.
   - Zaman aralığı filtresi (Tüm dönemler, Son 12 ay, Son 3 dönem veya Özel Başlangıç/Bitiş).
   - Farklı grafik ölçütleri: **UKD Puanı**, **UKD Değişimi**, **Liste Sırası (Rank - ters eksen)**, **Kümülatif Maç Sayısı**.
   - İnteraktif Plotly grafiği (turnuva detaylı hover kutucukları, zirve noktası vurgusu).
   - Dönem bazlı ayrıntılı tablo ve dahil edilen turnuva listesi.

2. **👥 Çoklu Karşılaştırma (Multi-Player Comparison)**:
   - 2 ile 12 oyuncuyu tek bir grafikte karşılaştırma.
   - Ölçütler: UKD Puanı, İlk döneme göre kümülatif net puan kazanımı, Liste Sırası (Rank) veya Toplam Maç.
   - Yan yana özet kartları ve karşılaştırma tablosu.

3. **⚡ En Hızlı Yükselen / Düşen Oyuncular (Top Movers)**:
   - Herhangi iki dönem arasındaki net rating değişimini hesaplama.
   - Minimum dönem maç sayısı eşiği, cinsiyet ve kulüp filtreleri.
   - En çok yükselenler (yeşil) ve en çok düşenler (kırmızı) yan yana yatay bar grafikleri.

4. **🏛️ Kulüp Analizi (Club Analytics)**:
   - Kulüplerin toplam oyuncu sayısı, ortalama UKD ve medyan UKD karşılaştırması.
   - Kulüp kadro listesi, oyuncuların UKD'leri ve sıralamaları.

5. **🏆 Genel Sıralama (Leaderboard / Master List)**:
   - Seçilen dönemin tam UKD sıralaması.
   - Kulüp, Ünvan (GM, IM, FM, CM...), Cinsiyet, Vize durumu filtreleri ve hızlı isim/lisans araması.

6. **📜 Dönem & Turnuva Arşivi**:
   - 49 dönemin tarihleri, hesaplamaya dahil edilen toplam turnuva sayıları ve turnuva isimleri.

---

## 🛠️ Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Veri setini oluşturun veya güncelleyin (arka planda)
python data_loader.py

# Web JSON veri setini oluşturun (web/public/data/ukd.json)
python export_web_data.py

# Seçenek A: Masaüstü / Streamlit ile başlatın
streamlit run app.py

# Seçenek B: Modern Web Arayüzü (React + Vite)
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne üretim derlemesi
npm run preview  # Derlenmiş sürümü yerelde test edin

# Cloudflare Pages Dağıtımı
# Cloudflare Pages Dashboard üzerinden:
# - Root directory: web
# - Build command: npm run build
# - Build output directory: dist
# CLI ile doğrudan dağıtım:
npx wrangler pages deploy dist
```

---

## 📊 Veri Modeli (`combined_ukd.parquet` / `combined_ukd.csv`)

| Sütun | Açıklama |
|---|---|
| `lisans_no` | Oyuncu lisans numarası (kimlik anahtarı) |
| `ad_soyad` | Oyuncu adı soyadı |
| `cinsiyet` | Cinsiyet (`Erkek`, `Kadın`) |
| `unvan` | Resmi satranç ünvanı (`GM`, `IM`, `FM`, `CM`, `WFM`, vb.) |
| `kulup` | Kulüp / dernek |
| `dogum_yili` | Doğum yılı |
| `fide_no` | FIDE Sicil numarası |
| `guncel_ukd` | O dönemdeki güncel UKD (0 = derecesiz) |
| `onceki_ukd` | Bir önceki dönem UKD derecesi |
| `degisim` | O dönemki turnuvalardan gelen UKD değişimi |
| `toplam_degisim` | Oyuncunun ilk aktif döneminden bugüne toplam net değişimi |
| `sira_no` | O dönemdeki liste sırası |
| `donem_mac_sayisi` | O dönem oynanan resmi maç sayısı |
| `kumulatif_mac_sayisi` | Kariyer boyunca oynanan toplam maç sayısı |
| `durum` | Vize durumu (`Vizeli`, `Vizesiz`) |
| `period_name` | Dönem adı (Örn: `MAYIS 2022`, `EKİM 2026`) |
| `date` | Dönem yayın tarihi damgası |
| `tournaments_count` | Dönemde hesaplamaya dahil edilen turnuva sayısı |
| `tournaments_str` | Dahil edilen turnuvaların isimleri |
