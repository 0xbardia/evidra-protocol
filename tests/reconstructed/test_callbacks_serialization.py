"""Callback authentication/idempotency and integration return-shape checks."""

import ast
import json
import unittest

from .support import function_source, load_source_functions, load_text


class CallbackRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_registry.py")

    def test_callback_ack_sender_requires_exact_nonzero_target(self):
        allowed = self.r["callback_ack_sender_allowed"]
        self.assertTrue(allowed("0xabc", "0xABC"))
        self.assertFalse(allowed("0xabd", "0xabc"))
        self.assertFalse(allowed("0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"))
        self.assertFalse(allowed("", "0xabc"))

    def test_callback_id_is_passed_to_fixed_consumer_method(self):
        registry = load_text("evidra_registry.py")
        consumer = load_text("evidra_consumer_probe.py")
        self.assertIn("IEvidraConsumer(req.callback_target)", registry)
        self.assertIn(".on_evidra_result(", registry)
        self.assertIn("callback_id", registry)
        self.assertIn("processed_ids_json", consumer)
        self.assertIn("duplicate_ignored_count", consumer)
        self.assertIn("if self._already_processed(cid):", consumer)
        self.assertIn("return", consumer)

    def test_callback_retry_does_not_change_resolution_truth(self):
        retry = function_source("evidra_registry.py", "request_callback_retry")
        ack = function_source("evidra_registry.py", "mark_callback_result")
        self.assertNotIn("res.outcome =", retry + ack)
        self.assertNotIn("fact.current_outcome =", retry + ack)
        self.assertIn("req.callback_status = self._emit_callback", retry)
        self.assertIn("req.callback_status = CB_ACKNOWLEDGED", ack)

    def test_callback_status_domain_and_retry_semantics_are_explicit(self):
        source = load_text("evidra_registry.py")
        for constant, value in (("CB_NONE", "NOT_REQUESTED"), ("CB_DISPATCHED", "DISPATCHED"), ("CB_ACKNOWLEDGED", "ACKNOWLEDGED"), ("CB_FAILED_REPORTED", "FAILED_REPORTED")):
            with self.subTest(value=value):
                self.assertIn(f'{constant} = "{value}"', source)
        self.assertIn("req.callback_status in (CB_DISPATCHED, CB_FAILED_REPORTED)", source)


class SerializationRegression(unittest.TestCase):
    def test_job_snapshot_is_json_and_contains_integration_bindings(self):
        source = function_source("evidra_registry.py", "get_job_snapshot")
        self.assertIn("json.dumps", source)
        for field in ("request_id", "claim_key", "fact_key", "spec_hash", "policy_hash", "status", "active_attempt_id", "template_hash", "seed_urls_json"):
            self.assertIn(f'"{field}"', source)
        self.assertIn("sort_keys=True", source)
        self.assertIn("separators=(\",\", \":\")", source)

    def test_page_shapes_are_json_string_payloads_with_bounded_limits(self):
        for filename, method in (("evidra_registry.py", "get_events"), ("evidra_registry.py", "get_resolution_history"), ("evidra_policy_registry.py", "get_events")):
            source = function_source(filename, method)
            with self.subTest(filename=filename, method=method):
                self.assertIn("items_json" if method == "get_events" else "resolution_ids_json", source)
                self.assertIn("json.dumps", source)
                self.assertIn("MAX_PAGE", source)

    def test_evidence_manifest_view_exposes_hash_and_json_separately(self):
        source = function_source("evidra_registry.py", "get_evidence_manifest")
        self.assertIn("manifest_hash", source)
        self.assertIn("manifest_json", source)
        self.assertIn("EvidenceManifestView", source)

    def test_numeric_protocol_values_are_not_serialized_as_floating_point(self):
        source = load_text("evidra_registry.py")
        self.assertIn('"request_id": int(req.request_id)', source)
        self.assertIn('"ttl_seconds": int(req.ttl_seconds)', source)
        self.assertNotIn("float(req.", source)


class PromptAndEvidenceShapeRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_resolver.py")

    def test_manifest_hash_is_hash_of_canonical_manifest_string(self):
        source = function_source("evidra_registry.py", "commit_resolution")
        self.assertIn("man_hash = _sha256_hex(manifest)", source)
        self.assertIn("self.evidence_manifests[resid] = manifest", source)

    def test_rendered_evidence_hash_is_bounded_to_first_4096_characters(self):
        source = load_text("evidra_resolver.py")
        self.assertIn('"evidence_hash": _sha256_hex(content[:4096])', source)
        self.assertIn("if len(text) > MAX_RENDER", source)
        self.assertIn("text = text[:MAX_RENDER]", source)

    def test_invalid_leader_values_are_normalized_to_safe_domains(self):
        normalized = self.r["_normalize_leader_result"]
        result = normalized(
            {"outcome": "MAYBE", "diagnostic_reason": "SECRET", "policy_satisfied": True, "reasoning_summary": ""},
            [],
            {},
        )
        self.assertEqual(result["outcome"], "UNRESOLVED")
        self.assertEqual(result["diagnostic_reason"], "SOURCE_UNAVAILABLE")
        self.assertFalse(result["policy_satisfied"])
