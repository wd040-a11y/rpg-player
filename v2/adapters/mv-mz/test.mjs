#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractProject, buildZipBundle } from './extract.mjs';

// Load v2/src/engine.js as ESM directly without requiring a package.json in v2/
const here = path.dirname(fileURLToPath(import.meta.url));
const engineSource = fs.readFileSync(path.resolve(here, '../../src/engine.js'), 'utf8');
const { Engine, validate } = await import(
  'data:text/javascript;base64,' + Buffer.from(engineSource, 'utf8').toString('base64')
);

function createFixtureProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvmz-fixture-'));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'img', 'pictures'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'audio', 'bgm'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'img', 'pictures', 'castle.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(dir, 'audio', 'bgm', 'theme.ogg'), Buffer.from('OGG_DUMMY'));
  fs.writeFileSync(path.join(dir, 'audio', 'bgm', 'theme.m4a'), Buffer.from('M4A_DUMMY'));

  fs.writeFileSync(path.join(dir, 'data', 'System.json'), JSON.stringify({
    gameTitle: 'MV/MZ Fixture Quest',
    advanced: { screenWidth: 816 }
  }));

  fs.writeFileSync(path.join(dir, 'data', 'MapInfos.json'), JSON.stringify([
    null,
    { id: 1, name: '황혼의 성문' },
    { id: 2, name: '비밀 서고' }
  ]));

  fs.writeFileSync(path.join(dir, 'data', 'CommonEvents.json'), JSON.stringify([
    null,
    {
      id: 1,
      name: '공통 축복 이벤트',
      list: [
        { code: 121, indent: 0, parameters: [10, 10, 0] },
        { code: 101, indent: 0, parameters: ['', 0, 0, 2, '안내자'] },
        { code: 401, indent: 0, parameters: ['공통 이벤트가 실행되었습니다.'] },
        { code: 0, indent: 0, parameters: [] }
      ]
    }
  ]));

  fs.writeFileSync(path.join(dir, 'data', 'Map001.json'), JSON.stringify({
    displayName: '황혼의 성문',
    events: [
      null,
      {
        id: 2,
        name: '성문 이벤트',
        pages: [
          {
            list: [
              { code: 231, indent: 0, parameters: [1, 'castle', 0, 0, 0, 0, 100, 100, 255, 0] },
              { code: 241, indent: 0, parameters: [{ name: 'theme', volume: 90, pitch: 100, pan: 0 }] },
              { code: 101, indent: 0, parameters: ['', 0, 0, 2, '세라'] },
              { code: 401, indent: 0, parameters: ['첫 번째 줄입니다.'] },
              { code: 401, indent: 0, parameters: ['두 번째 줄입니다.'] },
              { code: 201, indent: 0, parameters: [0, 2, 5, 5, 0, 0] },
              { code: 301, indent: 0, parameters: [0, 1, false, false] },
              { code: 355, indent: 0, parameters: ['$gameParty.gainGold(100);'] },
              { code: 655, indent: 0, parameters: ['console.log("extra");'] },
              { code: 122, indent: 0, parameters: [5, 5, 1, 0, 3] },
              { code: 102, indent: 0, parameters: [['열쇠를 받는다', '거절한다'], 1, 0, 2, 0] },
              { code: 402, indent: 0, parameters: [0, '열쇠를 받는다'] },
              { code: 121, indent: 1, parameters: [1, 1, 0] },
              { code: 122, indent: 1, parameters: [2, 2, 0, 0, 7] },
              { code: 101, indent: 1, parameters: ['', 0, 0, 2, '세라'] },
              { code: 401, indent: 1, parameters: ['열쇠를 챙겼어.'] },
              { code: 402, indent: 0, parameters: [1, '거절한다'] },
              { code: 101, indent: 1, parameters: ['', 0, 0, 2, '세라'] },
              { code: 401, indent: 1, parameters: ['그냥 지나가자.'] },
              { code: 404, indent: 0, parameters: [] },
              { code: 117, indent: 0, parameters: [1] },
              { code: 111, indent: 0, parameters: [0, 1, 0] },
              { code: 111, indent: 1, parameters: [1, 2, 0, 7, 0] },
              { code: 101, indent: 2, parameters: ['', 0, 0, 2, '세라'] },
              { code: 401, indent: 2, parameters: ['비밀 문이 열렸다!'] },
              { code: 411, indent: 1, parameters: [] },
              { code: 101, indent: 2, parameters: ['', 0, 0, 2, '세라'] },
              { code: 401, indent: 2, parameters: ['열쇠만 있고 숫자가 다르네.'] },
              { code: 412, indent: 1, parameters: [] },
              { code: 411, indent: 0, parameters: [] },
              { code: 101, indent: 1, parameters: ['', 0, 0, 2, '세라'] },
              { code: 401, indent: 1, parameters: ['문이 닫혀 있어.'] },
              { code: 412, indent: 0, parameters: [] },
              { code: 101, indent: 0, parameters: ['', 0, 0, 2, '내레이션'] },
              { code: 401, indent: 0, parameters: ['모든 분기가 여기로 합류했습니다.'] },
              { code: 0, indent: 0, parameters: [] }
            ]
          }
        ]
      }
    ]
  }));

  return dir;
}

