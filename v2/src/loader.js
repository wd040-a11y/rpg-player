import {validate} from './engine.js';
let dependency;
function zipLibrary() {
  if (!dependency) dependency = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => { script.remove(); reject(Error('ZIP 모듈을 받을 수 없습니다. 온라인에서 다시 열어 주세요.')); };
    document.head.append(script);
  }).catch(e => { dependency = null; throw e; });
  return dependency;
}
export async function load(file) {
  let zip, raw;
  if (!file) {
    const response = await fetch('./sample/scenario.json');
    if (!response.ok) throw Error('데모 로드 실패');
    raw = await response.text();
  } else if (/\.zip$/i.test(file.name)) {
    zip = await (await zipLibrary()).loadAsync(file);
    const entry = zip.file('scenario.json');
    if (!entry) throw Error('ZIP 루트에 scenario.json이 필요합니다.');
    raw = await entry.async('string');
  } else raw = await file.text();
  const scenario = validate(JSON.parse(raw.replace(/^\uFEFF/,'')));
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const id = Array.from(new Uint8Array(digest),n => n.toString(16).padStart(2,'0')).join('');
  const urls = new Map();
  let released = false;
  return {scenario,id,zip:!!zip, async asset(kind,key) {
    if (key === null) return '';
    const path = scenario.assets[kind][key];
    if (!zip) return new URL(path.split('/').map(encodeURIComponent).join('/'),document.baseURI).href;
    if (!urls.has(path)) {
      const entry = zip.file(path);
      if (!entry) throw Error('자산 누락: '+path);
      urls.set(path,entry.async('uint8array').then(bytes => {
        if (released) return '';
        const ext = path.split('.').pop().toLowerCase();
        const mime = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml',ogg:'audio/ogg',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav'}[ext];
        return URL.createObjectURL(new Blob([bytes],{type:mime || 'application/octet-stream'}));
      }));
    }
    return urls.get(path);
  },release() {
    released = true;
    for (const promise of urls.values()) promise.then(url => { if (url) URL.revokeObjectURL(url); },() => {});
    urls.clear();
  }};
}
