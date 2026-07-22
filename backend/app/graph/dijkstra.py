"""
변형 Dijkstra — 혼잡 회피 + 숨은 명소 우선
"""
import heapq
import networkx as nx


def modified_dijkstra(
    G: nx.DiGraph,
    start: str,
    n_stops: int = 5,
) -> list[str]:
    """혼잡도 패널티 + 숨은 명소 보너스를 반영한 최적 코스 탐색"""
    heap = [(0.0, start, [start])]
    visited: set[str] = set()

    while heap:
        cost, node, path = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)

        if len(path) == n_stops:
            return path

        for neighbor in G.neighbors(node):
            if neighbor in visited:
                continue
            edge_cost   = G[node][neighbor]["link_cost"]
            cong_pen    = G.nodes[neighbor]["congestion"] * 10
            gem_bonus   = G.nodes[neighbor]["hidden_gem_score"] * 3
            new_cost    = cost + edge_cost + cong_pen - gem_bonus
            heapq.heappush(heap, (new_cost, neighbor, path + [neighbor]))

    return path  # n_stops 미만인 경우 부분 결과 반환


def shortest_route(
    G: nx.DiGraph,
    start: str,
    n_stops: int = 5,
) -> list[str]:
    """Plan B — 이동시간 최소 (혼잡도 패널티 없음, travel_min 기준)"""
    heap = [(0.0, start, [start])]
    visited: set[str] = set()
    path = [start]

    while heap:
        cost, node, path = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)

        if len(path) == n_stops:
            return path

        for neighbor in G.neighbors(node):
            if neighbor in visited:
                continue
            edge_cost = G[node][neighbor]["travel_min"]
            heapq.heappush(heap, (cost + edge_cost, neighbor, path + [neighbor]))

    return path


def gem_priority_route(
    G: nx.DiGraph,
    start: str,
    n_stops: int = 5,
) -> list[str]:
    """Plan C — hidden_gem_score 높은 순 greedy 선택 (숨은 명소 우선)"""
    candidates = sorted(
        [n for n in G.nodes if n != start],
        key=lambda n: G.nodes[n]["hidden_gem_score"],
        reverse=True,
    )
    return [start] + candidates[:n_stops - 1]


def fixed_destination_route(
    G: nx.DiGraph,
    start: str,
    destination: str,
    buffer_nodes: list[str],
) -> list[str]:
    """
    목적지 고정 우회 라우팅.
    buffer_nodes: 시간 버퍼 역할을 할 경유지 후보 (혼잡도 낮음 + 목적지 근처)
    → start → buffer_nodes → destination 순서로 최적 경유 경로 반환
    """
    if not buffer_nodes:
        return [start, destination]

    # 버퍼 노드들을 경유하는 최단 경로 탐색
    best_cost = float("inf")
    best_path = [start, destination]

    # 간단 구현: 버퍼 노드 1개 경유 (추후 조합 확장)
    for buf in buffer_nodes:
        if buf not in G or start not in G or destination not in G:
            continue
        try:
            seg1 = nx.dijkstra_path(G, start, buf, weight="link_cost")
            seg2 = nx.dijkstra_path(G, buf, destination, weight="link_cost")
            path = seg1 + seg2[1:]
            cost = (nx.dijkstra_path_length(G, start, buf, weight="link_cost") +
                    nx.dijkstra_path_length(G, buf, destination, weight="link_cost"))
            if cost < best_cost:
                best_cost = cost
                best_path = path
        except nx.NetworkXNoPath:
            continue

    return best_path
