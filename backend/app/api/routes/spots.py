from fastapi import APIRouter, Query

from app.services.kto_api import get_spots_by_location, search_keyword, get_detail_common, get_area_code

router = APIRouter()


@router.get("/nearby")
async def nearby_spots(lat: float, lng: float, radius: int = Query(default=3000, le=5000)):
    return await get_spots_by_location(lat, lng, radius)


@router.get("/search")
async def search_spots(keyword: str, region: str = ""):
    area_code = get_area_code(region) if region else ""
    return await search_keyword(keyword, area_code)


@router.get("/detail/{content_id}")
async def spot_detail(content_id: str):
    """detailCommon — 운영시간, 입장료, 주소, 개요 등 상세 정보"""
    return await get_detail_common(content_id)
