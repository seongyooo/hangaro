"""
관광지 데이터 → NetworkX 그래프 변환
"""
import networkx as nx
from geopy.distance import geodesic

MAX_EDGE_KM = 3.0        # 엣지 생성 최대 거리
WALKING_SPEED_KPH = 4.0  # 도보 속도
PENALTY_WEIGHT = 2.0      # 혼잡도 패널티 강도


def build_graph(spots: list[dict]) -> nx.DiGraph:
    """
    spots: [{'id', 'name', 'lat', 'lng', 'category',
              'congestion', 'hidden_gem_score', 'visit_duration'}, ...]
    """
    G = nx.DiGraph()

    for s in spots:
        G.add_node(
            s["id"],
            name=s["name"],
            lat=s["lat"],
            lng=s["lng"],
            category=s["category"],
            congestion=s["congestion"],
            hidden_gem_score=s["hidden_gem_score"],
            visit_duration=s.get("visit_duration", 60),
        )

    ids = list(G.nodes)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            na, nb = G.nodes[a], G.nodes[b]
            dist_km = geodesic((na["lat"], na["lng"]), (nb["lat"], nb["lng"])).km
            if dist_km > MAX_EDGE_KM:
                continue

            travel_min = (dist_km / WALKING_SPEED_KPH) * 60
            for src, dst in [(a, b), (b, a)]:
                dst_node = G.nodes[dst]
                link_cost = travel_min * (1 + dst_node["congestion"] * PENALTY_WEIGHT)
                G.add_edge(src, dst,
                           distance_km=dist_km,
                           travel_min=travel_min,
                           link_cost=link_cost)
    return G
