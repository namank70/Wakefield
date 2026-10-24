from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

Severity = Literal["low", "medium", "high", "urgent"]
IssueStatus = Literal["open", "in_progress", "awaiting_verification", "resolved", "closed"]
LocationSource = Literal["device_gps", "student_confirmed_pin"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class LocationInput:
    latitude: float
    longitude: float
    source: LocationSource = "device_gps"


@dataclass(frozen=True)
class RegionMatch:
    within_campus: bool
    region_id: str | None
    region_name: str | None
    location_source: LocationSource
    reason: str | None = None


@dataclass
class Region:
    id: str
    campus_id: str
    name: str
    boundary: dict[str, Any]
    activation_threshold: int = 5
    baseline_activation_score: int = 0
    active: bool = False
    ever_activated: bool = False
    health: int = 100
    activation_history: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Report:
    id: str
    issue_id: str
    reporter_id: str
    image_ref: str | None = None
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class Issue:
    id: str
    region_id: str
    category: str
    severity: Severity
    accessibility_impact: bool
    critical_route_service: bool
    created_at: datetime = field(default_factory=utc_now)
    status: IssueStatus = "open"
    independent_report_count: int = 1
    reports: list[Report] = field(default_factory=list)
    applied_damage: int | None = None
    source: str = "live"
    description: str = ""
    latitude: float | None = None
    longitude: float | None = None


@dataclass(frozen=True)
class DuplicateInput:
    category: str
    latitude: float
    longitude: float
    now: datetime | None = None


@dataclass(frozen=True)
class DuplicateSuggestion:
    existing_issue_id: str
    distance_meters: float
    category: str
    requires_confirmation: bool = True


@dataclass(frozen=True)
class ActivationResult:
    region_id: str
    activation_score: int
    threshold: int
    active: bool
    recovered: bool
    activation_reasons: tuple[str, ...]


@dataclass(frozen=True)
class ImpactResult:
    issue_id: str
    priority_score: int
    breakdown: dict[str, int]


@dataclass(frozen=True)
class HealthResult:
    region_id: str
    health: int
    issue_id: str
    applied_damage: int
