const dict = () => Object.create(null);
const string = x => typeof x === 'string';
const record = x => x && typeof x === 'object' && !Array.isArray(x);
function requireValue(ok, message) {
  if (!ok) throw Error(message);
}
export function validate(s) {
  requireValue(s?.version === '1.0' && [s.meta?.title,s.meta?.sourceEngine,s.meta?.startScene].every(string), '지원하지 않는 시나리오 형식');
  requireValue(Array.isArray(s.scenes) && s.scenes.length, '장면이 없습니다');
  const ids = new Set(s.scenes.map(scene => scene.id));
  const target = id => requireValue(ids.has(id), '장면 참조 오류: ' + id);
  requireValue(ids.size === s.scenes.length, '중복 장면 ID');
  target(s.meta.startScene);
  for (const kind of ['cg','bgm']) {
    requireValue(record(s.assets?.[kind]), '자산 목록 오류');
    for (const path of Object.values(s.assets[kind])) {
      requireValue(string(path) && path.split('/').every(p => p && p !== '.' && p !== '..') && !/[:\\?#%]/.test(path), '상대경로 오류');
    }
  }
  function assignment(type, item) {
    requireValue(string(item?.key) && item.key && (type === 'setFlag' ? typeof item.value === 'boolean' : Number.isFinite(item.value)), '대입 형식 오류');
  }
  for (const scene of s.scenes) {
    requireValue([scene.id,scene.title,scene.tag].every(string) && scene.id && Array.isArray(scene.steps), '장면 형식 오류');
    for (const step of scene.steps) {
      switch (step.type) {
        case 'cg': case 'bgm':
          requireValue(step.id === null || string(step.id) && Object.hasOwn(s.assets[step.type],step.id), '자산 참조 오류'); break;
        case 'text': case 'notice':
          requireValue(string(step.text) && (step.type === 'notice' || string(step.speaker)), '대사 형식 오류'); break;
        case 'setFlag': case 'setVar': assignment(step.type,step); break;
        case 'branch':
          requireValue(string(step.key) && (typeof step.equals === 'boolean' || Number.isFinite(step.equals)), '조건 형식 오류');
          target(step.then); target(step.else); break;
        case 'jump': target(step.goto); break;
        case 'choice':
          requireValue(Array.isArray(step.options) && step.options.length, '빈 선택지');
          for (const o of step.options) {
            requireValue(string(o.label),'선택지 이름 오류');
            for (const t of ['setFlag','setVar']) if (t in o) assignment(t,o[t]);
            if ('goto' in o) target(o.goto);
          }
          break;
        default: throw Error('미지원 스텝: ' + step.type);
      }
    }
  }
  return s;
}

export class Engine {
  constructor(scenario) {
    this.scenario = validate(scenario);
    this.scenes = new Map(scenario.scenes.map(s => [s.id,s]));
    this.state = {scene:scenario.meta.startScene, index:0, flags:dict(), vars:dict(), cg:null, bgm:null, gallery:[], log:[]};
    this.run();
  }
  get step() { return this.scenes.get(this.state.scene).steps[this.state.index]; }
  move(id) { this.state.scene = id; this.state.index = 0; }
  jump(id) { this.move(id); this.run(); }
  assign(type, item) { this.state[type === 'setFlag' ? 'flags' : 'vars'][item.key] = item.value; }
  run() {
    const s = this.state;
    for (let n = 0; n < 10000; n++) {
      const p = this.step;
      if (!p || p.type === 'choice') return;
      if (['notice','text'].includes(p.type)) {
        s.log.push([p.speaker || '안내',p.text]);
        if (s.log.length > 300) s.log.shift();
        return;
      }
      s.index++;
      switch (p.type) {
        case 'cg': case 'bgm':
          s[p.type] = p.id;
          if (p.type === 'cg' && p.id !== null && !s.gallery.includes(p.id)) s.gallery.push(p.id);
          break;
        case 'setFlag': case 'setVar': this.assign(p.type,p); break;
        case 'jump': this.move(p.goto); break;
        case 'branch': {
          const flag = typeof p.equals === 'boolean';
          const value = s[flag ? 'flags' : 'vars'][p.key] ?? (flag ? false : 0);
          this.move(value === p.equals ? p.then : p.else); break;
        }
      }
    }
    throw Error('자동 진행 한도 초과: 순환 분기를 확인하세요.');
  }
  next(option) {
    const p = this.step;
    if (!p) return;
    if (p.type === 'choice' && !p.options[option]) return;
    this.state.index++;
    if (p.type === 'choice') {
      const o = p.options[option];
      for (const type of ['setFlag','setVar']) if (o[type]) this.assign(type,o[type]);
      if ('goto' in o) this.move(o.goto);
    }
    this.run();
  }
  restore(s) {
    const scene = this.scenes.get(s?.scene);
    requireValue(scene && Number.isInteger(s.index) && s.index >= 0 && s.index <= scene.steps.length &&
      (!scene.steps[s.index] || ['text','notice','choice'].includes(scene.steps[s.index].type)) &&
      record(s.flags) && record(s.vars) && Object.values(s.flags).every(v => typeof v === 'boolean') &&
      Object.values(s.vars).every(Number.isFinite) && Array.isArray(s.gallery) && Array.isArray(s.log) &&
      s.log.every(row => Array.isArray(row) && row.length === 2 && row.every(string)), '저장 데이터 오류');
    this.state = {...s,flags:Object.assign(dict(),s.flags),vars:Object.assign(dict(),s.vars)};
  }
}
