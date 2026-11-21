# v2 진행 상태
마지막 작업 AI — Gemini Task (2026-11-21)

완료 —
1. `feat/v2-modular`의 `v2/` 재생기(`index.html`, `sw.js`, `src/{styles.css,engine.js,loader.js,storage.js,ui.js}`) 교차 리뷰 완료.
2. `v2/adapters/mv-mz/`에 무의존성 Node.js MV/MZ 추출기 및 ZIP 번들러 구현:
   - `extract.mjs`: `MapXXX.json`, `CommonEvents.json`, `MapInfos.json`, `System.json` 파싱 -> `SPEC.md` v1.0 `scenario.json` + `report.json` + `--zip` 번들 생성
   - `test.mjs`: `v2/src/engine.js`의 `validate()`/`Engine`을 직접 로드해 연속 대사, 선택지 분기·합류, 중첩 조건 분기, 공통 이벤트 호출·복귀, 이동·전투 `notice` 치환, 미지원 명령(`355/655`, 변수 연산 `122`) 보고서, ZIP 생성 검증 통과
   - `README.md`: CLI 사용법 및 지원 명령 정리

교차 리뷰에서 발견된 `v2/` 보완 필요 항목 (다음 GPT Work 턴 대상) —
1. `v2/sw.js`: `activate` 이벤트에서 구버전 캐시(`caches.keys()`)를 삭제하지 않아 캐시 버전 업 시 이전 캐시가 남음.
2. `v2/src/storage.js`: `slot()`의 `localStorage.setItem` / `JSON.parse`에 `try/catch`가 없어 시크릿 모드·용량 초과·손상된 저장 데이터 시 `slots()` 모달이 예외로 중단됨.
3. `v2/src/loader.js`: `crypto.subtle.digest`는 HTTPS/`localhost` 외의 로컬 HTTP IP(예: `http://192.168.x.x` 실기기 테스트)에서 `undefined`이므로 폴백 해시 필요.
4. `v2/src/ui.js`: `openBook()` 시 이전 책의 오디오 정지(`audio.pause()`, `soundKey = ''`)를 명시적으로 초기화하면 연속 ZIP 교체 시 오디오 상태 꼬임 방지 가능.

남은 작업 —
- 위 4건 `v2/` 모바일 안정화 패치 및 `sw.js` 캐시 버전 업
- GitHub Pages(`feat/v2-modular` 또는 `main`) 배포 및 iOS Safari 실기기 검증
- 실제 MV/MZ 게임 데이터 대상 암호화 리소스(`.rpgmvp`/`.png_`) 복호화 옵션 및 VX Ace 어댑터(후속 범위)
