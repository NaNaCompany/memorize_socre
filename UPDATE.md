# Updates

## 2026-10-31 — 첫 진입 메인 고정·최근 악보 배너

- 저장된 마지막 악보와 이전 #practice/#view 등이 있어도 사이트 진입·새로고침 시 메인 소개/악보 선택 화면부터 표시한다. 기존 자동 악보 복원을 제거했다.
- 샘플 HEAD 요청이 끝나기 전에도 메인을 먼저 렌더한다. 늦은 응답으로 사용자가 이미 연 연습 화면을 덮어쓰지 않으며, 요청 도중 추가된 악보는 최신 보관함에서 다시 읽는다.
- 기존 악보가 있는 보관함에서도 소개 히어로를 유지한다. 최근 악보는 기존 저장 정보를 읽은 배너와 명시적 ‘이어서 연습’ 버튼으로 제공한다. 저장된 악보·진도·설정은 삭제하거나 초기화하지 않는다.
- 헤더의 악보 암기 링크로도 메인 화면을 확실히 열도록 연결했다. 긴 최근 악보 제목은 줄임 표시한다.
- 시작 해시 5가지·저장 악보 유무·명시적 재개·샘플 응답 지연과 화면 경합을 포함한 메인/게시자 회귀 검사 13개 및 JS 구문 검사 통과. 캐시 버전을 갱신한다. 배포 커밋·공개 HTTP 대조 근거는 workspace .tools/memorize-landing-20261031/에 별도 기록한다.

## 2026-10-31

- Added self-referencing canonical and Open Graph URL, a sitemap.xml containing the public root page, allow-all robots.txt, ads.txt, an app icon, and a subtle More Apps footer link.
- Applied the verified NaNa Lab GA4, GTM including noscript, Google AdSense, and Cloudflare Web Analytics on the served HTML. The shared source helper is tools/publisher-tracking.mjs; regenerate metadata using node tools/site_metadata.mjs. Local/test hosts do not initialize publisher requests. Page-view URLs exclude query strings and fragments; no uploaded file, score content or other input is sent as a custom event.
- Registered one Korean representative card and the app sitemap leaf in the NaNa Lab directory. Catalog descriptions are translated in eight secondary UI languages; this app itself currently serves Korean.
- Reorganized the landing page using score_reading as the visual reference: the same unmodified main.gif, warm white cards, orange primary action, two-column hero with an actual sample preview, three practice groups, and expandable additional examples. Removed decorative introductory copy.
- Kept the MusicXML parser, engraving, audio, exercise modules, uploaded-score storage and progress storage. Added animation pause/resume and still-image previews, including reduced-motion preference support.
- Background provenance and SHA-256 are recorded in assets/background-source.json. Original sample-score demo animations remain the source of practice previews.
- Static/source preservation and runtime checks, public deployment/readback, and browser-verification limits are recorded separately in the workspace release evidence. Browser automation stopped because it could not confidently determine the current Windows browser URL; no browser QA completion is claimed.


## 2026-10-31 — 제공 악보 샘플 추가

- 사용자가 공개 샘플로 제공한 라흐마니노프 Op. 39 No. 6(121마디)·바르톡 Allegro barbaro(224마디)를 samples/에 추가했다.
- 요청한 identification 요소와 모든 하위 항목만 제거했다. 나머지 입력 바이트·음표·마디·색상 속성은 유지하고 원본 첨부 파일은 변경하지 않았다. 두 앱에 동일 SHA-256 파일을 제공한다. samples/manifest.json에 출처 파일명·변경 내역·해시를 기록했다.
- 보관함의 기존 샘플 곡을 유지하고 예제 카드 2개를 연결했다. 파서·진도 저장·기존 색상 초기화 동작은 유지했다.
- 기존 GA4·GTM+noscript·AdSense·Cloudflare, canonical·sitemap·robots·More Apps를 유지했다. 샘플 XML은 HTML 페이지가 아니므로 태그나 중복 sitemap URL을 삽입하지 않았다. 정적 파일·런타임 mock·공개 배포 대조 결과는 workspace .tools/music-samples-20261031/에 기록한다. 실제 브라우저 렌더링/오디오 검증은 별도다.
