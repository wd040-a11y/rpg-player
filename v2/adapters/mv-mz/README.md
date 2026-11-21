# MV/MZ 추출 어댑터 (`v2/adapters/mv-mz`)

RPG Maker MV(`www/data`) 및 MZ(`data`) 프로젝트에서 이동·전투를 제거하고 `v2/docs/SPEC.md` v1.0 규격의 `scenario.json`과 모바일용 `.zip` 번들을 생성하는 무의존성 Node.js CLI 도구입니다.

## 사용법
```bash
# 1. scenario.json + report.json 추출
node v2/adapters/mv-mz/extract.mjs /path/to/rpgmaker-game --out ./out

# 2. v2 웹 플레이어 보관함에서 바로 열 수 있는 ZIP 번들까지 생성
node v2/adapters/mv-mz/extract.mjs /path/to/rpgmaker-game --out ./out --zip ./out/game-bundle.zip

# 3. Fixture 자동 검증 실행
node v2/adapters/mv-mz/test.mjs
```

## 처리 규칙
- **장면 ID**: `map001_ev002_p1`, `common_001`처럼 원본 맵·이벤트·페이지 번호 기반의 안정적인 ID를 부여합니다.
- **자산 경로**: `img/pictures/...`, `audio/bgm/...` 상대경로를 유지하며, 오디오는 iOS Safari 호환을 위해 `.m4a` / `.mp3`가 함께 있으면 `.ogg`보다 우선 선택합니다.
- **지원 명령**: 연속 대사(`101/401`), 선택지·합류(`102/402/404`), 중첩 조건 분기(`111/411/412`), 공통 이벤트 호출·복귀(`117`), 스위치(`121`), 셀프 스위치(`123`), 상수 변수 대입(`122`), 픽처 표시/삭제(`231/235`), BGM 재생/페이드아웃(`241/242`).
- **간소화 치환**: 장소 이동(`201`), 이동 루트(`205`), 전투 처리(`301`)는 `notice` 스텝으로 치환합니다.
- **미지원 보고서(`report.json`)**: 스크립트(`355/655`), 변수 연산식(`122`), 부등호 조건(`111`) 등 v1.0에서 표현할 수 없는 명령은 원본 위치(`source`, `mapId`, `eventId`, `page`, `commandIndex`, `code`)와 함께 `report.json`에 기록합니다.
