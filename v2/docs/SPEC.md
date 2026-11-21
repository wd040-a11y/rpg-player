# 재생기 계약 v1.0
정적 HTTP(S) 사이트의 index.html이 ES 모듈을 시작한다. 빌드 단계는 없다. 엔진은 DOM, 저장소, 원본 RPG Maker 이벤트에 의존하지 않는다. 추출기는 ZIP 루트에 UTF-8 scenario.json을 기록한다.

|필드|형식|
|---|---|
|version|문자열 "1.0"|
|meta|title, sourceEngine, startScene 문자열|
|assets|cg, bgm 각각 ID → 상대경로 사전. 경로 구분자는 /|
|scenes|고유 id, title, tag 문자열과 순서 있는 steps 배열|

|type|필드와 의미|
|---|---|
|cg, bgm|id로 해당 자산 교체. null로 해제|
|notice|text 표시 후 입력 대기|
|text|speaker, text 표시 후 입력 대기|
|choice|options 배열. 각 항목은 label 및 선택적 setFlag, setVar, goto. 대입 후 이동하며 goto 생략 시 다음 스텝|
|setFlag, setVar|key, value. boolean 스위치와 유한 숫자 변수의 절대 대입. 선택지 대입도 동일한 객체|
|branch|key, equals, then, else. equals 자료형에 따라 flags 또는 vars에서 조회. 미설정 기본값 false/0. 두 목적지는 장면 ID|
|jump|goto 장면 ID|

장면 끝은 종료다. 점프는 장면 첫 스텝으로 이동하고 상태를 보존한다. 자동·스킵은 선택지를 대신 고르지 않는다. 저장 위치는 현재 표시 스텝이다.
모바일은 파일 입력, 44px 이상 조작, safe area, 동적 뷰포트, 사용자 제스처 기반 오디오를 사용한다. 단독 JSON의 상대경로는 사이트 기준으로 해석하며 로컬 이미지·음원 동봉에는 ZIP을 사용한다.
