# v2 진행 상태

2026-11-21 · feat/v2-modular · 구현 커밋 3d194b9

## 완료
- v2/adapters/mv-mz/{extract.mjs,test.mjs,README.md} 반영. MV/MZ 프로젝트에서 scenario.json, 미지원 명령 report.json과 자산 ZIP을 생성한다. 지원 명령과 CLI는 어댑터 README에 있다.
- sw.js 캐시 버전 2. 활성화 시 같은 서비스 워커 범위의 이전 번호 캐시를 삭제한다.
- src/storage.js의 슬롯 읽기·파싱 오류는 빈 슬롯으로 처리하고, 쓰기 실패는 src/ui.js에서 메시지로 표시한다.
- src/loader.js는 HTTPS의 기존 SHA-256 ID를 유지한다. Web Crypto가 없는 HTTP에서는 UTF-8 기반 FNV-1a 64비트 ID를 사용한다.
- src/ui.js는 책 교체 시 이전 자산 요청을 무효화하고 오디오를 정지하며 음원과 재생 키를 초기화한다.

## 확인한 결과
- node v2/adapters/mv-mz/test.mjs 통과. 장면 12개, 미지원 명령 2개, ZIP 항목 3개. 선택지 합류, 중첩 분기, 공통 이벤트 복귀, 이동·전투 알림을 확인했다.
- 생성된 1,390바이트 ZIP으로 UI 가져오기 → 목록에서 다시 열기 → 삭제 통과. 실제 UI·로더·엔진·저장 모듈과 JSZip을 사용하고 DOM·오디오·IndexedDB는 Node 테스트 대역을 사용했다.
- 같은 ZIP의 HTTP 식별자 재현, HTTPS 식별자 형식, 연속 교체 시 오디오 정지, 슬롯 읽기 거부·손상 JSON·쓰기 실패, 캐시 삭제 범위를 확인했다.

## 남은 검증
Chromium은 소켓 생성 제한으로 시작하지 못했다. 실제 브라우저의 새로고침 후 IndexedDB 지속성, 오프라인 재접속, Safari 음원 디코딩·재생은 미검증이다. Fixture의 이미지·음원은 자리표시자다. Pages 배포 및 실기기 확인은 후속 작업이다.
