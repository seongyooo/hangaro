"""
숨은 명소 스코어 계산
"""


def hidden_gem_score(rating: float, congestion_avg: float, popularity_rank: int, total_spots: int) -> float:
    """
    잘 알려지지 않고(낮은 인기 순위), 만족도 높고, 평소 한적한 장소
    """
    rank_score = 1 - (popularity_rank / max(total_spots, 1))
    score = (
        rating / 5.0 * 0.4
        + (1 - congestion_avg) * 0.3
        + rank_score * 0.3
    )
    return round(max(0.0, min(1.0, score)), 3)


def find_buffer_nodes(
    G,
    destination: str,
    buffer_duration_min: int,
    max_distance_km: float = 2.0,
    congestion_threshold: float = 0.4,
) -> list[str]:
    """
    목적지 근처에서 체류 시간이 buffer_duration_min에 가깝고
    혼잡도가 낮은 노드를 버퍼 후보로 반환
    """
    from geopy.distance import geodesic

    dest = G.nodes[destination]
    candidates = []

    for node_id, data in G.nodes(data=True):
        if node_id == destination:
            continue
        dist_km = geodesic(
            (dest["lat"], dest["lng"]),
            (data["lat"], data["lng"])
        ).km
        if dist_km > max_distance_km:
            continue
        if data["congestion"] > congestion_threshold:
            continue

        duration_match = abs(data.get("visit_duration", 60) - buffer_duration_min)
        score = data["hidden_gem_score"] - duration_match / 120
        candidates.append((score, node_id))

    candidates.sort(reverse=True)
    return [node_id for _, node_id in candidates[:3]]
