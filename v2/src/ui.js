import {Engine} from './engine.js';
import {load} from './loader.js';
import {bundles,slot} from './storage.js';

const $ = id => document.getElementById(id);
const modal = document.querySelector('dialog');
const audio = document.querySelector('audio');
let book, engine, playback = '', timer, generation = 0, frame = 0, panelVersion = 0;
let unlocked = false, soundKey, statusTimer;
function note(message) {
  $('status').textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => $('status').textContent = '',5000);
}
function guarded(action) {
  return async (...args) => {
    try { await action(...args); }
    catch (error) {
      mode('');
      if (modal.open) {
        const message = document.createElement('p');
        message.setAttribute('role','alert');
        message.textContent = error.message;
        $('panel').append(message);
      } else note(error.message);
    }
  };
}
function button(label, action, parent = $('panel')) {
  const node = document.createElement('button');
  node.textContent = label;
  node.onclick = guarded(action);
  parent.append(node);
  return node;
}
function playSound() {
  if (unlocked && audio.hasAttribute('src') && !audio.muted)
    audio.play().catch(() => { unlocked = false; });
}
function unlock() {
  if (!unlocked) { unlocked = true; playSound(); }
}
document.addEventListener('click',unlock,true);
function mode(value) {
  clearTimeout(timer);
  playback = value;
  for (const id of ['auto','skip']) $(id).setAttribute('aria-pressed',String(value === id));
}
function schedule() {
  clearTimeout(timer);
  if (!playback || modal.open || document.hidden || !engine) return;
  if (!engine.step || engine.step.type === 'choice') return mode('');
  timer = setTimeout(guarded(advance),playback === 'auto' ? 2700 : 100);
}
function advance() {
  if (!engine || modal.open || engine.step?.type === 'choice') return;
  engine.next();
  return render();
}
async function render() {
  const stamp = ++frame;
  const s = engine.state, p = engine.step, scene = engine.scenes.get(s.scene);
  $('title').textContent = book.scenario.meta.title;
  $('chapter').textContent = [scene.tag,scene.title].filter(Boolean).join('  /  ');
  $('speaker').textContent = p?.speaker || ({notice:'안내',choice:'선택'}[p?.type] || (p ? '대사' : '장면 종료'));
  $('line').textContent = p?.text || '';
  $('choices').replaceChildren();
  $('next').hidden = !p || p.type === 'choice';
  if (p?.type === 'choice') p.options.forEach((o,i) => button(o.label,() => { engine.next(i); return render(); },$('choices')));
  clearTimeout(timer);
  const [image,music] = await Promise.all([book.asset('cg',s.cg),book.asset('bgm',s.bgm)]);
  if (stamp !== frame) return;
  $('cg').hidden = !image;
  if (image) $('cg').src = image;
  else $('cg').removeAttribute('src');
  if (music !== soundKey) {
    soundKey = music;
    audio.pause();
    if (music) { audio.src = music; playSound(); }
    else { audio.removeAttribute('src'); audio.load(); }
  }
  schedule();
}
async function openBook(file,cache = false) {
  const ticket = ++generation;
  const incoming = await load(file);
  let next;
  try { next = new Engine(incoming.scenario); }
  catch (e) { incoming.release(); throw e; }
  if (ticket !== generation) { incoming.release(); return; }
  mode('');
  const old = book;
  book = incoming; engine = next;
  old?.release();
  if (modal.open) modal.close();
  if (cache && incoming.zip) {
    try { await bundles.put({id:incoming.id,file}); }
    catch (e) { note('재생 가능 · 보관함 저장 실패: '+e.message); }
  }
  if (ticket === generation) await render();
}
function panel(title) {
  mode('');
  panelVersion++;
  $('modalTitle').textContent = title;
  $('panel').replaceChildren();
  if (!modal.open) modal.showModal();
}
async function library() {
  panel('보관함');
  const version = panelVersion;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.zip,.json'; input.className = 'file';
  input.setAttribute('aria-label','ZIP 또는 JSON 열기');
  input.onchange = guarded(() => input.files[0] && openBook(input.files[0],true));
  $('panel').append(input);
  button('내장 데모 열기',() => openBook());
  for (const id of await bundles.ids()) {
    if (version !== panelVersion || !modal.open) return;
    const row = await bundles.get(id);
    if (!row || version !== panelVersion || !modal.open) continue;
    button(row.file.name,() => openBook(row.file));
    button(row.file.name+' 삭제',async () => { await bundles.remove(id); await library(); });
  }
}
function settings() {
  panel('설정');
  if (!engine) return;
  button('챕터 / 이벤트',() => {
    panel('장면 이동');
    for (const scene of engine.scenes.values()) button(scene.tag+' · '+scene.title,() => {
      engine.jump(scene.id); modal.close(); return render();
    });
  });
  button('CG 갤러리',async () => {
    panel('CG 갤러리');
    const version = panelVersion;
    if (!engine.state.gallery.length) $('panel').textContent = '아직 본 CG가 없습니다.';
    for (const id of engine.state.gallery) {
      const url = await book.asset('cg',id);
      if (panelVersion !== version || !modal.open) return;
      const img = new Image(); img.alt = id; img.src = url; $('panel').append(img);
    }
  });
  button('대사 로그',() => {
    panel('대사 로그');
    for (const [name,line] of engine.state.log) {
      const p = document.createElement('p'); p.textContent = name+' · '+line; $('panel').append(p);
    }
  });
  button('세이브 / 로드',slots);
  const debug = document.createElement('pre');
  const {flags,vars} = engine.state;
  debug.textContent = JSON.stringify({flags,vars},null,2);
  $('panel').append(debug);
}
function slots() {
  panel('세이브 / 로드');
  for (let n = 1; n <= 3; n++) {
    button('슬롯 '+n+' 저장',() => { slot(book.id,n,engine.state); slots(); });
    const saved = slot(book.id,n);
    button('슬롯 '+n+(saved ? ' 불러오기' : ' · 비어 있음'),() => {
      engine.restore(saved); modal.close(); return render();
    }).disabled = !saved;
  }
}
$('close').onclick = () => modal.close();
modal.onclose = () => panelVersion++;
$('library').onclick = guarded(library);
$('settings').onclick = guarded(settings);
$('visual').onclick = guarded(() => document.body.classList.contains('clean') ? document.body.classList.remove('clean') : advance());
$('next').onclick = guarded(advance);
$('dialogue').onclick = guarded(e => { if (!e.target.closest('button')) return advance(); });
$('hide').onclick = () => { mode(''); document.body.classList.add('clean'); $('visual').focus(); };
for (const id of ['auto','skip']) $(id).onclick = () => { mode(playback === id ? '' : id); schedule(); };
$('mute').setAttribute('aria-pressed','false');
$('mute').onclick = () => {
  audio.muted = !audio.muted;
  $('mute').setAttribute('aria-pressed',String(audio.muted));
  playSound();
};
document.addEventListener('visibilitychange',() => {
  if (document.hidden) { mode(''); audio.pause(); } else playSound();
});
$('cg').onerror = () => note('이미지를 표시할 수 없습니다.');
audio.onerror = () => { if (audio.hasAttribute('src')) note('음원 경로 또는 코덱을 확인하세요.'); };
guarded(openBook)();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => note('오프라인 캐시를 준비하지 못했습니다.'));
