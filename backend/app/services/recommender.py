"""
코스 추천 서비스 — 자유 탐색 + 목적지 고정 라우팅
"""
from datetime import datetime

from app.graph.builder import build_graph
from app.graph.dijkstra import modified_dijkstra, fixed_destination_route
from app.graph.congestion import find_buffer_nodes
from app.services.congestion_service import (
    get_congestion, get_congestion_label, predict_clear_time
)
from app.schemas.spot import SpotWithCongestion, RouteResponse
from app.services.kto_api import get_spots_by_area

CONGESTION_THRESHOLD = 0.7   # 목적지 고정 라우팅 발동 기준


async def recommend_free(
    region_code: str,
    dt: datetime,
    n_stops: int = 5,
) -> RouteResponse:
    """자유 탐색 코스 추천"""
    raw_spots = await get_spots_by_area(region_code)
    spots = await _enrich_spots(raw_spots, dt)
    G = build_graph(spots)

    start = spots[0]["id"]
    course_ids = modified_dijkstra(G, start, n_stops)

    return _build_response(spots, course_ids, G)


async def recommend_fixed_destination(
    region_code: str,
    destination_id: str,
    dt: datetime,
    n_stops: int = 5,
) -> RouteResponse:
    """목적지 고정 우회 라우팅"""
    raw_spots = await get_spots_by_area(region_code)
    spots = await _enrich_spots(raw_spots, dt)
    G = build_graph(spots)

    dest_data = next((s for s in spots if s["id"] == destination_id), None)
    if not dest_data:
        raise ValueError(f"destination {destination_id} not found")

    message = None
    if dest_data["congestion"] > CONGESTION_THRESHOLD:
        clear_dt = await predict_clear_time(region_code, "", dest_data["name"], dest_data["category"], dt)
        buffer_min = int((clear_dt - dt).total_seconds() / 60)
        buffer_nodes = find_buffer_nodes(G, destination_id, buffer_min)

        start = spots[0]["id"]
        course_ids = fixed_destination_route(G, start, destination_id, buffer_nodes)
        message = (
            f"{dest_data['name']}은 현재 매우 혼잡합니다. "
            f"약 {buffer_min}분 후 도착 시 혼잡도가 크게 감소할 예정입니다. "
            f"근처 숨은 명소를 먼저 들러보는 코스를 추천드립니다."
        )
    else:
        start = spots[0]["id"]
        course_ids = modified_dijkstra(G, start, n_stops)

    return _build_response(spots, course_ids, G, message)


async def _enrich_spots(raw_spots: list[dict], dt: datetime) -> list[dict]:
    spots = []
    for i, raw in enumerate(raw_spots):
        category = _map_category(raw.get("contenttypeid", "12"))
        congestion = await get_congestion(raw["contentid"], category, dt)
        from app.graph.congestion import hidden_gem_score
        gem = hidden_gem_score(
            rating=float(raw.get("rating", 3.5)),
            congestion_avg=congestion,
            popularity_rank=i,
            total_spots=len(raw_spots),
        )
        spots.append({
            "id": raw["contentid"],
            "name": raw["title"],
            "category": category,
            "lat": float(raw["mapy"]),
            "lng": float(raw["mapx"]),
            "thumbnail_url": raw.get("firstimage", ""),
            "rating": float(raw.get("rating", 3.5)),
            "visit_duration": 60,
            "congestion": congestion,
            "hidden_gem_score": gem,
        })
    return spots


def _map_category(content_type_id: str) -> str:
    return {
        "12": "attraction", "14": "museum",
        "15": "festival",   "28": "activity",
        "32": "accommodation", "38": "shopping",
        "39": "restaurant",
    }.get(content_type_id, "attraction")


def _build_response(spots: list[dict], course_ids: list[str], G, message=None) -> RouteResponse:
    spot_map = {s["id"]: s for s in spots}
    course_spots = [
        SpotWithCongestion(
            **spot_map[sid],
            congestion_label=get_congestion_label(spot_map[sid]["congestion"]),
        )
        for sid in course_ids if sid in spot_map
    ]

    avg_cong = sum(s.congestion for s in course_spots) / max(len(course_spots), 1)
    return RouteResponse(
        spots=course_spots,
        total_congestion_avg=round(avg_cong, 2),
        congestion_reduction_pct=round((0.87 - avg_cong) / 0.87 * 100, 1),
        message=message,
    )