const fixtureDir = createFixtureProject();
try {
  const { scenario, report, projectRoot } = extractProject(fixtureDir);
  validate(scenario);

  assert.equal(scenario.meta.startScene, 'map001_ev002_p1');
  assert.equal(scenario.assets.cg.cg_castle, 'img/pictures/castle.png');
  assert.equal(scenario.assets.bgm.bgm_theme, 'audio/bgm/theme.m4a');

  assert.equal(report.unsupported.length, 2);
  assert.equal(report.unsupported[0].code, 355);
  assert.equal(report.unsupported[0].eventId, 2);
  assert.equal(report.unsupported[0].commandIndex, 7);
  assert.equal(report.unsupported[1].code, 122);
  assert.equal(report.unsupported[1].commandIndex, 9);

  const engA = new Engine(scenario);
  assert.equal(engA.state.cg, 'cg_castle');
  assert.equal(engA.state.bgm, 'bgm_theme');
  assert.equal(engA.step.text, '첫 번째 줄입니다.\n두 번째 줄입니다.');

  engA.next();
  assert.equal(engA.step.type, 'notice');
  assert.match(engA.step.text, /장소 이동 생략/);

  engA.next();
  assert.equal(engA.step.type, 'notice');
  assert.match(engA.step.text, /전투를 건너뛰고/);

  engA.next();
  assert.equal(engA.step.type, 'choice');
  assert.equal(engA.step.options.length, 2);

  engA.next(0);
  assert.equal(engA.step.text, '열쇠를 챙겼어.');
  assert.equal(engA.state.flags.sw_1, true);
  assert.equal(engA.state.vars.var_2, 7);

  engA.next();
  assert.equal(engA.step.text, '공통 이벤트가 실행되었습니다.');
  assert.equal(engA.state.flags.sw_10, true);

  engA.next();
  assert.equal(engA.step.text, '비밀 문이 열렸다!');

  engA.next();
  assert.equal(engA.step.text, '모든 분기가 여기로 합류했습니다.');

  engA.next();
  assert.equal(engA.step, undefined);

  const engB = new Engine(scenario);
  engB.next();
  engB.next();
  engB.next();
  engB.next(1);
  assert.equal(engB.step.text, '그냥 지나가자.');

  engB.next();
  assert.equal(engB.step.text, '공통 이벤트가 실행되었습니다.');
  assert.equal(engB.state.flags.sw_10, true);

  engB.next();
  assert.equal(engB.step.text, '문이 닫혀 있어.');

  engB.next();
  assert.equal(engB.step.text, '모든 분기가 여기로 합류했습니다.');

  const zipOut = path.join(fixtureDir, 'bundle.zip');
  const z = buildZipBundle(scenario, projectRoot, zipOut);
  assert.equal(z.fileCount, 3);
  assert.ok(fs.existsSync(zipOut) && z.bytes > 100);

  console.log('ALL MV/MZ EXTRACTOR FIXTURE TESTS PASSED:', {
    scenes: scenario.scenes.length,
    unsupportedReported: report.unsupported.length,
    zipFiles: z.fileCount,
    zipBytes: z.bytes
  });
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
