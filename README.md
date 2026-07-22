# HanGaRo (한가로)

> **실시간 관광지 혼잡도 기반 여행 코스 추천 서비스**  
> 2026 한국관광데이터 활용 공모전 — 지정과제 2번

---

## 서비스 소개

유명 관광지에 인파가 집중되는 오버투어리즘 문제를 해결합니다.

혼잡도 정보를 지도 위에 직관적으로 시각화하고, 덜 붐비는 경로를 자연스럽게 제안합니다.  
**강제가 아닌 정보 제공 + 대안 제시**를 통해 관광객 스스로 행동을 바꾸도록 유도합니다.

---

## 핵심 기능

### 혼잡도 시각화
- 지도 위 관광지마다 실시간 혼잡도를 **3D 막대**로 표시
- 한적(초록) → 여유(노랑) → 보통(주황) → 혼잡(빨강) 4단계 색상
- 관광지 **포토카드 마커** — 사진 + 혼잡도 배지가 카드 형태로 지도 위에 표시 (zoom ≥ 13)

### 3가지 추천 플랜

| 플랜 | 기준 | 효과 |
|------|------|------|
| **Plan A — 혼잡 최소** | Modified Dijkstra (혼잡도 가중치 최소) | 인파를 최대한 피함 |
| **Plan B — 최단 경로** | 이동시간 최소 | 빠른 이동 |
| **Plan C — 숨은 명소** | `hidden_gem_score` 최대 | 덜 알려진 명소로 자연 분산 |

### 버퍼 라우팅
혼잡한 관광지를 방문해야 할 때, 혼잡이 해소될 때까지 **근처 숨은 명소를 먼저 들르도록** 동선을 자동 조정합니다.

### 장소 검색 및 경로 설정
- 출발지 / 목적지 / 경유지 자유 입력 (Kakao Places 자동완성)
- 이동수단 선택: 도보 / 대중교통 / 자동차
- 드래그로 방문 순서 변경

---

## 화면 구성

```
화면 1 — 메인 지도     →     화면 2 — 탐색 중     →     화면 3 — 결과
(지도 + 검색 패널)           (로딩 애니메이션)           (경로 + 장소 목록)
```

### 화면 1 — 메인 지도
- Mapbox 3D 지도 (pitch 50°) 또는 Kakao 2D 지도 (자동 선택)
- GPS 현재 위치 자동 감지 + 파란 점 마커
- 관광지 포토카드 마커 + 혼잡도 3D 막대
- 데스크탑: 우측 사이드바 / 모바일: 하단 Bottom Sheet (드래그 가능)

### 화면 2 — 탐색 중
- 3단계 진행 텍스트 (데이터 수집 → 혼잡도 분석 → 경로 계산)
- 최소 2.2초 로딩 보장 (서비스 가치 인식 유도)

### 화면 3 — 결과
- 경로 폴리라인 (실도로 경로, OSRM 기반)
- Plan A / B / C 탭 전환
- 혼잡도 감소율 / 평균 혼잡도 배지
- 버퍼 라우팅 알림 카드
- 장소 목록 드래그 순서 변경

---

## 기술 스택

### 프론트엔드
- **React 18 + Vite**
- **Mapbox GL JS** — 3D 지도, fill-extrusion 혼잡도 막대, pitch 50°
- **Kakao Maps JS API** — Mapbox 토큰 없을 때 자동 폴백
- **Kakao Places API** — 장소 검색 자동완성
- **OSRM** — 실도로 경로 계산

### 백엔드
- **FastAPI** (Python)
- **NetworkX** — 변형 Dijkstra 경로 최적화
- **Redis** — 혼잡도 캐시
- **KTO TatsCnctrRateService** — KT 모바일 데이터 기반 혼잡도 ML 예측 (30일치)
- **KTO areaBasedList1** — 관광지 목록/좌표

---

## 프로젝트 구조

```
hangaro/
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── App.jsx            # 전역 상태, 화면 전환
│   │   ├── pages/             # MainPage / SearchingPage / ResultPage
│   │   ├── components/map/    # MapboxView / KakaoMapView / SmartMapView
│   │   └── lib/               # api.js / routing.js
│   └── .env                   # API 키 설정
├── backend/           # FastAPI
│   └── app/
│       ├── api/routes/        # recommend / congestion / spots
│       ├── graph/             # dijkstra.py / builder.py
│       └── services/          # kto_api / congestion_service / recommender
├── README.md          # 본 문서
├── IMPLEMENTATION.md  # 기술 구현 상세
└── PIPELINE.md        # 시스템 파이프라인 정의
```

---

## 빠른 시작

### 사전 준비

| 항목 | 발급처 |
|------|--------|
| Kakao Maps JavaScript 키 | [카카오 개발자 콘솔](https://developers.kakao.com) |
| Mapbox 액세스 토큰 (선택) | [mapbox.com](https://mapbox.com) |
| KTO API 키 | [한국관광공사 TourAPI](https://api.visitkorea.or.kr) |

### 프론트엔드

```bash
cd hangaro/frontend

# .env 파일 생성
echo "VITE_KAKAO_MAP_KEY=카카오_JavaScript_키" > .env
echo "VITE_MAPBOX_TOKEN=pk.ey..."             >> .env  # 없으면 2D 카카오 지도로 폴백

npm install
npm run dev
# → http://localhost:3000
```

**Kakao 콘솔 설정:**
1. 앱 생성 → JavaScript 키 복사
2. 플랫폼 → Web → 도메인 `http://localhost:3000` 등록
3. 카카오 로그인 → 활성화 상태 ON
4. Kakao Maps (OPEN_MAP_AND_LOCAL) 서비스 활성화

### 백엔드

```bash
cd hangaro/backend

# .env 파일에 API 키 설정
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

> 백엔드 없이도 프론트엔드 단독 실행 가능 (데모 데이터 자동 폴백)

---

## 혼잡도 분류 기준

| 레벨 | 색상 | 점수 범위 | 행동 |
|------|------|---------|------|
| 한적 | 초록 `#10b981` | 0.0 – 0.3 | 추천 우선 선택 |
| 여유 | 노랑 `#f59e0b` | 0.3 – 0.5 | 추천 가능 |
| 보통 | 주황 `#f97316` | 0.5 – 0.8 | 경고 없이 포함 |
| 혼잡 | 빨강 `#ef4444` | 0.8 – 1.0 | 버퍼 라우팅 발동 |

---

## 관련 문서

- [PIPELINE.md](./PIPELINE.md) — 전체 데이터 파이프라인 및 알고리즘 흐름
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — 컴포넌트별 기술 구현 상세, 버그 수정 이력
