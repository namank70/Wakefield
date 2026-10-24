from __future__ import annotations

import asyncio
import unittest
from datetime import datetime, timedelta, timezone

from wakefield.demo_reset import reset_demo
from wakefield.engine import WakefieldService
from wakefield.geography import locate_region
from wakefield.models import DuplicateInput, Issue, LocationInput
from wakefield.repository import InMemoryWakefieldRepository


def run(awaitable):
    return asyncio.run(awaitable)


class WakefieldTests(unittest.TestCase):
    def setUp(self):
        self.repo = InMemoryWakefieldRepository()
        self.now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.service = WakefieldService(self.repo, lambda: self.now)

    def add_issue(self, issue_id="I-1", **kwargs):
        issue = Issue(issue_id, kwargs.pop("region_id", "MLK_LIBRARY"), kwargs.pop("category", "blocked_pathway"), kwargs.pop("severity", "high"), kwargs.pop("accessibility_impact", True), kwargs.pop("critical_route_service", True), created_at=kwargs.pop("created_at", self.now))
        return run(self.service.create_issue(issue, kwargs.pop("latitude", 37.3350), kwargs.pop("longitude", -121.8817), kwargs.pop("reporter_id", "student-1")))

    def test_geography_and_pin_source(self):
        match = locate_region(LocationInput(37.3350, -121.8817, "student_confirmed_pin"))
        self.assertEqual(match.region_id, "MLK_LIBRARY")
        self.assertEqual(match.location_source, "student_confirmed_pin")
        self.assertFalse(locate_region(LocationInput(37.40, -121.90)).within_campus)
        self.assertIsNone(locate_region(LocationInput(37.3388, -121.8775)).region_id)

    def test_duplicate_rules_and_deterministic_tie_break(self):
        self.add_issue()
        self.assertIsNotNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.3351, -121.8817, self.now))))
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("pothole", 37.3351, -121.8817, self.now))))
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.3351, -121.8817, self.now + timedelta(hours=25)))))
        self.repo.get_issue("I-1").status = "resolved"
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.3351, -121.8817, self.now))))

    def test_activation_impact_and_health_recovery(self):
        issue = self.add_issue()
        activation = run(self.service.calculateActivation("MLK_LIBRARY"))
        self.assertEqual(activation.activation_score, 5)
        self.assertTrue(activation.active)
        impact = run(self.service.calculateImpact(issue.id))
        self.assertEqual(impact.priority_score, sum(impact.breakdown.values()))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)
        self.assertEqual(run(self.service.applyIssueDamage(issue.id)).health, 70)
        run(self.service.mark_fixed(issue.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)
        run(self.service.applyVerifiedHeal(issue.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 100)

    def test_multiple_issues_derive_health_and_duplicate_reports_do_not_damage(self):
        first = self.add_issue()
        second = self.add_issue("I-2", category="pothole", severity="medium", accessibility_impact=False, critical_route_service=False, latitude=37.3355)
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 55)
        run(self.service.confirm_duplicate(first.id, "student-2"))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 55)
        run(self.service.mark_fixed(first.id))
        run(self.service.applyVerifiedHeal(first.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 85)
        self.assertEqual(self.repo.get_issue(first.id).independent_report_count, 2)

    def test_failed_verification_reopens_without_healing_and_credits_are_idempotent(self):
        issue = self.add_issue()
        run(self.service.mark_fixed(issue.id))
        run(self.service.verify_repair(issue.id, False))
        self.assertEqual(issue.status, "open")
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)
        run(self.service.mark_fixed(issue.id))
        run(self.service.verify_repair(issue.id, True))
        run(self.service.applyVerifiedHeal(issue.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 100)
        self.assertEqual(sum(int(item["amount"]) for item in self.repo.credits), 40)

    def test_activation_threshold_urgent_and_impact_limits(self):
        issue = self.add_issue(severity="low", accessibility_impact=False, critical_route_service=False)
        self.assertFalse(run(self.service.calculateActivation("MLK_LIBRARY")).active)
        self.repo.get_issue(issue.id).severity = "urgent"
        self.assertTrue(run(self.service.calculateActivation("MLK_LIBRARY")).active)
        self.repo.get_issue(issue.id).independent_report_count = 99
        self.now += timedelta(days=100)
        impact = run(self.service.calculateImpact(issue.id))
        self.assertEqual(impact.breakdown["reports"], 20)
        self.assertEqual(impact.breakdown["unresolved_time"], 15)
        self.assertLessEqual(impact.priority_score, 100)

    def test_demo_reset_is_repeatable(self):
        first = reset_demo(self.service)
        self.add_issue()
        second = reset_demo(self.service)
        self.assertEqual(first, second)
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").baseline_activation_score, 1)
        self.assertEqual(len(self.repo.issues), 0)

    def test_complete_demo_flow_uses_documented_baseline(self):
        reset_demo(self.service)
        issue = self.add_issue()
        activation = run(self.service.calculateActivation("MLK_LIBRARY"))
        self.assertEqual(activation.activation_score, 6)
        self.assertTrue(activation.active)
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)
        run(self.service.mark_fixed(issue.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)
        run(self.service.applyVerifiedHeal(issue.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 100)
        self.assertTrue(run(self.service.calculateActivation("MLK_LIBRARY")).recovered)

    def test_campus_boundary_edge_is_inside(self):
        self.assertTrue(locate_region(LocationInput(37.331, -121.889)).within_campus)

    def test_region_boundary_edge_is_inclusive(self):
        self.assertEqual(locate_region(LocationInput(37.334, -121.8832)).region_id, "MLK_LIBRARY")

    def test_invalid_geography_coordinates_raise(self):
        with self.assertRaises(ValueError):
            locate_region(LocationInput(91, -121.88))

    def test_each_pilot_region_is_locatable(self):
        points = [(37.335, -121.8817, "MLK_LIBRARY"), (37.335, -121.8785, "STUDENT_UNION"), (37.3375, -121.8815, "ENGINEERING_BUILDING")]
        for latitude, longitude, region_id in points:
            self.assertEqual(locate_region(LocationInput(latitude, longitude)).region_id, region_id)

    def test_unknown_region_is_structured_error(self):
        with self.assertRaisesRegex(KeyError, "unknown region_id"):
            run(self.service.calculateActivation("NOPE"))

    def test_duplicate_exactly_30_meters_matches(self):
        self.add_issue()
        self.assertIsNotNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.335269, -121.8817, self.now))))

    def test_duplicate_over_30_meters_does_not_match(self):
        self.add_issue()
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.3354, -121.8817, self.now))))

    def test_duplicate_exactly_24_hours_is_stale(self):
        self.add_issue(created_at=self.now - timedelta(hours=24))
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.335, -121.8817, self.now))))

    def test_in_progress_and_awaiting_verification_are_matchable(self):
        issue = self.add_issue()
        for status in ("in_progress", "awaiting_verification"):
            issue.status = status
            self.assertIsNotNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.335, -121.8817, self.now))))

    def test_closed_issue_is_not_matchable(self):
        issue = self.add_issue()
        issue.status = "closed"
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.335, -121.8817, self.now))))

    def test_nearest_duplicate_wins_with_id_tie_break(self):
        self.add_issue("I-B", latitude=37.3351)
        self.add_issue("I-A", latitude=37.3351, reporter_id="student-2")
        result = run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.3351, -121.8817, self.now)))
        self.assertEqual(result.existing_issue_id, "I-A")

    def test_duplicate_without_saved_location_is_ignored(self):
        issue = self.add_issue()
        issue.latitude = issue.longitude = None
        self.assertIsNone(run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", 37.335, -121.8817, self.now))))

    def test_duplicate_invalid_coordinates_raise(self):
        with self.assertRaises(ValueError):
            run(self.service.suggestDuplicate(DuplicateInput("blocked_pathway", -91, -121.88, self.now)))

    def test_activation_exact_threshold_activates(self):
        self.repo.get_region("MLK_LIBRARY").baseline_activation_score = 4
        self.add_issue(severity="low", accessibility_impact=False, critical_route_service=False)
        self.assertTrue(run(self.service.calculateActivation("MLK_LIBRARY")).active)

    def test_accessibility_adds_exactly_two_points(self):
        issue = self.add_issue(severity="low", accessibility_impact=True, critical_route_service=False)
        activation = run(self.service.calculateActivation("MLK_LIBRARY"))
        self.assertEqual(activation.activation_score, 3)
        self.assertIn(f"{issue.id}:accessibility:+2", activation.activation_reasons)

    def test_unresolved_time_adds_one_activation_point(self):
        self.add_issue(severity="low", accessibility_impact=False, created_at=self.now - timedelta(hours=24))
        self.assertEqual(run(self.service.calculateActivation("MLK_LIBRARY")).activation_score, 2)

    def test_resolved_issue_stops_activation_contribution(self):
        issue = self.add_issue()
        issue.status = "resolved"
        result = run(self.service.calculateActivation("MLK_LIBRARY"))
        self.assertEqual(result.activation_score, 0)
        self.assertFalse(result.active)

    def test_corroboration_bonus_is_bounded(self):
        issue = self.add_issue(severity="low", accessibility_impact=False)
        issue.independent_report_count = 100
        result = run(self.service.calculateActivation("MLK_LIBRARY"))
        self.assertEqual(result.activation_score, 1 + 3)

    def test_recovered_region_retains_history_after_resolution(self):
        issue = self.add_issue()
        self.assertTrue(run(self.service.calculateActivation("MLK_LIBRARY")).active)
        run(self.service.mark_fixed(issue.id))
        run(self.service.applyVerifiedHeal(issue.id))
        result = run(self.service.calculateActivation("MLK_LIBRARY"))
        self.assertTrue(result.recovered)
        self.assertTrue(self.repo.get_region("MLK_LIBRARY").ever_activated)

    def test_impact_severity_weights(self):
        expected = {"low": 8, "medium": 18, "high": 30, "urgent": 40}
        for severity, value in expected.items():
            issue = self.add_issue(f"I-{severity}", severity=severity)
            self.assertEqual(run(self.service.calculateImpact(issue.id)).breakdown["severity"], value)

    def test_impact_never_goes_below_zero_with_future_clock(self):
        issue = self.add_issue(created_at=self.now + timedelta(hours=4))
        self.assertGreaterEqual(run(self.service.calculateImpact(issue.id)).priority_score, 0)

    def test_impact_time_component_caps_at_fifteen(self):
        issue = self.add_issue(created_at=self.now - timedelta(days=30))
        self.assertEqual(run(self.service.calculateImpact(issue.id)).breakdown["unresolved_time"], 15)

    def test_impact_accessibility_and_critical_components(self):
        issue = self.add_issue(severity="low", accessibility_impact=True, critical_route_service=True)
        breakdown = run(self.service.calculateImpact(issue.id)).breakdown
        self.assertEqual(breakdown["accessibility"], 15)
        self.assertEqual(breakdown["critical_route"], 10)

    def test_damage_values_are_applied_by_severity(self):
        expected = {"low": 5, "medium": 15, "high": 30, "urgent": 50}
        for severity, value in expected.items():
            issue = self.add_issue(f"I-{severity}", severity=severity)
            self.assertEqual(run(self.service.applyIssueDamage(issue.id)).applied_damage, value)

    def test_repeated_damage_request_is_idempotent(self):
        issue = self.add_issue()
        first = run(self.service.applyIssueDamage(issue.id))
        second = run(self.service.applyIssueDamage(issue.id))
        self.assertEqual(first.health, second.health)
        self.assertEqual(issue.applied_damage, 30)

    def test_duplicate_confirmation_does_not_apply_damage(self):
        issue = self.add_issue()
        run(self.service.confirm_duplicate(issue.id, "student-2"))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)
        self.assertEqual(len(self.repo.issues), 1)

    def test_zero_health_is_clamped(self):
        for index, severity in enumerate(("urgent", "urgent", "urgent")):
            self.add_issue(f"I-{index}", severity=severity, category=f"category-{index}")
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 0)

    def test_awaiting_verification_remains_damaged(self):
        issue = self.add_issue()
        run(self.service.mark_fixed(issue.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 70)

    def test_resolving_one_of_two_issues_restores_only_one_damage(self):
        first = self.add_issue()
        second = self.add_issue("I-2", category="pothole", severity="medium", latitude=37.3355)
        run(self.service.mark_fixed(first.id))
        run(self.service.applyVerifiedHeal(first.id))
        self.assertEqual(self.repo.get_region("MLK_LIBRARY").health, 85)
        self.assertEqual(second.status, "open")

    def test_unknown_issue_is_structured_error(self):
        with self.assertRaisesRegex(KeyError, "unknown issue_id"):
            run(self.service.calculateImpact("NOPE"))

    def test_invalid_issue_severity_is_rejected(self):
        with self.assertRaises(ValueError):
            self.add_issue(severity="critical")

    def test_same_reporter_does_not_inflate_count(self):
        issue = self.add_issue()
        run(self.service.confirm_duplicate(issue.id, "student-1"))
        self.assertEqual(issue.independent_report_count, 1)

    def test_distinct_reporter_increases_count_once(self):
        issue = self.add_issue()
        run(self.service.confirm_duplicate(issue.id, "student-2"))
        run(self.service.confirm_duplicate(issue.id, "student-2"))
        self.assertEqual(issue.independent_report_count, 2)

    def test_repeated_credit_awards_are_idempotent(self):
        issue = self.add_issue()
        run(self.service.confirm_duplicate(issue.id, "student-2"))
        run(self.service.confirm_duplicate(issue.id, "student-2"))
        self.assertEqual(sum(int(item["amount"]) for item in self.repo.credits), 12)

    def test_map_state_contains_all_regions_and_counts(self):
        self.add_issue()
        state = run(self.service.map_state())
        self.assertEqual(len(state["regions"]), 3)
        mlk = next(region for region in state["regions"] if region["id"] == "MLK_LIBRARY")
        self.assertEqual(mlk["open_issue_count"], 1)
        self.assertEqual(mlk["urgent_issue_count"], 0)

    def test_reset_clears_issues_reports_credits_and_recovery_events(self):
        issue = self.add_issue()
        run(self.service.mark_fixed(issue.id))
        run(self.service.applyVerifiedHeal(issue.id))
        reset_demo(self.service)
        self.assertEqual(len(self.repo.issues), 0)
        self.assertEqual(len(self.repo.reports), 0)
        self.assertEqual(len(self.repo.credits), 0)
        self.assertEqual(len(self.repo.recovery_events), 0)


if __name__ == "__main__":
    unittest.main()
