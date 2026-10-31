# CAD Lab

Hasan Yahşi tarafından başlatılan bağımsız açık kaynak CAD projesi.
**CAD Lab geçici çalışma adıdır; ürün adı birlikte seçilecek.**

Uzun vadeli hedef: ölçülü eskizler, düzenlenebilir katı modeller, montajlar,
teknik çizimler ve güvenilir dosya alışverişi sunan, çevrimdışı kullanılabilen CAD.
Ticari kullanım için zorunlu abonelik hedeflenmiyor.

İlk mühendislik adımı: dört delikli bir plaka oluşturmak, ölçülerini değiştirmek,
projeyi kaydedip yeniden açmak ve STEP dışa aktarmak. Genel amaçlı eskiz,
montaj veya AutoCAD/Fusion eşdeğerliği henüz tamamlanmış özellikler değildir.

Gelişmeler küçük commit'ler, tekrar üretilebilir örnekler ve doğrulama sonuçlarıyla
GitHub'da izlenir. Kişisel web sitesi ve bağlantı sayfalarından ayrı bir projedir.

## Yerelde çalıştırma

Python 3.12 ve Node.js 24 ile Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e .
npm --prefix web ci
npm --prefix web run build
.\.venv\Scripts\python.exe -m cad_lab.server
```

Tarayıcıda **http://127.0.0.1:4310** adresini açın. Ölçüleri değiştirdikten sonra
“Modeli oluştur” düğmesine basın. Hatalı ölçülerde önceki geçerli model korunur;
uygulanmamış değişiklikler varken indirmeler kapatılır. Proje dosyası düzenlenebilir
ölçüleri saklar; STEP dosyası işlem geçmişinin yerine geçmez.

Görünümde ok tuşları döndürür, `+`/`-` yakınlaştırır, `F` modeli sığdırır.
Hesap veya bulut geometri servisi gerekmez. Bağımlılıklar kurulduktan sonra model
işlemleri yerelde çalışır. Sunucu yalnız bu bilgisayardan erişilecek şekilde açılır.

İlk sürümde dört delikli plaka, ölçü değişiklikleri, geri al/yinele, proje aç/kaydet
ve STEP/STL indirme çalışır. Genel amaçlı eskiz, montaj, DWG ve kurulum paketi henüz yok.
Farklı bir CAD programında dosya doğrulaması ve gerçek kullanıcı karşılaştırması bekliyor.

- [Yol haritası](docs/ROADMAP.md)
- [Teknik kararlar](docs/DECISIONS.md)
- [Bağımlılık ve lisanslar](THIRD_PARTY.md)
