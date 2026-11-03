# Updates

## 2026-11-03 — 모바일 퀴즈 악보 높이 제한

- 휴대폰·태블릿 퀴즈의 악보 상자를 화면 높이의 30% 이하로 제한했다. 1024px 이하 화면 및 터치 장치에 적용해 가로 모드도 포함한다. 지원 브라우저에서는 동적 뷰포트 높이(dvh)를 사용하고 svh/vh를 대체값으로 둔다.
- 악보 SVG 자체의 높이를 내부 여백·테두리까지 고려해 제한한다. Verovio viewBox 비율을 유지해 악보 전체를 축소하며, 기존 wide 악보 최소 너비를 해제해 잘리지 않도록 한다.
- 퀴즈의 문제·보기 악보에 공통 적용한다. 전체 악보 뷰어·메인 샘플·PC 일반 화면·문제/진도/저장 로직·공통 배너·게시자 태그는 보존했다.
- 배포 전 CSS/JS 캐시 버전을 갱신한다. 검사 및 공개 배포 대조 근거는 workspace .tools/music-quiz-height-20261103/에 기록한다.

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


## 2026-10-31 — OG 공유 이미지

- 앱별 1200×630 정적 PNG 대표 이미지를 신규 제작했다. 악보 암기는 마디 퍼즐, 초견 도우미는 변화표·셈여림·표현 기호 색상 표시를 원본 절차적 그래픽으로 표현한다. 외부 이미지나 사용자가 업로드한 악보는 사용하지 않았다. 설치된 시스템 폰트로 렌더했으며 폰트 파일은 배포하지 않는다.
- 이미지 파일명에 SHA-256 접두사를 넣고 assets/og.json에 실제 치수·MIME·해시·alt를 기록했다. tools/build_og.py로 재생성하고 tools/site_metadata.mjs로 적용한다.
- OG title/description/type/locale/site_name/url/image와 image secure_url/type/width/height/alt, Twitter summary_large_image/title/description/image/alt를 소스 생성기에 추가했다. HTTPS 절대 URL 사용, 중복 필드 없음과 재생성 멱등성을 검사했다. 규격 참고: https://ogp.me/.
- 기존 앱 body와 런타임, 진입 화면/최근 악보 배너·샘플·색상·진도·4대 게시자 태그·GTM noscript·사이트맵·robots는 보존했다. OG 이미지 자체는 픽셀로 열어 검토했다. 실제 카톡·X에서 공유한 화면이나 플랫폼 미리보기 캐시 갱신은 별도 검증이며 완료로 주장하지 않는다.
- 배포 SHA, 공개 HTML·PNG·bot User-Agent 응답 대조 결과: workspace .tools/music-og-20261031/의 static-check.json·publish.json·live-check.json·completion.json.

## 2026-11-02 — Shared book banner

- Connected all public page types to `https://nanalab.kr/src_cdn/banner/astra.js`. Campaign, design, translated controls and the supplied YES24 book destination are maintained centrally in src_cdn.
- Shared archive assets load the banner on detail/list pages; other HTML and source templates include the stable deferred loader. HTML-only generator adapters retain the connection after rebuilds and pass non-HTML values through unchanged.
- The component is closable for the tab session, clears detected bottom navigation, and hides for modals/fullscreen/mobile input. The Astra practice site remains excluded. No additional analytics or ad-network requests are introduced by the component.
- Existing content, routes and publisher integrations are preserved. Direct HTML changes restore exactly to the baseline when the marked loader is removed. Workspace validation/deployment evidence: `.tools/shared-book-banner-20261102/`.
