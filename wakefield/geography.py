from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from .models import LocationInput, Region, RegionMatch

SJSU_CAMPUS_ID = "SJSU"

# Prototype approximations for the hackathon demo; these are not authoritative
# university GIS data. Coordinates are [longitude, latitude] as required by GeoJSON.
SJSU_CAMPUS_BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[
        [-121.8890, 37.3310], [-121.8750, 37.3310],
        [-121.8750, 37.3395], [-121.8890, 37.3395],
        [-121.8890, 37.3310],
    ]],
}

PILOT_REGIONS = (
    Region("MLK_LIBRARY", SJSU_CAMPUS_ID, "MLK Library", {
        "type": "Polygon", "coordinates": [[
            [-121.8832, 37.3340], [-121.8802, 37.3340],
            [-121.8802, 37.3362], [-121.8832, 37.3362],
            [-121.8832, 37.3340],
        ]],
    }),
    Region("STUDENT_UNION", SJSU_CAMPUS_ID, "Student Union", {
        "type": "Polygon", "coordinates": [[
            [-121.8800, 37.3340], [-121.8770, 37.3340],
            [-121.8770, 37.3362], [-121.8800, 37.3362],
            [-121.8800, 37.3340],
        ]],
    }),
    Region("ENGINEERING_BUILDING", SJSU_CAMPUS_ID, "Engineering Building", {
        "type": "Polygon", "coordinates": [[
            [-121.8832, 37.3363], [-121.8798, 37.3363],
            [-121.8798, 37.3390], [-121.8832, 37.3390],
            [-121.8832, 37.3363],
        ]],
    }),
)


def _validate_point(latitude: float, longitude: float) -> None:
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("latitude/longitude are outside valid ranges")


def point_in_polygon(longitude: float, latitude: float, polygon: list[list[float]]) -> bool:
    """Ray casting with boundary inclusion for stable map-pin behavior."""
    inside = False
    for index in range(len(polygon) - 1):
        x1, y1 = polygon[index]
        x2, y2 = polygon[index + 1]
        cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1)
        if abs(cross) < 1e-12 and min(x1, x2) <= longitude <= max(x1, x2) and min(y1, y2) <= latitude <= max(y1, y2):
            return True
        if (y1 > latitude) != (y2 > latitude):
            intersection = (x2 - x1) * (latitude - y1) / (y2 - y1) + x1
            if longitude < intersection:
                inside = not inside
    return inside


def _polygon(region: dict) -> list[list[float]]:
    return region["coordinates"][0]


def locate_region(input: LocationInput, regions: Iterable[Region] = PILOT_REGIONS) -> RegionMatch:
    _validate_point(input.latitude, input.longitude)
    if not point_in_polygon(input.longitude, input.latitude, _polygon(SJSU_CAMPUS_BOUNDARY)):
        return RegionMatch(False, None, None, input.source, "outside_sjsu_pilot_boundary")
    for region in regions:
        if point_in_polygon(input.longitude, input.latitude, _polygon(region.boundary)):
            return RegionMatch(True, region.id, region.name, input.source)
    return RegionMatch(True, None, None, input.source, "inside_campus_outside_supported_pilot_regions")


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius = 6_371_000.0
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi, d_lambda = radians(lat2 - lat1), radians(lon2 - lon1)
    value = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return earth_radius * 2 * asin(sqrt(value))

