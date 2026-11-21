#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const pad3 = n => String(n).padStart(3, '0');

function validateSpecV1(s) {
  const string = x => typeof x === 'string';
  const record = x => x && typeof x === 'object' && !Array.isArray(x);
  const req = (ok, msg) => { if (!ok) throw new Error(msg); };
  req(s?.version === '1.0' && [s.meta?.title, s.meta?.sourceEngine, s.meta?.startScene].every(string), '지원하지 않는 시나리오 형식');
  req(Array.isArray(s.scenes) && s.scenes.length > 0, '장면이 없습니다');
  const ids = new Set(s.scenes.map(sc => sc.id));
  req(ids.size === s.scenes.length, '중복 장면 ID');
  req(ids.has(s.meta.startScene), '시작 장면 참조 오류: ' + s.meta.startScene);
  for (const kind of ['cg', 'bgm']) {
    req(record(s.assets?.[kind]), '자산 목록 오류');
    for (const p of Object.values(s.assets[kind])) {
      req(string(p) && p.split('/').every(seg => seg && seg !== '.' && seg !== '..') && !/[:\\?#%]/.test(p), '상대경로 오류: ' + p);
    }
  }
  return s;
}

function sanitizeAssetId(prefix, rawName) {
  const cleaned = String(rawName || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${cleaned || 'unnamed'}`;
}

function cleanRpgText(raw) {
  return String(raw || '')
    .replace(/\\n<([^>]+)>/gi, '')
    .replace(/\\C\[\d+\]/gi, '')
    .replace(/\\I\[\d+\]/gi, '')
    .replace(/\\[.|!^><{}]/g, '')
    .replace(/\\V\[(\d+)\]/gi, '{var_$1}')
    .replace(/\\N\[(\d+)\]/gi, '{actor_$1}')
    .trimEnd();
}

function extractSpeakerFromMvLines(lines) {
  for (const line of lines) {
    const m = String(line || '').match(/\\n<([^>]+)>/i);
    if (m) return m[1].trim();
  }
  return '';
}

function resolveAssetFile(projectRoot, relDir, baseName, preferredExts) {
  const safeBase = String(baseName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const fullDir = path.join(projectRoot, relDir);
  for (const ext of preferredExts) {
    const candidate = `${safeBase}${ext}`;
    if (fs.existsSync(path.join(fullDir, candidate))) {
      return { relPath: `${relDir}/${candidate}`.replace(/\\/g, '/'), found: true };
    }
  }
  return { relPath: `${relDir}/${safeBase}${preferredExts[0]}`.replace(/\\/g, '/'), found: false };
}

function parseJsonFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

/**
 * Pure-JS minimal ZIP writer (DEFLATE via node:zlib, zero npm dependencies).
 */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const rawBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const compBuf = zlib.deflateRawSync(rawBuf);
    const useDeflate = compBuf.length < rawBuf.length;
    const body = useDeflate ? compBuf : rawBuf;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(rawBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(rawBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(rawBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

export function extractProject(inputDir, opts = {}) {
  const absInput = path.resolve(inputDir);
  let projectRoot = absInput;
  let dataDir = path.join(absInput, 'data');
  if (!fs.existsSync(dataDir) && fs.existsSync(path.join(absInput, 'www', 'data'))) {
    projectRoot = path.join(absInput, 'www');
    dataDir = path.join(projectRoot, 'data');
  }
  if (!fs.existsSync(dataDir)) {
    throw new Error(`data 폴더를 찾을 수 없습니다: ${absInput}`);
  }

  const systemPath = path.join(dataDir, 'System.json');
  const mapInfosPath = path.join(dataDir, 'MapInfos.json');
  const commonEventsPath = path.join(dataDir, 'CommonEvents.json');

  const system = fs.existsSync(systemPath) ? parseJsonFile(systemPath) : {};
  const mapInfos = fs.existsSync(mapInfosPath) ? parseJsonFile(mapInfosPath) : [];
  const commonEventsRaw = fs.existsSync(commonEventsPath) ? parseJsonFile(commonEventsPath) : [];

  const isMz = Boolean(system.advanced || system.titleCommandWindow);
  const sourceEngine = opts.sourceEngine || (isMz ? 'MZ' : 'MV');
  const title = opts.title || system.gameTitle || path.basename(absInput);

  const mapNameById = new Map();
  if (Array.isArray(mapInfos)) {
    for (const info of mapInfos) {
      if (info && info.id) mapNameById.set(info.id, info.name || `Map ${pad3(info.id)}`);
    }
  }

  const commonEventsById = new Map();
  if (Array.isArray(commonEventsRaw)) {
    for (const ce of commonEventsRaw) {
      if (ce && ce.id) commonEventsById.set(ce.id, ce);
    }
  }

  const assets = { cg: {}, bgm: {} };
  const missingAssets = new Set();
  const unsupported = [];
  const scenes = [];
  const usedSceneIds = new Set();

  function allocateSceneId(candidate) {
    let id = candidate;
    let n = 2;
    while (usedSceneIds.has(id)) {
      id = `${candidate}_${n++}`;
    }
    usedSceneIds.add(id);
    return id;
  }

  function registerCg(picName) {
    const id = sanitizeAssetId('cg', picName);
    if (!assets.cg[id]) {
      const resolved = resolveAssetFile(projectRoot, 'img/pictures', picName, ['.webp', '.png', '.jpg', '.jpeg']);
      assets.cg[id] = resolved.relPath;
      if (!resolved.found) missingAssets.add(resolved.relPath);
    }
    return id;
  }

  function registerBgm(bgmName) {
    const id = sanitizeAssetId('bgm', bgmName);
    if (!assets.bgm[id]) {
      const resolved = resolveAssetFile(projectRoot, 'audio/bgm', bgmName, ['.m4a', '.mp3', '.ogg', '.wav']);
      assets.bgm[id] = resolved.relPath;
      if (!resolved.found) missingAssets.add(resolved.relPath);
    }
    return id;
  }

  function recordUnsupported(ctx, cmdIndex, cmd, reason) {
    unsupported.push({
      source: ctx.source,
      mapId: ctx.mapId,
      eventId: ctx.eventId,
      page: ctx.page,
      commandIndex: cmdIndex,
      code: cmd.code,
      reason,
      parameters: cmd.parameters || []
    });
  }

  function hasMeaningfulCommands(list, start, end) {
    for (let k = start; k < end; k++) {
      const c = list[k];
      if (c && c.code !== 0 && c.code !== 108 && c.code !== 408) return true;
    }
    return false;
  }

  function parseCondition(p, ctx) {
    const condType = p[0];
    if (condType === 0) return { key: `sw_${p[1]}`, equals: p[2] === 0 };
    if (condType === 1) {
      if (p[2] === 0 && p[4] === 0 && Number.isFinite(Number(p[3]))) {
        return { key: `var_${p[1]}`, equals: Number(p[3]) };
      }
      return null;
    }
    if (condType === 2) {
      const key = ctx.mapId != null
        ? `self_${ctx.mapId}_${ctx.eventId}_${p[1]}`
        : `self_ce_${ctx.eventId}_${p[1]}`;
      return { key, equals: p[2] === 0 };
    }
    return null;
  }

  function compileCommandList({
    list,
    startIdx = 0,
    endIdx = list.length,
    baseId,
    sceneTitle,
    sceneTag,
    ctx,
    continuationSceneId = null,
    callStack = []
  }) {
    const sceneId = allocateSceneId(baseId);
    const steps = [];
    scenes.push({ id: sceneId, title: sceneTitle, tag: sceneTag, steps });

    let i = startIdx;
    let terminatedByJumpOrBranch = false;

    while (i < endIdx) {
      const cmd = list[i];
      if (!cmd || cmd.code === 0) {
        i++;
        continue;
      }

      const code = cmd.code;
      const p = cmd.parameters || [];

      if (code === 101) {
        const mzSpeaker = typeof p[4] === 'string' ? p[4].trim() : '';
        const rawLines = [];
        let j = i + 1;
        while (j < endIdx && list[j] && list[j].code === 401) {
          rawLines.push(list[j].parameters?.[0] ?? '');
          j++;
        }
        const speaker = mzSpeaker || extractSpeakerFromMvLines(rawLines) || (p[0] ? String(p[0]) : '');
        const text = rawLines.map(cleanRpgText).join('\n').trim();
        if (text) steps.push({ type: 'text', speaker, text });
        i = j;
        continue;
      }

      if (code === 401) {
        const text = cleanRpgText(p[0] ?? '').trim();
        if (text) steps.push({ type: 'text', speaker: '', text });
        i++;
        continue;
      }

      if (code === 102) {
        const choiceLabels = Array.isArray(p[0]) ? p[0] : [];
        const indent = cmd.indent ?? 0;
        const branches = [];
        let j = i + 1;
        let currentBranch = null;
        let endChoiceIdx = endIdx;

        while (j < endIdx) {
          const c = list[j];
          if (c && (c.indent ?? 0) === indent) {
            if (c.code === 402) {
              if (currentBranch) currentBranch.end = j;
              currentBranch = { index: c.parameters?.[0], label: c.parameters?.[1], start: j + 1, end: endIdx };
              branches.push(currentBranch);
              j++;
              continue;
            }
            if (c.code === 403) {
              if (currentBranch) currentBranch.end = j;
              currentBranch = { index: -1, label: '취소', start: j + 1, end: endIdx, isCancel: true };
              branches.push(currentBranch);
              j++;
              continue;
            }
            if (c.code === 404) {
              if (currentBranch) currentBranch.end = j;
              endChoiceIdx = j;
              break;
            }
          }
          j++;
        }

        const hasAfter = hasMeaningfulCommands(list, endChoiceIdx + 1, endIdx);
        let joinSceneId = continuationSceneId;
        if (hasAfter) {
          joinSceneId = compileCommandList({
            list,
            startIdx: endChoiceIdx + 1,
            endIdx,
            baseId: `${baseId}_c${i}_join`,
            sceneTitle: `${sceneTitle} (합류)`,
            sceneTag,
            ctx,
            continuationSceneId,
            callStack
          });
        }

        const options = [];
        for (let idx = 0; idx < choiceLabels.length; idx++) {
          const label = cleanRpgText(choiceLabels[idx]) || `선택 ${idx + 1}`;
          const br = branches.find(b => !b.isCancel && b.index === idx);
          if (br && hasMeaningfulCommands(list, br.start, br.end)) {
            const branchSceneId = compileCommandList({
              list,
              startIdx: br.start,
              endIdx: br.end,
              baseId: `${baseId}_c${i}_opt${idx}`,
              sceneTitle: `${sceneTitle} · ${label}`,
              sceneTag,
              ctx,
              continuationSceneId: joinSceneId,
              callStack
            });
            options.push({ label, goto: branchSceneId });
          } else if (joinSceneId) {
            options.push({ label, goto: joinSceneId });
          } else {
            options.push({ label });
          }
        }

        if (options.length) {
          steps.push({ type: 'choice', options });
          terminatedByJumpOrBranch = true;
          break;
        }
        i = endChoiceIdx + 1;
        continue;
      }

      if (code === 111) {
        const indent = cmd.indent ?? 0;
        let elseIdx = -1;
        let endIfIdx = endIdx;
        let j = i + 1;
        while (j < endIdx) {
          const c = list[j];
          if (c && (c.indent ?? 0) === indent) {
            if (c.code === 411 && elseIdx === -1) elseIdx = j;
            else if (c.code === 412) {
              endIfIdx = j;
              break;
            }
          }
          j++;
        }

        const cond = parseCondition(p, ctx);
        const thenStart = i + 1;
        const thenEnd = elseIdx !== -1 ? elseIdx : endIfIdx;
        const elseStart = elseIdx !== -1 ? elseIdx + 1 : endIfIdx;
        const elseEnd = endIfIdx;

        if (!cond) {
          recordUnsupported(ctx, i, cmd, 'v1.0 branch로 표현 불가한 조건 분기 (Switch/SelfSwitch/상수 == 변수만 지원)');
          i = endIfIdx + 1;
          continue;
        }

        const hasAfter = hasMeaningfulCommands(list, endIfIdx + 1, endIdx);
        let joinSceneId = continuationSceneId;
        if (hasAfter) {
          joinSceneId = compileCommandList({
            list,
            startIdx: endIfIdx + 1,
            endIdx,
            baseId: `${baseId}_if${i}_join`,
            sceneTitle: `${sceneTitle} (분기 합류)`,
            sceneTag,
            ctx,
            continuationSceneId,
            callStack
          });
        }

        const thenHas = hasMeaningfulCommands(list, thenStart, thenEnd);
        const elseHas = hasMeaningfulCommands(list, elseStart, elseEnd);

        let fallbackSceneId = joinSceneId;
        if (!fallbackSceneId && (!thenHas || !elseHas)) {
          fallbackSceneId = allocateSceneId(`${baseId}_if${i}_end`);
          scenes.push({ id: fallbackSceneId, title: `${sceneTitle} (종료)`, tag: sceneTag, steps: [] });
        }

        const thenSceneId = thenHas
          ? compileCommandList({
              list,
              startIdx: thenStart,
              endIdx: thenEnd,
              baseId: `${baseId}_if${i}_then`,
              sceneTitle: `${sceneTitle} (조건 참)`,
              sceneTag,
              ctx,
              continuationSceneId: joinSceneId,
              callStack
            })
          : fallbackSceneId;

        const elseSceneId = elseHas
          ? compileCommandList({
              list,
              startIdx: elseStart,
              endIdx: elseEnd,
              baseId: `${baseId}_if${i}_else`,
              sceneTitle: `${sceneTitle} (조건 거짓)`,
              sceneTag,
              ctx,
              continuationSceneId: joinSceneId,
              callStack
            })
          : fallbackSceneId;

        steps.push({
          type: 'branch',
          key: cond.key,
          equals: cond.equals,
          then: thenSceneId,
          else: elseSceneId
        });
        terminatedByJumpOrBranch = true;
        break;
      }

      if (code === 117) {
        const ceId = p[0];
        const ce = commonEventsById.get(ceId);
        if (!ce || !Array.isArray(ce.list)) {
          recordUnsupported(ctx, i, cmd, `참조된 공통 이벤트(${ceId})를 찾을 수 없음`);
          i++;
          continue;
        }
        if (callStack.includes(ceId)) {
          recordUnsupported(ctx, i, cmd, `공통 이벤트(${ceId}) 순환 호출 감지`);
          i++;
          continue;
        }

        const hasAfter = hasMeaningfulCommands(list, i + 1, endIdx);
        let returnSceneId = continuationSceneId;
        if (hasAfter) {
          returnSceneId = compileCommandList({
            list,
            startIdx: i + 1,
            endIdx,
            baseId: `${baseId}_ce${i}_ret`,
            sceneTitle: `${sceneTitle} (복귀)`,
            sceneTag,
            ctx,
            continuationSceneId,
            callStack
          });
        }

        const ceEntryId = compileCommandList({
          list: ce.list,
          startIdx: 0,
          endIdx: ce.list.length,
          baseId: `${baseId}_ce${i}_call_${pad3(ceId)}`,
          sceneTitle: ce.name || `공통 이벤트 ${pad3(ceId)}`,
          sceneTag: '공통 이벤트',
          ctx: { source: 'CommonEvents.json', mapId: null, eventId: ceId, page: 1 },
          continuationSceneId: returnSceneId,
          callStack: [...callStack, ceId]
        });

        steps.push({ type: 'jump', goto: ceEntryId });
        terminatedByJumpOrBranch = true;
        break;
      }

      if (code === 121) {
        const startSw = Number(p[0]);
        const endSw = Number(p[1]);
        const val = p[2] === 0;
        for (let sw = startSw; sw <= endSw; sw++) {
          steps.push({ type: 'setFlag', key: `sw_${sw}`, value: val });
        }
        i++;
        continue;
      }

      if (code === 122) {
        const [startVar, endVar, op, operandType, operandVal] = p;
        if (op === 0 && operandType === 0 && Number.isFinite(Number(operandVal))) {
          for (let v = Number(startVar); v <= Number(endVar); v++) {
            steps.push({ type: 'setVar', key: `var_${v}`, value: Number(operandVal) });
          }
        } else {
          recordUnsupported(ctx, i, cmd, 'v1.0 setVar는 상수 절대 대입만 지원 (연산식/랜덤/게임데이터 미지원)');
        }
        i++;
        continue;
      }

      if (code === 123) {
        const key = ctx.mapId != null
          ? `self_${ctx.mapId}_${ctx.eventId}_${p[0]}`
          : `self_ce_${ctx.eventId}_${p[0]}`;
        steps.push({ type: 'setFlag', key, value: p[1] === 0 });
        i++;
        continue;
      }

      if (code === 231) {
        const picName = p[1];
        if (picName) steps.push({ type: 'cg', id: registerCg(picName) });
        i++;
        continue;
      }

      if (code === 235) {
        steps.push({ type: 'cg', id: null });
        i++;
        continue;
      }

      if (code === 241) {
        const bgmName = p[0]?.name;
        steps.push({ type: 'bgm', id: bgmName ? registerBgm(bgmName) : null });
        i++;
        continue;
      }

      if (code === 242) {
        steps.push({ type: 'bgm', id: null });
        i++;
        continue;
      }

      if (code === 201) {
        const targetMap = p[0] === 0 ? (mapNameById.get(p[1]) || `Map ${pad3(p[1])}`) : '변수 지정 맵';
        steps.push({ type: 'notice', text: `장소 이동 생략 (${targetMap})` });
        i++;
        continue;
      }

      if (code === 205) {
        steps.push({ type: 'notice', text: '캐릭터 이동 연출을 건너뛰었습니다.' });
        i++;
        while (i < endIdx && list[i] && list[i].code === 505) i++;
        continue;
      }

      if (code === 301) {
        steps.push({ type: 'notice', text: '전투를 건너뛰고 승리 처리했습니다.' });
        const indent = cmd.indent ?? 0;
        let j = i + 1;
        if (j < endIdx && list[j] && list[j].code === 601 && (list[j].indent ?? 0) === indent) {
          let endBattleIdx = endIdx;
          let winEnd = endIdx;
          let k = j + 1;
          while (k < endIdx) {
            const c = list[k];
            if (c && (c.indent ?? 0) === indent) {
              if ((c.code === 602 || c.code === 603) && winEnd === endIdx) winEnd = k;
              if (c.code === 604) {
                if (winEnd === endIdx) winEnd = k;
                endBattleIdx = k;
                break;
              }
            }
            k++;
          }
          const hasAfterBattle = hasMeaningfulCommands(list, endBattleIdx + 1, endIdx);
          const afterBattleId = hasAfterBattle
            ? compileCommandList({
                list,
                startIdx: endBattleIdx + 1,
                endIdx,
                baseId: `${baseId}_b${i}_after`,
                sceneTitle: `${sceneTitle} (전투 후)`,
                sceneTag,
                ctx,
                continuationSceneId,
                callStack
              })
            : continuationSceneId;

          if (hasMeaningfulCommands(list, j + 1, winEnd)) {
            const winId = compileCommandList({
              list,
              startIdx: j + 1,
              endIdx: winEnd,
              baseId: `${baseId}_b${i}_win`,
              sceneTitle: `${sceneTitle} (승리)`,
              sceneTag,
              ctx,
              continuationSceneId: afterBattleId,
              callStack
            });
            steps.push({ type: 'jump', goto: winId });
            terminatedByJumpOrBranch = true;
            break;
          }
          i = endBattleIdx + 1;
          continue;
        }
        i++;
        continue;
      }

      if ([108, 408, 221, 222, 223, 224, 225, 230, 232, 250, 251, 505].includes(code)) {
        i++;
        continue;
      }

      if (code === 355) {
        const scriptLines = [p[0] ?? ''];
        let j = i + 1;
        while (j < endIdx && list[j] && list[j].code === 655) {
          scriptLines.push(list[j].parameters?.[0] ?? '');
          j++;
        }
        recordUnsupported(ctx, i, { code: 355, parameters: scriptLines }, '스크립트 명령(355/655)은 v1.0에서 실행 불가');
        i = j;
        continue;
      }

      recordUnsupported(ctx, i, cmd, `v1.0 미지원 RPG Maker 명령 코드(${code})`);
      i++;
    }

    if (!terminatedByJumpOrBranch && continuationSceneId) {
      steps.push({ type: 'jump', goto: continuationSceneId });
    }

    return sceneId;
  }

  const mapFiles = fs.readdirSync(dataDir)
    .filter(f => /^Map\d+\.json$/i.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  let mapsProcessed = 0;
  let eventsProcessed = 0;

  for (const file of mapFiles) {
    const mapId = Number(file.match(/\d+/)[0]);
    const mapData = parseJsonFile(path.join(dataDir, file));
    const mapTitle = mapData.displayName || mapNameById.get(mapId) || `Map ${pad3(mapId)}`;
    mapsProcessed++;

    if (!Array.isArray(mapData.events)) continue;
    for (const ev of mapData.events) {
      if (!ev || !Array.isArray(ev.pages)) continue;
      eventsProcessed++;
      ev.pages.forEach((page, pageIdx) => {
        if (!page || !Array.isArray(page.list) || !hasMeaningfulCommands(page.list, 0, page.list.length)) return;
        const pageNum = pageIdx + 1;
        compileCommandList({
          list: page.list,
          baseId: `map${pad3(mapId)}_ev${pad3(ev.id)}_p${pageNum}`,
          sceneTitle: `${ev.name || `EV${pad3(ev.id)}`}${ev.pages.length > 1 ? ` (P${pageNum})` : ''}`,
          sceneTag: mapTitle,
          ctx: { source: file, mapId, eventId: ev.id, page: pageNum }
        });
      });
    }
  }

  for (const [ceId, ce] of commonEventsById.entries()) {
    if (!Array.isArray(ce.list) || !hasMeaningfulCommands(ce.list, 0, ce.list.length)) continue;
    compileCommandList({
      list: ce.list,
      baseId: `common_${pad3(ceId)}`,
      sceneTitle: ce.name || `공통 이벤트 ${pad3(ceId)}`,
      sceneTag: '공통 이벤트',
      ctx: { source: 'CommonEvents.json', mapId: null, eventId: ceId, page: 1 },
      callStack: [ceId]
    });
  }

  if (scenes.length === 0) {
    throw new Error('추출할 이벤트 장면이 없습니다.');
  }

  const startScene = opts.startScene && scenes.some(s => s.id === opts.startScene)
    ? opts.startScene
    : scenes[0].id;

  const scenario = validateSpecV1({
    version: '1.0',
    meta: { title, sourceEngine, startScene },
    assets,
    scenes
  });

  const report = {
    sourceEngine,
    title,
    summary: {
      mapsProcessed,
      eventsProcessed,
      scenesGenerated: scenes.length,
      cgAssets: Object.keys(assets.cg).length,
      bgmAssets: Object.keys(assets.bgm).length,
      missingAssetsCount: missingAssets.size,
      unsupportedCommandsCount: unsupported.length
    },
    missingAssets: Array.from(missingAssets),
    unsupported
  };

  return { scenario, report, projectRoot };
}

export function buildZipBundle(scenario, projectRoot, outZipPath) {
  const entries = [
    { name: 'scenario.json', data: Buffer.from(JSON.stringify(scenario, null, 2), 'utf8') }
  ];
  const addedPaths = new Set(['scenario.json']);

  for (const kind of ['cg', 'bgm']) {
    for (const relPath of Object.values(scenario.assets[kind])) {
      if (addedPaths.has(relPath)) continue;
      const fullPath = path.join(projectRoot, relPath);
      if (fs.existsSync(fullPath)) {
        entries.push({ name: relPath, data: fs.readFileSync(fullPath) });
        addedPaths.add(relPath);
      }
    }
  }

  const zipBuf = createZipBuffer(entries);
  fs.mkdirSync(path.dirname(path.resolve(outZipPath)), { recursive: true });
  fs.writeFileSync(outZipPath, zipBuf);
  return { fileCount: entries.length, bytes: zipBuf.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const inputDir = args[0];
  if (!inputDir || inputDir === '--help' || inputDir === '-h') {
    console.log('Usage: node extract.mjs <rpgmaker-project-dir> [--out <out-dir>] [--zip <bundle.zip>] [--start <sceneId>]');
    process.exit(inputDir ? 0 : 1);
  }

  const getFlag = name => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const outDir = getFlag('--out') || path.resolve('./extracted');
  const zipPath = getFlag('--zip');
  const startScene = getFlag('--start');

  const { scenario, report, projectRoot } = extractProject(inputDir, { startScene });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'scenario.json'), JSON.stringify(scenario, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`[OK] scenario.json & report.json -> ${outDir}`);
  console.log(`     scenes=${report.summary.scenesGenerated}, cg=${report.summary.cgAssets}, bgm=${report.summary.bgmAssets}, unsupported=${report.summary.unsupportedCommandsCount}`);

  if (zipPath) {
    const z = buildZipBundle(scenario, projectRoot, zipPath);
    console.log(`[OK] ZIP bundle -> ${zipPath} (${z.fileCount} files, ${z.bytes} bytes)`);
  }
}
