"""Freshness, reuse, reassessment, template snapshots, and history rules."""

import json
import unittest

from .support import ContractUserError, function_source, load_source_functions, load_text


class FreshnessReuseRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_registry.py")

    def test_immutable_boolean_is_fresh_and_unresolved_is_not(self):
        fresh = self.r["freshness_allows_reuse"]
        self.assertTrue(fresh("IMMUTABLE", "TRUE", 1, 0, 0, 999999))
        self.assertTrue(fresh("IMMUTABLE", "FALSE", 1, 0, 1, 999999))
        self.assertFalse(fresh("IMMUTABLE", "UNRESOLVED", 1, 0, 1, 999999))

    def test_mutable_ttl_is_fresh_at_boundary_and_stale_after(self):
        fresh = self.r["freshness_allows_reuse"]
        self.assertTrue(fresh("MUTABLE_WITH_TTL", "TRUE", 100, 200, 100, 200))
        self.assertFalse(fresh("MUTABLE_WITH_TTL", "TRUE", 100, 200, 100, 201))
        self.assertFalse(fresh("MUTABLE_WITH_TTL", "TRUE", 100, 200, 0, 100))
        self.assertFalse(fresh("MUTABLE_WITH_TTL", "UNRESOLVED", 100, 200, 100, 200))

    def test_force_fresh_and_identity_mismatch_prevent_reuse(self):
        source = load_text("evidra_registry.py")
        self.assertIn('if reuse_mode != REUSE_IF_FRESH:', source)
        self.assertIn('if fact.policy_hash != policy_hash:', source)
        self.assertIn('if _norm(fact.schema_version) != _norm(schema_version):', source)
        self.assertIn('if incoming_th != stored_th:', source)
        self.assertIn('mode in (REUSE_IF_FRESH, FORCE_FRESH)', source)

    def test_expired_canonical_cannot_become_fresh_from_unresolved_latest(self):
        # Canonical advancement is independent of latest-attempt advancement.
        advance = self.r["should_advance_canonical"]
        self.assertFalse(advance(True, "TRUE", "UNRESOLVED", False))
        self.assertFalse(advance(True, "FALSE", "UNRESOLVED", False))
        self.assertTrue(advance(True, "TRUE", "FALSE", True))


class HistoryRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_registry.py")

    def test_history_versions_are_strictly_monotonic(self):
        next_version = self.r["next_history_version"]
        self.assertEqual([next_version(i > 0, i) for i in range(4)], [1, 2, 3, 4])
        self.assertEqual([self.r["history_supersedes_id"](i > 0, i) for i in range(4)], [0, 1, 2, 3])

    def test_canonical_rules_match_true_false_unresolved_matrix(self):
        advance = self.r["should_advance_canonical"]
        cases = (
            (False, "", "UNRESOLVED", False, True),
            (False, "", "TRUE", True, True),
            (True, "TRUE", "UNRESOLVED", False, False),
            (True, "FALSE", "UNRESOLVED", False, False),
            (True, "TRUE", "FALSE", True, True),
            (True, "FALSE", "TRUE", True, True),
            (True, "TRUE", "TRUE", False, False),
        )
        for prev_exists, prev, new, policy_ok, expected in cases:
            with self.subTest(prev=prev, new=new, policy_ok=policy_ok):
                self.assertEqual(advance(prev_exists, prev, new, policy_ok), expected)

    def test_registry_commits_latest_every_time_but_canonical_uses_advance_rule(self):
        source = load_text("evidra_registry.py")
        self.assertIn('self.facts[req.fact_key] = fact_rec', source)
        self.assertIn('latest_resolution_id=resid', source)
        self.assertIn('canonical_id = fact.current_resolution_id', source)
        self.assertIn('self._append_history(req.fact_key, resid)', source)
        self.assertIn('supersedes = u256(history_supersedes_id', source)


class TemplateRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_registry.py")
        cls.resolver = load_source_functions("evidra_resolver.py")

    def test_template_fact_type_and_required_fields_are_enforced(self):
        compatible = self.r["template_fact_type_compatible"]
        required = self.r["required_fields_present"]
        self.assertTrue(compatible("immutable fact", "IMMUTABLE"))
        self.assertFalse(compatible("immutable fact", "MUTABLE_WITH_TTL"))
        self.assertTrue(compatible("mutable ttl", "MUTABLE_WITH_TTL"))
        self.assertFalse(compatible("mutable ttl", "IMMUTABLE"))
        self.assertTrue(required("subject,predicate", {"subject": "s", "predicate": "p"}))
        self.assertFalse(required("subject,predicate", {"subject": "s", "predicate": ""}))
        self.assertFalse(required("subject,predicate", {"subject": "s"}))

    def test_template_snapshot_requires_exact_id_version_and_hash(self):
        matches = self.resolver["template_snapshot_matches"]
        self.assertTrue(matches("launch", 1, "h", "launch", 1, "h"))
        self.assertFalse(matches("launch", 1, "h", "launch", 2, "h"))
        self.assertFalse(matches("launch", 1, "h", "launch", 1, "other"))
        self.assertFalse(matches("launch", 1, "h", "other", 1, "h"))

    def test_resolver_template_rules_are_loaded_by_exact_snapshot(self):
        source = load_text("evidra_resolver.py")
        self.assertIn('template_snapshot_matches(tid, tver, thash, stored_id, stored_ver, stored_hash)', source)
        self.assertIn('template_meta.get("resolution_instructions", "")', source)
        self.assertIn('TEMPLATE_RULES=', source)
        self.assertIn('Template rules are AUTHORITATIVE', source)

    def test_template_versions_are_immutable_records(self):
        source = load_text("evidra_policy_registry.py")
        self.assertIn('_require(not existing.exists, "TEMPLATE_EXISTS")', source)
        self.assertIn('_require(not existing.exists, "POLICY_EXISTS")', source)
        self.assertIn('rec.active = False', source)
        self.assertIn('rec.deprecated = True', source)
        self.assertIn('return self.get_template(tid, ver)', source)


class BoundsRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_registry.py")

    def test_seed_and_supplemental_bounds_are_distinct_and_bounded(self):
        parse = self.r["parse_seed_urls"]
        valid = json.dumps(["https://example.com/%s" % i for i in range(8)])
        self.assertEqual(len(parse(valid, 8)), 8)
        with self.assertRaises(ContractUserError) as ctx:
            parse(json.dumps(["https://example.com/%s" % i for i in range(9)]), 8)
        self.assertEqual(str(ctx.exception), "TOO_MANY_SEEDS")
        with self.assertRaises(ContractUserError):
            parse(json.dumps(["https://example.com/%s" % i for i in range(7)]), 6)

    def test_scalar_and_url_bounds_are_source_enforced(self):
        source = load_text("evidra_registry.py")
        self.assertIn("MAX_URL_LEN = 2048", source)
        self.assertIn("MAX_TEXT = 1024", source)
        self.assertIn("MAX_DESC = 2048", source)
        self.assertIn("MAX_PAGE = 50", source)
        self.assertIn("MAX_TOTAL_RESOLUTION_SOURCES = 12", source)
