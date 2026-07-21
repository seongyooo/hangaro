# HanGaRo 구현 현황

> 2026 한국관광데이터 활용 공모전 — 지정과제 2번  
> 최종 업데이트: 2026-07-21

---

## 서비스 개요

**한가로(HanGaRo)** — 실시간 관광지 혼잡도 기반 여행 코스 추천 서비스  
네트워크 트래픽 분산 알고리즘(변형 Dijkstra)을 관광에 적용, 인파를 피한 최적 경로 제안

| 항목 | 내용 |
|---|---|
| 스택 | React + Vite + Kakao Maps JS API (프론트) / FastAPI + NetworkX (백엔드) |
| 데이터 | 한국관광공사 TatsCnctrRateService (KT 모바일 혼잡도 ML 예측) |
| 포트 | Frontend: 3000 / Backend: 8000 |

---

## 완료된 구현

### 1. 프론트엔드 (React + Vite)

#### 앱 구조
- 단일 페이지 앱 (React Router 없음, screen 상태로 화면 전환)
- 3개 화면: MainPage(1) → SearchingPage(2) → ResultPage(3)
- 라이트/다크 모드 지원 (토글 버튼)
- 반응형: 모바일(하단 시트) / 데스크탑(사이드바) 자동 전환 (768px 기준)

#### 화면 1 — MainPage (메인 지도)
- 카카오 지도 실제 연동 (서울 경복궁 인근 중심)
- 관광지 혼잡도 펄스 노드 (CustomOverlay + CSS 애니메이션)
- 현재 위치 파란 점 + ripple 애니메이션 (Geolocation API)
- 노드 클릭 시 툴팁 (장소명 + 혼잡도 레이블)
- **데스크탑**: 오른쪽 사이드바 (380px)
- **모바일**: 하단 Bottom Sheet (드래그로 peek/half/full 스냅)
- 교통수단 탭: Walk / Transit / Car (SVG 아이콘)
- 목적지 입력 + 경유지 추가/삭제
- CTA: 목적지 있으면 "Find Route", 없으면 "Recommend Quiet Places"

#### 화면 2 — SearchingPage (경로 탐색 로딩)
- 최소 2.2초 로딩 보장
- 3단계 텍스트: 데이터 수집 → 혼잡도 분석 → 경로 계산
- 노드 순차 활성화 (Dijkstra 시각화)
- 프로그레스 바 + 스피너
- 카카오 지도 연동 / 키 없으면 CSS 플레이스홀더 폴백

#### 화면 3 — ResultPage (결과)
- **데스크탑**: 지도(좌) + 사이드바(우 380px), 사이드바 토글 버튼으로 지도 전체화면 전환
- **모바일**: 지도 + 드래그 핸들로 높이 조절
- Plan A / B / C 탭 (혼잡도 최소 / 최단 거리 / 숨은 명소)
- 탭별 경로 색상 변경 (초록/파랑/보라)
- 카카오 지도에 경로 Polyline 표시
- 요약 배지: 혼잡도 감소율, 평균 혼잡도
- 버퍼 라우팅 경보 카드 (Plan A, 경복궁 혼잡 시)
- 경유지 카드: 번호 → 장소명 → 혼잡도 배지 → 드래그 핸들(순서 변경)
- 경유지 간 연결선: Walk/Transit SVG 아이콘 + 소요 시간

#### 컴포넌트
| 파일 | 설명 |
|---|---|
| `components/map/KakaoMapView.jsx` | 카카오 지도 래퍼 (노드 오버레이, 폴리라인, 현재 위치) |
| `components/map/MapCanvas.jsx` | CSS 플레이스홀더 지도 (키 없을 때 폴백) |
| `components/ui/CongestionBadge.jsx` | 혼잡도 배지 (컬러 dot + 레이블) |
| `components/ui/Icons.jsx` | SVG 아이콘 모음 (Walk, Transit, Car, Pin 등) |

#### 혼잡도 색상 시스템
| 레벨 | 기준 | 색상 |
|---|---|---|
| Quiet | 0~30% | `#16a34a` (초록) |
| Relaxed | 30~50% | `#ca8a04` (노랑) |
| Moderate | 50~80% | `#ea580c` (주황) |
| Crowded | 80~100% | `#dc2626` (빨강) |

