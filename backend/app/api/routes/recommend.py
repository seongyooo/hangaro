from datetime import datetime
from fastapi import APIRouter

from app.schemas.spot import RouteRequest, RouteResponse
from app.services.recommender import recommend_free, recommend_fixed_destination
from app.services.kto_api import get_area_code

router = APIRouter()


@router.post("", response_model=RouteResponse)
async def create_recommendation(req: RouteRequest):
    dt = datetime.fromisoformat(f"{req.date}T{req.start_time}")
    region_code = get_area_code(req.region)   # area_codes.json 기반 정확한 코드 사용

    if req.destination_id:
        return await recommend_fixed_destination(region_code, req.destination_id, dt, req.n_stops)
    return await recommend_free(region_code, dt, req.n_stops)
