# HanGaRo — 기술 구현 상세

> 프로젝트 개요 및 설정은 [README.md](../README.md) 참조  
> 최종 업데이트: 2026-07-22

---

## 목차

1. [전역 상태 및 상수](#1-전역-상태-및-상수)
2. [지도 시스템](#2-지도-시스템)
3. [관광지 Callout 카드 마커](#3-관광지-callout-카드-마커)
4. [장소 검색 시스템](#4-장소-검색-시스템)
5. [경로 시스템](#5-경로-시스템)
6. [레이아웃 패턴](#6-레이아웃-패턴)
7. [백엔드 API 명세](#7-백엔드-api-명세)
8. [버그 수정 이력](#8-버그-수정-이력)
9. [미완료 항목](#9-미완료-항목)

---

## 1. 전역 상태 및 상수

모든 화면 공유 상태는 `App.jsx`에서 관리하며 props로 전달합니다.

### 주요 상태 변수

| 상태 | 타입 | 설명 |
|------|------|------|
| `screen` | `1 \| 2 \| 3` | 현재 화면 (MainPage / SearchingPage / ResultPage) |
| `dark` | boolean | 다크모드 여부 |
| `transport` | `'walk' \| 'transit' \| 'car'` | 이동수단 |
| `userLocation` | `{ lat, lng } \| null` | GPS 좌표 |
| `mapCenter` | `{ lat, lng } \| null` | 현재 지도 중심 (검색 기준) |
| `origin` | `{ lat, lng, name } \| null` | 출발지 (null = GPS 현재 위치) |
| `destination` / `destinationLatLng` | `string / { lat, lng }` | 목적지 텍스트 + 좌표 |
| `waypoints` | `{ id, name, lat, lng }[]` | 경유지 배열 |
| `resultSpots` | `Spot[]` | API 또는 사용자 선택 관광지 |
| `resultWaypoints` | `Waypoint[]` | 결과 화면 장소 목록 (드래그 순서 반영) |

### 경로 생성 분기 (startSearch)

```
사용자가 목적지 또는 경유지를 직접 입력했는가?
  YES → API 없이 즉시 경로 구성 (originPoint + wpPoints + destPoint)
  NO  → 백엔드 /api/recommend 호출
         └→ 실패 시 IDLE_NODES 데모 데이터 폴백
```

### 색상 상수

```js
LEVEL_COLOR = {
  quiet:    '#10b981',  // 에메랄드
  relaxed:  '#f59e0b',  // 앰버
  moderate: '#f97316',  // 오렌지
  crowded:  '#ef4444',  // 레드
}
```

### 데모 관광지 (IDLE_NODES)

```js
// 백엔드 미연결 시 폴백으로 사용하는 서울 관광지 6개
{ id: 'gb', name: '경복궁',       lat: 37.5796, lng: 126.9770, level: 'crowded'  }
{ id: 'bc', name: '북촌한옥마을', lat: 37.5826, lng: 126.9830, level: 'moderate' }
{ id: 'is', name: '인사동',       lat: 37.5740, lng: 126.9858, level: 'moderate' }
{ id: 'cd', name: '창덕궁',       lat: 37.5794, lng: 126.9910, level: 'quiet'    }
{ id: 'np', name: '낙산공원',     lat: 37.5804, lng: 127.0072, level: 'quiet'    }
{ id: 'im', name: '이화마을',     lat: 37.5773, lng: 127.0070, level: 'relaxed'  }
```

---

## 2. 지도 시스템

### SmartMapView — 자동 선택

```
VITE_MAPBOX_TOKEN 설정됨 → MapboxView (3D)
VITE_MAPBOX_TOKEN 없음   → KakaoMapView (2D)
```

### MapboxView 초기화 옵션

```js
new mapboxgl.Map({
  center:    [126.9780, 37.5665],      // 서울 기본값
  zoom:      14,
  pitch:     50,
  bearing:   -10,
  antialias: true,
  maxBounds: [[124.5, 33.0], [132.0, 38.9]], // 대한민국 영역 제한 (패닝 차단)
})
```

### Mapbox 레이어 구성

| 레이어 ID | 타입 | 역할 | 삽입 위치 |
|-----------|------|------|----------|
| `hgr-3d-buildings` | fill-extrusion | 건물 3D (minzoom 14) | symbol 레이어 앞 |
| `hgr-bars` | fill-extrusion | 혼잡도 막대 | symbol 레이어 앞 |
| `hgr-route-glow` | line | 경로 발광 (두께 16, blur 8, 불투명도 0.14) | symbol 이후 |
| `hgr-route` | line | 경로 메인 (두께 5, 불투명도 0.92) | symbol 이후 |

> symbol(텍스트) 레이어 앞에 fill-extrusion 삽입 → 도로명이 막대에 가려지지 않음

### 혼잡도 막대 애니메이션

```js
// 높이 0으로 리셋 → 데이터 삽입 → 2프레임 대기 → 최종 높이 설정
// Mapbox 내장 fill-extrusion-height-transition: 900ms 가 성장 애니메이션 처리
map.setPaintProperty('hgr-bars', 'fill-extrusion-height', 0)
map.setPaintProperty('hgr-bars', 'fill-extrusion-opacity', 0)
map.getSource('hgr-bars').setData({ features })
requestAnimationFrame(() => requestAnimationFrame(() => {
  map.setPaintProperty('hgr-bars', 'fill-extrusion-height', ['get', 'height'])
  map.setPaintProperty('hgr-bars', 'fill-extrusion-opacity', 0.88)
}))

// 막대 높이 계산: 혼잡도 점수 × 210m (최소 20m)
height = Math.max(20, Math.round(congestionScore × 210))
// quiet(0.15) → 32m / moderate(0.65) → 137m / crowded(0.88) → 185m
```

### GPS 콜백 안전 처리

React StrictMode는 effect를 이중 실행합니다. GPS 콜백이 언마운트 이후에 늦게 도착하면 `TypeError: Cannot read properties of undefined (reading 'appendChild')` 발생.

```js
// 수정: GPS 등록 전에 ref 저장 + null 체크
mapRef.current = map   // ← GPS 등록보다 먼저 저장
navigator.geolocation.getCurrentPosition(({ coords }) => {
  if (!mapRef.current) return   // 언마운트 후 도착 → 무시
  mapRef.current.setCenter([lng, lat])
  new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapRef.current)
})
```

### ResizeObserver (지도 캔버스 크기 갱신)

```js
// flex 레이아웃 확정 후 Mapbox가 올바른 크기로 렌더링되게 함
const ro = new ResizeObserver(() => mapRef.current?.resize())
ro.observe(containerRef.current)
```

---

## 3. 관광지 Callout 카드 마커

지도 위 관광지마다 수직선 + 3D 포토카드가 표시되는 마커 시스템.

### DOM 구조

```
wrap (flex-column, pointer-events: none)
 ├── card (pointer-events: auto)
 │    └── photoWrap (130×86px)
 │         ├── img (object-fit: cover, loading: lazy)
 │         ├── overlay (그라데이션: transparent → rgba(0,0,0,0.72))
 │         └── infoRow (absolute, 하단)
 │              ├── nameEl (장소명, text-overflow: ellipsis)
 │              └── badge (혼잡도 레벨, 배경: LEVEL_COLOR)
 ├── stem (width: 2px, height: 28px, 색상 그라데이션)
 └── dot (8px 원형, 글로우 box-shadow)
```

### 3D 카드 CSS

```js
'transform: perspective(500px) rotateX(6deg);'
'transform-origin: bottom center;'
'box-shadow: 0 2px 0 rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.18), 0 20px 40px rgba(0,0,0,0.22);'
'animation: calloutFadeIn 0.45s cubic-bezier(0.34,1.4,0.64,1) both;'
```

### 등장 애니메이션 (index.css)

```css
@keyframes calloutFadeIn {
  from { opacity: 0; transform: perspective(500px) rotateX(6deg) translateY(14px) scale(0.88); }
  to   { opacity: 1; transform: perspective(500px) rotateX(6deg) translateY(0) scale(1); }
}
/* perspective 값을 from/to 양쪽에 동일하게 유지해야 애니메이션 중 3D가 유지됨 */
```

### 흔들림 방지 (useMemo)

```js
// attractionPins 배열이 매 렌더마다 새로 생성되면:
// useEffect 의존성 변경 → 마커 전체 삭제/재생성 → 등장 애니메이션 반복
const attractionPins = useMemo(() =>
  IDLE_NODES.map((n) => ({ id: n.id, name: n.name, ... })),
[])  // IDLE_NODES는 모듈 상수 → 빈 의존성 = 단일 참조 보장
```

### 줌 레벨 기반 가시성

```js
const CALLOUT_MIN_ZOOM = 13

// 'zoom' 이벤트: 스크롤 중에도 실시간 발화
// ('zoomend'는 애니메이션 완료 후 1회만 발화 → 반응 지연)
map.on('zoom', () => {
  const show = map.getZoom() >= CALLOUT_MIN_ZOOM
  calloutRef.current.forEach((m) => {
    // display: none 사용 (opacity: 0은 레이아웃·포인터 이벤트 잔존)
    m.getElement().style.display = show ? 'flex' : 'none'
  })
})
```

### 이벤트 차단

```js
// 카드 클릭이 Mapbox 지도로 전파되어 카메라가 이동하는 것을 방지
card.addEventListener('mousedown', (e) => e.stopPropagation())
card.addEventListener('click',     (e) => e.stopPropagation())
```

---

## 4. 장소 검색 시스템

`PlaceSearchInput` 컴포넌트 — Kakao Places API 자동완성.

### Kakao SDK 초기화 전략

`index.html`에서 `autoload=false`로 SDK를 로드하면 `kakao.maps.services` 가 즉시 사용 불가합니다.

```js
// App.jsx: 컴포넌트 마운트 시 선행 초기화 시도
useEffect(() => {
  if (window.kakao?.maps && !window.kakao.maps.Map) {
    window.kakao.maps.load(() => {})  // services 모듈 활성화
  }
  const t = setTimeout(initKakao, 1500)  // 스크립트 로드 지연 대비
  return () => clearTimeout(t)
}, [])

// doSearch: services 미준비 시 load() 재호출
const services = kakao.maps.services
if (services?.Places) {
  runWithServices(services)
} else {
  kakao.maps.load(() => runWithServices(kakao.maps.services))
}
```

### 검색 정렬 — ACCURACY 기본값

```js
// SortBy.DISTANCE + 반경 옵션을 제거한 이유:
// - "인사동" 검색 시 반경 내 식당/가게가 인사동 거리보다 상위 노출
// - "서울역" 검색 시 20km 반경이 현재 위치(지방)를 중심으로 잡아 ZERO_RESULT 발생
// 옵션 없음 = ACCURACY(정확도순) 기본값
ps.keywordSearch(q, callback)  // 위치 옵션 없음 → 전국 정확도순
```

### 드롭다운 Portal

Mapbox GL 캔버스나 모바일 Bottom Sheet의 CSS transform 컨텍스트에서  
`position: fixed` 요소가 올바른 위치를 벗어나는 문제를 방지합니다.

```js
// document.body에 직접 마운트 + getBoundingClientRect()로 절대 좌표 계산
createPortal(
  <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, ... }}>
    {results}
  </div>,
  document.body
)
```

---

## 5. 경로 시스템

### OSRM 실도로 경로 (routing.js)

```
엔드포인트: https://router.project-osrm.org/route/v1/{profile}/{coords}
  walk    → foot
  car     → driving
  transit → driving (점선 스타일로 시각 구분)

파라미터: overview=full&geometries=geojson
반환: { lat, lng }[] | null (실패 시 노드 간 직선 연결 폴백)
```

### 경로 스타일

| 이동수단 | 라인 스타일 | 색상 |
|---------|-----------|------|
| walk / car | solid | 플랜 탭 색상 |
| transit | `line-dasharray: [4, 2]` 점선 | 플랜 탭 색상 |

### 경로 깜빡임 방지

```js
// routeCoordKey: 좌표 문자열 해시 → 위치가 실제로 바뀔 때만 OSRM 재요청
// planColor(탭 전환)는 좌표 불변 → 재요청 없음
const routeCoordKey = useMemo(() =>
  routeNodes.map((n) => `${n.lat.toFixed(5)},${n.lng.toFixed(5)}`).join('|'),
[routeNodes])

useEffect(() => {
  fetchRouteGeometry(routeNodes, transport).then((path) => {
    if (!cancelled && path) setRoutePath(path)
    // setRoutePath(null) 호출 없음 → 이전 경로 유지하다 새 경로 도착 시 교체
  })
}, [routeCoordKey, transport])  // planColor 의도적 제외
```

### 출발지 중복 방지

```js
// 사용자 직접 입력 경로의 경우 resultSpots[0].id === '__origin__'
// → originNode를 별도로 다시 추가하면 출발지 마커/경로 중복
const originAlreadyInSpots = hasRealSpots && resultSpots[0]?.id === '__origin__'
const routeNodes = originAlreadyInSpots
  ? nodesResult
  : [...(originNode ? [{ ...originNode, id: '__origin__' }] : []), ...nodesResult]
```

---

## 6. 레이아웃 패턴

### Flex 높이 체인 — 100% 대신 minHeight: 0

브라우저는 flex 컨테이너에서 `height: 100%` 를 올바르게 처리하지 못하는 경우가 있습니다.

```js
// 부모 컨테이너: flex: 1 + minHeight: 0
{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }

// Mapbox 래퍼 div: alignSelf stretch
{ position: 'relative', overflow: 'hidden', alignSelf: 'stretch' }

// Mapbox 실제 캔버스: inset 0으로 부모 완전히 채움
<div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
```

### 드롭다운 클리핑 방지

사이드바 `overflow: hidden` 이 내부 검색 드롭다운을 잘라냅니다.

```js
// MainPage 데스크탑 사이드바
{ overflow: 'visible' }  // overflow: hidden 대신 visible
// 드롭다운은 createPortal로 body에 렌더링하므로 어차피 클리핑 무관
```

---

## 7. 백엔드 API 명세

### 엔드포인트

| 메서드 | 경로 | 역할 |
|--------|------|------|
| `POST` | `/api/recommend` | 혼잡도 기반 관광 코스 추천 |
| `GET`  | `/api/spots/nearby` | 주변 관광지 조회 |
| `GET`  | `/api/spots/search` | 키워드 검색 |
| `GET`  | `/api/congestion/:id` | 특정 관광지 혼잡도 |
| `GET`  | `/api/congestion/:id/timeline` | 시간대별 혼잡도 예측 |

### POST /api/recommend

```json
// 요청
{ "region": "서울", "date": "2026-07-22", "start_time": "14:00",
  "style": "culture", "transport": "walk", "n_stops": 5 }

// 응답
{
  "spots": [
    { "id": "cd", "name": "창덕궁", "lat": 37.5794, "lng": 126.9910,
      "congestion_label": "한적", "visit_duration": 40 }
  ],
  "total_congestion_avg": 0.28,
  "congestion_reduction_pct": 61.0
}
```

### 혼잡도 조회 우선순위

```
1차: Redis 캐시 (TTL 기반 — 실시간성 vs 비용 트레이드오프)
2차: KT TatsCnctrRateService API (cnctrRate ÷ 100 → 0.0~1.0)
3차: congestion_patterns.json (카테고리 × 요일 × 시간대 정적 패턴)
```

### 경로 최적화 알고리즘

```
link_cost = travel_time × (1 + congestion × PENALTY_WEIGHT) - gem_bonus

Plan A: modified_dijkstra (congestion 최소)
Plan B: modified_dijkstra (travel_time 최소)
Plan C: hidden_gem_score 정렬 (알려지지 않은 명소 우선)
  = (rating/5.0 × 0.4) + ((1 - congestion_avg) × 0.3) + (rank_score × 0.3)

버퍼 라우팅:
  목적지 혼잡도 > 0.7 → find_buffer_nodes() → 우회 명소 삽입
  predict_clear_time() → 혼잡 해소 예상 시각 계산
```

---

## 8. 버그 수정 이력

| # | 증상 | 원인 | 수정 |
|---|------|------|------|
| 1 | 검색 드롭다운 미표시 | `autoload=false`인데 `load()` 미호출 → `services.Places` undefined | `doSearch`에서 `kakao.maps.load()` 후 콜백 실행 |
| 2 | "서울역" → ZERO_RESULT | 20km 반경 위치 편향 → 현재 위치(지방) 기준으로 서울역 제외 | 반경 옵션 제거, 전국 ACCURACY 검색 |
| 3 | 검색 결과가 주변 가게 | `SortBy.DISTANCE` 거리순 → 명소보다 인근 식당 상위 노출 | 옵션 없음(ACCURACY 기본값)으로 변경 |
| 4 | GPS `TypeError: appendChild undefined` | React StrictMode 이중 실행 → 언마운트된 map에 마커 추가 시도 | `mapRef.current = map`을 GPS 등록 전으로 이동 + null 체크 |
| 5 | 지도가 사이드바에 클리핑 | flex 체인 `height: 100%` 미해결 | `minHeight: 0` + `position: absolute; inset: 0` |
| 6 | Callout 카드 흔들림 + 이미지 재로딩 | `attractionPins` 매 렌더마다 새 배열 → 마커 전체 재생성 | `useMemo([])` — 컴포넌트 생애 단일 참조 |
| 7 | hover 시 마커 위치 이상 | `transform: scale(1.05)` hover가 Mapbox 위치 계산과 충돌 | hover transform 전체 제거 |
| 8 | 줌아웃 시 카드 즉시 미사라짐 | `zoomend` — 줌 애니메이션 완료 후에만 발화 | `zoom` 이벤트로 교체 (스크롤 중 실시간 발화) |
| 9 | 줌아웃 후 투명 카드 잔존 | `opacity: 0` 적용 시 DOM 레이아웃·포인터 이벤트 잔존 | `display: none/flex` 토글로 교체 |
| 10 | "Stay ~null" 표시 | origin의 `visit_duration: null` | `{rw.stay && ...}` 조건부 렌더링 |

---

## 9. 미완료 항목

### 기능 연결

- [ ] Plan A / B / C 탭 → 백엔드 알고리즘 분기 실제 연결
- [ ] 버퍼 라우팅 UI → 실제 API 응답 기반 동작 (현재 하드코딩)
- [ ] 혼잡 노드 → TatsCnctrRateService 실데이터 연동 (현재 IDLE_NODES 데모)
- [ ] 드래그 순서 변경 후 혼잡도 재계산

### UI 개선

- [ ] Callout 카드 이미지 → picsum.photos → 실제 KTO 이미지
- [ ] 여행 스타일 필터 (문화 / 자연 / 음식)
- [ ] Save / Share 버튼 실제 동작

### 데이터

- [ ] TatsCnctrRateService 실 데이터 수집 확인
- [ ] area_cd / sigungu_cd 매핑 테이블 보완
- [ ] 서울 이외 지역 관광지 데이터 확충 (부산, 제주, 경주)

### 고려 중

- [ ] 도로 CCTV 연동 — ITS 국토교통부 CCTV 화상자료 API
- [ ] 실시간 혼잡도 폴링 (SSE 또는 WebSocket)
