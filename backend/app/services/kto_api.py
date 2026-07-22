import json
from pathlib import Path

import httpx
from app.core.config import settings

BASE = settings.KTO_BASE_URL
KEY  = settings.KTO_API_KEY
COMMON = {
    "MobileOS": "ETC",
    "MobileApp": "HanGaRo",
    "_type": "json",
    "serviceKey": KEY,
}

# 지역/시군구 코드 테이블 (엑셀 원본 → area_codes.json 변환본)
_AREA_CODES: list[dict] = json.loads(
    (Path(__file__).parent.parent.parent.parent / "data" / "area_codes.json").read_text(encoding="utf-8")
)

# 지역명 → (areaCd, sigunguCd 목록) 빠른 조회용 인덱스
_AREA_INDEX: dict[str, dict] = {}
for _row in _AREA_CODES:
    _key = _row["areaNm"]
    if _key not in _AREA_INDEX:
        _AREA_INDEX[_key] = {"areaCd": _row["areaCd"], "sigunguList": []}
    _AREA_INDEX[_key]["sigunguList"].append({
        "sigunguCd": _row["sigunguCd"],
        "sigunguNm": _row["sigunguNm"],
    })

# 시군구명 → (areaCd, sigunguCd) 단건 조회용
_SIGUNGU_INDEX: dict[str, dict] = {
    _row["sigunguNm"]: {"areaCd": _row["areaCd"], "sigunguCd": _row["sigunguCd"]}
    for _row in _AREA_CODES
}


def get_area_code(region_name: str) -> str:
    """'서울' → '11', '부산' → '26' 등 부분 일치 검색"""
    for area_nm, info in _AREA_INDEX.items():
        if region_name in area_nm:
            return info["areaCd"]
    return "11"  # 기본값: 서울


def get_sigungu_codes(region_name: str) -> list[dict]:
    """지역명으로 해당 시군구 전체 목록 반환"""
    for area_nm, info in _AREA_INDEX.items():
        if region_name in area_nm:
            return info["sigunguList"]
    return []


def find_sigungu(sigungu_name: str) -> dict | None:
    """시군구명으로 areaCd + sigunguCd 반환 (예: '종로구' → {'areaCd': '11', 'sigunguCd': '11110'})"""
    return _SIGUNGU_INDEX.get(sigungu_name)


async def get_spots_by_area(area_code: str, content_type_id: int = 12) -> list[dict]:
    """areaBasedList — 지역 기반 관광지 목록"""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE}/areaBasedList1",
            params={**COMMON, "numOfRows": 100, "pageNo": 1,
                    "areaCode": area_code, "contentTypeId": content_type_id},
        )
        r.raise_for_status()
        items = r.json()["response"]["body"]["items"]["item"]
        return items if isinstance(items, list) else [items]


async def get_spots_by_location(lat: float, lng: float, radius: int = 3000) -> list[dict]:
    """locationBasedList — 현재 위치 기반 주변 관광지"""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE}/locationBasedList1",
            params={**COMMON, "numOfRows": 50, "pageNo": 1,
                    "mapX": lng, "mapY": lat, "radius": radius},
        )
        r.raise_for_status()
        items = r.json()["response"]["body"]["items"]["item"]
        return items if isinstance(items, list) else [items]


async def get_detail_common(content_id: str) -> dict:
    """detailCommon — 운영시간, 입장료 등 공통 정보"""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE}/detailCommon1",
            params={**COMMON, "contentId": content_id,
                    "defaultYN": "Y", "addrinfoYN": "Y", "overviewYN": "Y"},
        )
        r.raise_for_status()
        return r.json()["response"]["body"]["items"]["item"][0]


async def search_keyword(keyword: str, area_code: str = "") -> list[dict]:
    """searchKeyword — 키워드 검색"""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE}/searchKeyword1",
            params={**COMMON, "numOfRows": 20, "pageNo": 1,
                    "keyword": keyword, "areaCode": area_code},
        )
        r.raise_for_status()
        items = r.json()["response"]["body"]["items"]["item"]
        return items if isinstance(items, list) else [items]


async def get_concentration_rate(
    area_cd: str,
    sigungu_cd: str,
    tats_nm: str = "",
    num_of_rows: int = 30,
) -> list[dict]:
    """
    TatsCnctrRateService — 향후 30일 관광지 집중률 예측 (KT 이동통신 기반, ML 추정)

    응답 항목:
        baseYmd   : 예측 기준일 (YYYYMMDD)
        areaCd    : 지역 코드
        areaNm    : 지역명
        signguCd  : 시군구 코드
        signguNm  : 시군구명
        tAtsNm    : 관광지명
        cnctrRate : 집중률 0~100 (100 = 연중 최대 혼잡)

    사용 예:
        items = await get_concentration_rate("11", "11110", "경복궁")
        # → [{baseYmd: "20260721", cnctrRate: 87.3}, ...]
        congestion = items[0]["cnctrRate"] / 100   # 0.0~1.0 정규화
    """
    async with httpx.AsyncClient() as client:
        params = {
            **COMMON,
            "numOfRows": num_of_rows,
            "pageNo": 1,
            "areaCd": area_cd,
            "signguCd": sigungu_cd,
        }
        if tats_nm:
            params["tAtsNm"] = tats_nm

        r = await client.get(
            f"{settings.TATS_BASE_URL}/tatsCnctrRatedList",
            params=params,
        )
        r.raise_for_status()

        body = r.json()["response"]["body"]
        if body.get("totalCount", 0) == 0:
            return []
        items = body["items"]["item"]
        return items if isinstance(items, list) else [items]
