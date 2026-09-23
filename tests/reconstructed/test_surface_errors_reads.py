"""Public read surface, error domains, and bounded integration behavior."""

import json
import re
import unittest
from pathlib import Path

from .support import ROOT, function_source, load_text, public_methods


class MethodMatrixRegression(unittest.TestCase):
    def test_machine_matrix_matches_actual_public_method_names_and_modes(self):
        matrix = json.loads((ROOT / "docs" / "contract-method-matrix.json").read_text())
        source_files = {
            "EvidraPolicyRegistry": "evidra_policy_registry.py",
            "EvidraRegistry": "evidra_registry.py",
            "EvidraResolver": "evidra_resolver.py",
            "EvidraConsumerProbe": "evidra_consumer_probe.py",
        }
        expected = {}
        for contract, filename in source_files.items():
            expected.update({(contract, name): mode for name, mode in public_methods(filename).items()})
        actual = {(row["contract"], row["method"]): row["view_write_payable"].split(".")[0] for row in matrix["methods"]}
        self.assertEqual(actual, expected)
        self.assertEqual(matrix["counts"], {"total": 90, "views": 64, "writes": 26, "by_contract": {"EvidraPolicyRegistry": 25, "EvidraRegistry": 48, "EvidraResolver": 5, "EvidraConsumerProbe": 12}})
        for row in matrix["methods"]:
            self.assertIn("parameters", row)
            self.assertIn("return_type", row)
            self.assertIn("revert_error_conditions", row)
            self.assertIn("requires_finalized_followup", row)

    def test_all_public_views_are_explicitly_named_in_source(self):
        views = []
        for filename in ("evidra_policy_registry.py", "evidra_registry.py", "evidra_resolver.py", "evidra_consumer_probe.py"):
            views.extend(name for name, mode in public_methods(filename).items() if mode == "view")
        self.assertEqual(len(views), 64)
        self.assertEqual(len(views), 64)


class ErrorDomainRegression(unittest.TestCase):
    def test_major_error_categories_are_catalogued_and_used(self):
        catalog = (ROOT / "docs" / "CONTRACT_ERROR_CATALOG.md").read_text()
        sources = "\n".join(load_text(f) for f in ("evidra_policy_registry.py", "evidra_registry.py", "evidra_resolver.py", "evidra_consumer_probe.py"))
        codes = set(re.findall(r"`([A-Z][A-Z0-9_]+)`", catalog))
        for code in ("NOT_OWNER", "NOT_PENDING_OWNER", "INVALID_PARAM", "INVALID_POLICY_CLASS", "DUPLICATE_POLICY_CLASS", "CONTRADICTORY_POLICY_CLASS", "UNKNOWN_POLICY", "POLICY_INACTIVE", "UNKNOWN_TEMPLATE", "TEMPLATE_INACTIVE", "TEMPLATE_FACT_TYPE", "TEMPLATE_REQUIRED_FIELD", "PAUSED", "NO_DEFAULT_RESOLVER", "RESOLVER_DISABLED", "FEE_INSUFFICIENT", "TOO_MANY_SEEDS", "INVALID_URL", "INVALID_PAGINATION", "UNKNOWN_FACT", "UNKNOWN_REQUEST", "NOTHING_TO_RETRY", "MAX_ATTEMPTS", "NOT_STALE", "STALE_ATTEMPT", "NOT_ASSIGNED_RESOLVER", "BINDING_MISMATCH", "UNAUTHORIZED", "CALLBACK_NOT_FAILED", "NO_CREDIT", "NOT_GUARDIAN"):
            with self.subTest(code=code):
                self.assertIn(code, codes)
                self.assertIn(code, sources)

    def test_error_messages_do_not_require_end_users_to_see_internal_details(self):
        catalog = (ROOT / "docs" / "CONTRACT_ERROR_CATALOG.md").read_text()
        self.assertIn("end-user", catalog)
        self.assertIn("authority or resolver internals", catalog)


class SerializationAndPaginationRegression(unittest.TestCase):
    def test_registry_history_and_event_pages_reject_unbounded_limits(self):
        for method in ("get_resolution_history", "get_events"):
            source = function_source("evidra_registry.py", method)
            self.assertIn("INVALID_PAGINATION", source)
            self.assertIn("MAX_PAGE", source)
        self.assertIn("limit: u32", function_source("evidra_registry.py", "get_resolution_history"))

    def test_policy_event_page_has_same_limit_guard(self):
        source = function_source("evidra_policy_registry.py", "get_events")
        self.assertIn("int(limit) > 0 and int(limit) <= MAX_PAGE", source)
        self.assertIn("items_json=json.dumps", source)

    def test_missing_reads_return_empty_records_not_false_positive_truth(self):
        registry = load_text("evidra_registry.py")
        policy = load_text("evidra_policy_registry.py")
        self.assertIn("self._empty_request()", registry)
        self.assertIn("self._empty_fact()", registry)
        self.assertIn("return self._empty_resolution()", registry)
        self.assertIn("return self._empty_policy()", policy)
        self.assertIn("return self._empty_template()", policy)
        self.assertIn('return "UNKNOWN"', registry)

    def test_resolver_capability_return_shape_is_explicit(self):
        source = function_source("evidra_resolver.py", "get_capabilities_json")
        for field in ("version", "web_access", "llm_access", "source_isolation", "injection_hardened", "equivalence"):
            self.assertIn(f'"{field}"', source)
