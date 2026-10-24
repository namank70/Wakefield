from __future__ import annotations

from copy import deepcopy

from .geography import PILOT_REGIONS
from .models import Issue, Region, Report


class InMemoryWakefieldRepository:
    """Deterministic adapter used by tests and the offline demo.

    A production adapter can implement the same small surface over the team's DB.
    """

    def __init__(self) -> None:
        self.reset_demo()

    def reset_demo(self) -> None:
        self.regions: dict[str, Region] = {r.id: deepcopy(r) for r in PILOT_REGIONS}
        self.issues: dict[str, Issue] = {}
        self.reports: dict[str, Report] = {}
        self.credits: list[dict[str, str | int]] = []
        self.recovery_events: list[dict[str, str]] = []

    def get_region(self, region_id: str) -> Region:
        try:
            return self.regions[region_id]
        except KeyError as exc:
            raise KeyError(f"unknown region_id: {region_id}") from exc

    def get_issue(self, issue_id: str) -> Issue:
        try:
            return self.issues[issue_id]
        except KeyError as exc:
            raise KeyError(f"unknown issue_id: {issue_id}") from exc
