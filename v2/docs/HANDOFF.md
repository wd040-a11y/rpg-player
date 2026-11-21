# GPT Work 인계 (v2 안정화 + MV/MZ 어댑터 반영)

1. 첨부된 `v2/adapters/mv-mz/{extract.mjs,test.mjs,README.md}`와 갱신된 `v2/docs/STATE.md`를 `feat/v2-modular` 브랜치에 반영하고 `node v2/adapters/mv-mz/test.mjs` 통과를 확인한다.
2. 교차 리뷰에서 발견된 아래 4건의 모바일/Safari 엣지케이스를 `v2/`에 패치한다:
   - `v2/sw.js`: `activate`에서 현재 `cacheName` 이외의 이전 `star-theatre-` 캐시를 삭제하고 캐시 버전을 `-2`로 올린다.
   - `v2/src/storage.js`: `slot()`의 `localStorage` 읽기/쓰기/파싱을 `try/catch`로 감싸 사생활 보호 모드·용량 초과·손상 JSON 시 안전하게 실패 처리한다.
   - `v2/src/loader.js`: 비보안 HTTP 로컬 IP 테스트 환경을 위해 `crypto.subtle` 미지원 시 결정적 폴백 해시를 사용한다.
   - `v2/src/ui.js`: `openBook()`에서 새 책을 열 때 `audio.pause()`, `soundKey = ''`를 명시적으로 초기화해 ZIP 연속 교체 시 오디오 상태 꼬임을 방지한다.
3. `v2/adapters/mv-mz/extract.mjs`로 생성한 샘플 ZIP 번들을 `v2/` 보관함에서 가져오기 -> 재실행 -> 삭제 흐름으로 검증(가능 시 브라우저/실기기)한다.
4. 커밋 후 `v2/docs/STATE.md`와 `v2/docs/HANDOFF.md`를 다음 목표(실제 MV/MZ 게임 암호화 리소스 대응 또는 VX Ace 어댑터)로 갱신한다.
