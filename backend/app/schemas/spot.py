from pydantic import BaseModel


class SpotBase(BaseModel):
    id: str
    name: str
    category: str
    lat: float
    lng: float
    thumbnail_url: str | None = None
    rating: float = 0.0
    visit_duration: int = 60


class SpotWithCongestion(SpotBase):
    congestion: float          # 0.0 ~ 1.0
    hidden_gem_score: float    # 0.0 ~ 1.0
    congestion_label: str      # 한적 / 여유 / 보통 / 혼잡


class RouteRequest(BaseModel):
    region: str                # 서울 / 부산 / 경주 / 제주
    date: str                  # YYYY-MM-DD
    start_time: str            # HH:MM
    style: str                 # culture / nature / food / activity
    transport: str             # walk / bus / car
    n_stops: int = 5
    destination_id: str | None = None   # 목적지 고정 라우팅 시 사용


class RouteResponse(BaseModel):
    spots: list[SpotWithCongestion]
    total_congestion_avg: float
    congestion_reduction_pct: float    # 유명 코스 대비 절감율
    message: str | None = None         # 버퍼 라우팅 안내 메시지
