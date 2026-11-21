# v1 진행 상태
완료 — feat/v2-modular 브랜치의 v2/에 독립적인 Pages 진입점, 시나리오 검증/실행, 입력·저장·갤러리·선택·오디오·오프라인 캐시를 구현했다. Pages가 이 브랜치 루트를 제공할 때 /rpg-player/v2/에서 실행된다.

변경 파일은 index.html, sw.js, src/{styles.css,engine.js,loader.js,storage.js,ui.js}, sample/{scenario.json,dawn.svg}, docs/{SPEC.md,STATE.md,HANDOFF.md}다.

검증 — ES 모듈 구문 검사 및 Node 엔진 테스트 통과. 데모의 두 선택 경로, notice, 선택지 입력 대기, 엔딩, 저장 복원을 확인했다. Chromium은 작업 환경의 소켓 제한으로 시작하지 못했다. 브라우저 통합 테스트와 Pages 배포는 미검증이다.

남은 작업 — iOS Safari 실기기 검증과 MV/MZ 어댑터. 첫 온라인 방문에서 서비스 워커 설치와 JSZip CDN 캐시가 완료된 후 오프라인으로 열어 확인한다. 저장소 퇴거나 사이트 데이터 삭제 시 번들은 사라질 수 있다.
