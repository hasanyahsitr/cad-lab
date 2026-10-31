import './style.css';
import { createViewport } from './viewport.js';
import { ProjectHistory } from './history.js';

const $ = (id) => document.getElementById(id);
const history = new ProjectHistory();
const parameterNames = ['width', 'depth', 'thickness', 'hole_diameter', 'margin'];
let viewport;
let busy = false;
let dirty = false;
let ready = false;

function message(text, error = false) {
  const translations = {
    'Width is too small: holes would overlap or touch.':
      'Genişlik yetersiz: delikler birbirine değiyor veya üst üste geliyor.',
    'Depth is too small: holes would overlap or touch.':
      'Derinlik yetersiz: delikler birbirine değiyor veya üst üste geliyor.',
    'Hole centers must be farther from the edge than the hole radius.':
      'Merkez–kenar mesafesi, delik yarıçapından büyük olmalı.',
    'Project fields are missing or unsupported.':
      'Proje alanları eksik veya bu sürüm tarafından desteklenmiyor.',
    'This is not a CAD Lab project.': 'Bu dosya bir CAD Lab projesi değil.',
    'Unsupported project version.': 'Bu proje sürümü henüz desteklenmiyor.',
    'This version supports millimeters only.': 'Bu sürüm yalnız milimetre birimini destekliyor.',
    'Invalid model definition.': 'Projedeki model tanımı geçersiz.',
    'Unsupported model type.': 'Bu model türü henüz desteklenmiyor.',
    'Plate parameters are missing or unsupported.': 'Plaka ölçüleri eksik veya desteklenmiyor.',
    'Project name must contain 1–80 printable characters.':
      'Proje adı 1–80 yazdırılabilir karakter içermeli.',
    'Project exceeds the 64 KiB limit.': 'Proje dosyası 64 KiB sınırını aşıyor.',
  };
  text = translations[text] || text;
  for (const [key, label] of Object.entries({
    width: 'Genişlik',
    depth: 'Derinlik',
    thickness: 'Kalınlık',
    hole_diameter: 'Delik çapı',
    margin: 'Merkez–kenar mesafesi',
  })) {
    if (text.startsWith(`${key}:`)) text = `${label}: 0,1–2000 mm arasında geçerli bir sayı girin.`;
  }
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}
function updateButtons() {
  $('parameter-fields').disabled = busy;
  $('apply').disabled = busy || !viewport;
  $('open').disabled = busy || !viewport;
  $('revert').hidden = !dirty || busy;
  for (const name of ['save', 'step', 'stl']) $(name).disabled = busy || dirty || !ready;
  $('undo').disabled = busy || dirty || !history.canUndo;
  $('redo').disabled = busy || dirty || !history.canRedo;
  $('model-status').textContent = busy
    ? 'MODEL HESAPLANIYOR'
    : dirty
      ? 'UYGULANMAMIŞ ÖLÇÜLER'
      : ready
        ? 'GEÇERLİ KATI MODEL'
        : 'MODEL BEKLENİYOR';
}
function fillForm(project) {
  for (const name of parameterNames) $(name).value = project.model.parameters[name];
}
async function post(path, project) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `İşlem tamamlanamadı (${response.status}).`);
  }
  return response;
}
async function rebuild(project, historyOffset = null) {
  if (busy || !viewport) return;
  busy = true;
  updateButtons();
  message('Katı model yerel geometri çekirdeğinde hesaplanıyor…');
  try {
    const data = await (await post('/api/model', project)).json();
    viewport.setModel(data.mesh, data.project.model.parameters);
    if (historyOffset === null) history.push(data.project);
    else history.move(historyOffset);
    fillForm(data.project);
    const p = data.project.model.parameters;
    $('project-name').textContent = data.project.name;
    $('solid-status').textContent = '1 geçerli katı';
    $('volume').textContent =
      `${data.mesh.volume.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} mm³`;
    $('bounds').textContent = `${p.width} × ${p.depth} × ${p.thickness} mm`;
    $('viewport').setAttribute(
      'aria-label',
      `${data.project.name}: ${p.width} × ${p.depth} × ${p.thickness} milimetre; dört adet ${p.hole_diameter} milimetre geçiş deliği. Ok tuşlarıyla döndürün; artı/eksi ile yakınlaşın; F ile sığdırın.`,
    );
    $('loading').hidden = true;
    dirty = false;
    ready = true;
    message('Model doğrulandı. Projeni kaydedebilir veya dışa aktarabilirsin.');
  } catch (error) {
    message(error.message, true);
    if (!ready)
      $('loading').textContent = 'Model oluşturulamadı. Ölçüleri kontrol ederek yeniden deneyin.';
  } finally {
    busy = false;
    updateButtons();
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('dimensions').addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy) return;
  const project = history.current;
  if (!project) return;
  for (const name of parameterNames) project.model.parameters[name] = $(name).valueAsNumber;
  rebuild(project);
});
$('dimensions').addEventListener('input', () => {
  dirty = true;
  message('Ölçüler değişti. Modeli güncellemek için “Modeli oluştur” düğmesine bas.');
  updateButtons();
});
$('revert').addEventListener('click', () => {
  if (!history.current) return;
  fillForm(history.current);
  dirty = false;
  message('Son geçerli ölçüler geri yüklendi.');
  updateButtons();
});
for (const [name, offset] of [
  ['undo', -1],
  ['redo', 1],
]) {
  $(name).addEventListener('click', () => {
    const project = history.peek(offset);
    if (project) rebuild(project, offset);
  });
}
for (const name of ['iso', 'top', 'fit']) {
  $(name).addEventListener('click', () => viewport?.fit(name === 'top' ? 'top' : 'iso'));
}
$('save').addEventListener('click', () => {
  if (!ready || dirty || busy) return;
  download(
    new Blob([JSON.stringify(history.current, null, 2) + '\n'], { type: 'application/json' }),
    'plate.cadlab.json',
  );
  message('Düzenlenebilir proje kaydedildi.');
});
$('open').addEventListener('click', () => $('project-file').click());
$('project-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file || busy) return;
  try {
    if (file.size > 65536) throw new Error('Proje dosyası 64 KiB sınırını aşıyor.');
    await rebuild(JSON.parse(await file.text()));
  } catch (error) {
    message(`Proje açılamadı: ${error.message}`, true);
  } finally {
    event.target.value = '';
  }
});
for (const format of ['step', 'stl']) {
  $(format).addEventListener('click', async () => {
    if (!ready || dirty || busy) return;
    busy = true;
    updateButtons();
    message(`${format.toUpperCase()} dosyası hazırlanıyor…`);
    try {
      const response = await post(`/api/export/${format}`, history.current);
      download(await response.blob(), `plate.${format}`);
      message(
        `${format.toUpperCase()} dışa aktarıldı. Düzenleme geçmişi için projeyi ayrıca kaydet.`,
      );
    } catch (error) {
      message(error.message, true);
    } finally {
      busy = false;
      updateButtons();
    }
  });
}

async function boot() {
  try {
    viewport = createViewport($('viewport'));
    const response = await fetch('/api/project');
    if (!response.ok) throw new Error('Yerel CAD sunucusuna bağlanılamadı.');
    const project = await response.json();
    fillForm(project);
    // A failed first geometry request can be retried with the loaded, validated default data.
    history.push(project);
    await rebuild(project);
  } catch (error) {
    message(error.message, true);
    $('loading').textContent = viewport
      ? 'Yerel sunucuya bağlanılamadı. Sayfayı yenileyerek tekrar deneyin.'
      : 'Bu tarayıcıda 3B görünüm başlatılamadı. WebGL destekli bir tarayıcı deneyin.';
    updateButtons();
  }
}
boot();
