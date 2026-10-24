from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Callable

from .geography import haversine_meters, locate_region
from .models import (
    ActivationResult, DuplicateInput, DuplicateSuggestion, HealthResult,
    ImpactResult, Issue, LocationInput, RegionMatch, Report, utc_now,
)
from .repository import InMemoryWakefieldRepository

SEVERITY_SCORE = {"low": 8, "medium": 18, "high": 30, "urgent": 40}
DAMAGE = {"low": 5, "medium": 15, "high": 30, "urgent": 50}
UNRESOLVED_STATUSES = {"open", "in_progress", "awaiting_verification"}


class WakefieldIntelligence(ABC):
    @abstractmethod
    async def locateRegion(self, input: LocationInput) -> RegionMatch: ...
    @abstractmethod
    async def suggestDuplicate(self, input: DuplicateInput) -> DuplicateSuggestion | None: ...
    @abstractmethod
    async def calculateActivation(self, regionId: str) -> ActivationResult: ...
    @abstractmethod
    async def calculateImpact(self, issueId: str) -> ImpactResult: ...
    @abstractmethod
    async def applyIssueDamage(self, issueId: str) -> HealthResult: ...
    @abstractmethod
    async def applyVerifiedHeal(self, issueId: str) -> HealthResult: ...


class WakefieldService(WakefieldIntelligence):
    def __init__(self, repository: InMemoryWakefieldRepository | None = None, clock: Callable[[], datetime] = utc_now) -> None:
        self.repository = repository or InMemoryWakefieldRepository()
        self.clock = clock
        self.activation_time_threshold_hours = 24

    async def locateRegion(self, input: LocationInput) -> RegionMatch:
        return locate_region(input, self.repository.regions.values())

    async def suggestDuplicate(self, input: DuplicateInput) -> DuplicateSuggestion | None:
        if not (-90 <= input.latitude <= 90 and -180 <= input.longitude <= 180):
            raise ValueError("latitude/longitude are outside valid ranges")
        now = input.now or self.clock()
        candidates: list[tuple[float, Issue]] = []
        for issue in self.repository.issues.values():
            if issue.category != input.category or issue.status not in UNRESOLVED_STATUSES:
                continue
            # The contract is strictly younger than 24 hours; exactly 24 hours is stale.
            if not issue.reports or now - issue.created_at >= timedelta(hours=24):
                continue
            report_location = getattr(issue, "latitude", None), getattr(issue, "longitude", None)
            if report_location[0] is None or report_location[1] is None:
                continue
            distance = haversine_meters(input.latitude, input.longitude, report_location[0], report_location[1])
            if distance <= 30:
                candidates.append((distance, issue))
        if not candidates:
            return None
        distance, issue = min(candidates, key=lambda item: (item[0], item[1].id))
        return DuplicateSuggestion(issue.id, round(distance, 1), issue.category)

    async def calculateActivation(self, regionId: str) -> ActivationResult:
        region = self.repository.get_region(regionId)
        issues = [i for i in self.repository.issues.values() if i.region_id == regionId and i.status in UNRESOLVED_STATUSES]
        score = region.baseline_activation_score
        reasons: list[str] = []
        if region.baseline_activation_score:
            reasons.append(f"demo_baseline:+{region.baseline_activation_score}")
        for issue in sorted(issues, key=lambda item: item.id):
            score += {"low": 1, "medium": 2, "high": 3, "urgent": 0}[issue.severity]
            reasons.append(f"{issue.id}:severity:+{ { 'low': 1, 'medium': 2, 'high': 3, 'urgent': 0 }[issue.severity]}")
            if issue.severity == "urgent":
                reasons.append(f"{issue.id}:urgent_immediate_activation")
            if issue.accessibility_impact:
                score += 2
                reasons.append(f"{issue.id}:accessibility:+2")
            if self.clock() - issue.created_at >= timedelta(hours=self.activation_time_threshold_hours):
                score += 1
                reasons.append(f"{issue.id}:unresolved_time:+1")
            bonus = min(max(issue.independent_report_count - 1, 0), 3)
            if bonus:
                score += bonus
                reasons.append(f"{issue.id}:corroboration:+{bonus}")
        active = score >= region.activation_threshold or any(i.severity == "urgent" for i in issues)
        if active:
            region.ever_activated = True
        region.active = active
        recovered = region.ever_activated and not active and bool(region.activation_history)
        region.activation_history.append({"at": self.clock(), "score": score, "active": active})
        return ActivationResult(regionId, score, region.activation_threshold, active, recovered, tuple(reasons))

    async def calculateImpact(self, issueId: str) -> ImpactResult:
        issue = self.repository.get_issue(issueId)
        if issue.severity not in SEVERITY_SCORE:
            raise ValueError(f"invalid severity: {issue.severity}")
        unresolved_hours = max((self.clock() - issue.created_at).total_seconds() / 3600, 0)
        breakdown = {
            "severity": SEVERITY_SCORE[issue.severity],
            "reports": min(issue.independent_report_count * 4, 20),
            "accessibility": 15 if issue.accessibility_impact else 0,
            "unresolved_time": min(int(unresolved_hours // 6) * 3, 15) if issue.status in UNRESOLVED_STATUSES else 0,
            "critical_route": 10 if issue.critical_route_service else 0,
        }
        return ImpactResult(issueId, min(max(sum(breakdown.values()), 0), 100), breakdown)

    def _recalculate_health(self, region_id: str) -> int:
        region = self.repository.get_region(region_id)
        damage = sum((i.applied_damage or 0) for i in self.repository.issues.values() if i.region_id == region_id and i.status in UNRESOLVED_STATUSES)
        region.health = max(0, 100 - damage)
        return region.health

    async def applyIssueDamage(self, issueId: str) -> HealthResult:
        issue = self.repository.get_issue(issueId)
        if issue.applied_damage is None:
            issue.applied_damage = DAMAGE[issue.severity]
        health = self._recalculate_health(issue.region_id)
        return HealthResult(issue.region_id, health, issue.id, issue.applied_damage)

    async def applyVerifiedHeal(self, issueId: str) -> HealthResult:
        issue = self.repository.get_issue(issueId)
        if issue.status == "awaiting_verification":
            issue.status = "resolved"
        elif issue.status not in {"resolved", "closed"}:
            raise ValueError("issue must be awaiting_verification before verification")
        health = self._recalculate_health(issue.region_id)
        await self.calculateActivation(issue.region_id)
        if not any(event["issue_id"] == issue.id for event in self.repository.recovery_events):
            self.repository.recovery_events.append({"issue_id": issue.id, "region_id": issue.region_id, "event": "repair_verified"})
            self._award_credit(f"verify:{issue.id}", "verify_repair", 15)
            self._award_credit(f"resolved:{issue.id}", "report_resolved", 5)
        return HealthResult(issue.region_id, health, issue.id, issue.applied_damage or 0)

    async def verify_repair(self, issue_id: str, successful: bool) -> Issue:
        issue = self.repository.get_issue(issue_id)
        if issue.status != "awaiting_verification":
            raise ValueError("issue must be awaiting_verification before verification")
        if successful:
            await self.applyVerifiedHeal(issue_id)
        else:
            issue.status = "open"
            await self.calculateActivation(issue.region_id)
            self._award_credit(f"incomplete:{issue.id}", "confirm_incomplete_repair", 10)
        return issue

    def _award_credit(self, key: str, reason: str, amount: int) -> None:
        if not any(item["key"] == key for item in self.repository.credits):
            self.repository.credits.append({"key": key, "reason": reason, "amount": amount})

    async def create_issue(self, issue: Issue, latitude: float, longitude: float, reporter_id: str, image_ref: str | None = None) -> Issue:
        if issue.category.strip() == "":
            raise ValueError("category is required")
        if issue.severity not in DAMAGE:
            raise ValueError(f"invalid severity: {issue.severity}")
        issue.latitude, issue.longitude = latitude, longitude
        report = Report(f"REPORT-{issue.id}-1", issue.id, reporter_id, image_ref, self.clock())
        issue.reports.append(report)
        self.repository.issues[issue.id] = issue
        self.repository.reports[report.id] = report
        self._award_credit(f"report:{issue.id}", "first_valid_report", 10)
        await self.applyIssueDamage(issue.id)
        await self.calculateActivation(issue.region_id)
        return issue

    async def confirm_duplicate(self, existing_issue_id: str, reporter_id: str, image_ref: str | None = None) -> Issue:
        issue = self.repository.get_issue(existing_issue_id)
        distinct = reporter_id not in {r.reporter_id for r in issue.reports}
        if distinct:
            issue.independent_report_count += 1
        report = Report(f"REPORT-{issue.id}-{len(issue.reports) + 1}", issue.id, reporter_id, image_ref, self.clock())
        issue.reports.append(report)
        self.repository.reports[report.id] = report
        self._award_credit(f"confirm:{issue.id}:{reporter_id}", "confirm_existing_issue", 2)
        await self.calculateActivation(issue.region_id)
        return issue

    async def mark_fixed(self, issue_id: str) -> Issue:
        issue = self.repository.get_issue(issue_id)
        if issue.status in {"resolved", "closed"}:
            return issue
        issue.status = "awaiting_verification"
        await self.calculateActivation(issue.region_id)
        return issue

    async def map_state(self) -> dict:
        regions = []
        for region in self.repository.regions.values():
            issues = [i for i in self.repository.issues.values() if i.region_id == region.id]
            activation = await self.calculateActivation(region.id)
            regions.append({"id": region.id, "name": region.name, "activation_score": activation.activation_score, "active": activation.active, "recovered": activation.recovered, "health": self._recalculate_health(region.id), "open_issue_count": sum(i.status in UNRESOLVED_STATUSES for i in issues), "urgent_issue_count": sum(i.status in UNRESOLVED_STATUSES and i.severity == "urgent" for i in issues)})
        return {"campus_id": "SJSU", "regions": regions}