#### 관광지 데이터 (IDLE_NODES)
| ID | 장소 | 위도 | 경도 | 혼잡도 |
|---|---|---|---|---|
| gb | 경복궁 | 37.5796 | 126.9770 | Crowded |
| bc | 북촌한옥마을 | 37.5826 | 126.9830 | Moderate |
| is | 인사동 | 37.5740 | 126.9858 | Moderate |
| cd | 창덕궁 | 37.5794 | 126.9910 | Quiet |
| np | 낙산공원 | 37.5804 | 127.0072 | Quiet |
| im | 이화동 | 37.5773 | 127.0070 | Relaxed |

---

### 2. 백엔드 (FastAPI — 구조 설계 완료, 미연동)

#### 파일 구조
```
backend/
├── app/
│   ├── main.py                  # FastAPI 앱 진입점
│   ├── core/
│   │   ├── config.py            # 환경변수 설정 (Settings)
│   │   └── database.py          # DB 연결
│   ├── api/routes/
│   │   ├── congestion.py        # 혼잡도 조회 API
│   │   ├── recommend.py         # 경로 추천 API
│   │   └── spots.py             # 관광지 정보 API
│   ├── graph/
│   │   ├── dijkstra.py          # 변형 Dijkstra 알고리즘
│   │   ├── builder.py           # 그래프 구성
│   │   └── congestion.py        # 혼잡도 그래프 처리
│   ├── services/
│   │   ├── kto_api.py           # 한국관광공사 API 클라이언트
│   │   ├── congestion_service.py # 혼잡도 조회 (Redis 캐시 → KT API → 정적 패턴)
│   │   └── recommender.py       # 경로 추천 서비스
│   ├── models/spot.py           # DB 모델
│   └── schemas/spot.py          # Pydantic 스키마
└── requirements.txt
```

#### 핵심 알고리즘
- **변형 Dijkstra**: `link_cost = travel_time × (1 + congestion × PENALTY_WEIGHT) - gem_bonus`
- **고정 목적지 버퍼 라우팅**: 목적지가 혼잡해도 우회 노드를 거쳐 방문 유도
- **Plan A**: 혼잡도 최소 경로
- **Plan B**: 최단 거리 경로
- **Plan C**: 숨은 명소 포함 경로 (gem_bonus 적용)

#### 데이터 소스
| 소스 | 용도 | 상태 |
|---|---|---|
| TatsCnctrRateService | 관광지 집중률 30일 예측 (KT ML) | API 키 발급 완료 |
| KorService1 | 관광지 기본 정보 | API 키 발급 완료 |
| area_codes.json | 지역코드 252개 (엑셀 파싱) | 완료 |
| congestion_patterns.json | 정적 시간대별 패턴 (폴백용) | 완료 |

---

## 미완료 / 다음 단계

### 우선순위 높음
- [ ] 카카오 장소 검색 API 연동 (목적지 자동완성)
- [ ] 백엔드 FastAPI 서버 실행 및 프론트 연결
- [ ] TatsCnctrRateService 실제 데이터로 혼잡도 표시

### 우선순위 중간
- [ ] 카카오 지도 장소 검색 (services 라이브러리)
- [ ] 경로 탐색 결과를 실제 관광지 데이터로 교체
- [ ] 버퍼 라우팅 실제 알고리즘 연결

### 우선순위 낮음
- [ ] Three.js 3D 혼잡도 시각화 (zoom ≥ 14)
- [ ] Canvas 2D 파티클 플로우 애니메이션
- [ ] 저장 / 카카오톡 공유 기능

---

## 환경 설정

### 프론트엔드 실행
```bash
cd hangaro/frontend
# .env 파일에 키 설정 필요
# VITE_KAKAO_MAP_KEY=JavaScript키

npm install
npm run dev
# → http://localhost:3000
```

### 카카오 지도 설정 체크리스트
- [x] 카카오 개발자 콘솔 앱 생성
- [x] JavaScript 키 발급
- [x] Web 플랫폼 도메인 등록 (`http://localhost:3000`)
- [x] 카카오 지도 서비스 활성화 (OPEN_MAP_AND_LOCAL)
- [x] `.env` 파일에 `VITE_KAKAO_MAP_KEY` 설정

### 백엔드 실행 (미연동)
```bash
cd hangaro/backend
pip install -r requirements.txt
# .env 파일에 KTO_API_KEY 등 설정
uvicorn app.main:app --reload --port 8000
```
