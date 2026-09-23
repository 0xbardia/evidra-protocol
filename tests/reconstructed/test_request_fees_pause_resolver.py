"""Request ingress, pause, fee/credit, resolver, and finality boundaries."""

import unittest

from .support import function_source, load_source_functions, load_text


class RequestIngressRegression(unittest.TestCase):
    def test_custom_request_binds_policy_identity_and_execution_fields(self):
        source = function_source("evidra_registry.py", "_create_request")
        for field in ("claim_key", "fact_key", "spec_hash", "policy_hash", "policy_id", "policy_version", "seed_urls_json", "supplemental_urls_json", "template_hash"):
            self.assertIn(field, source)
        self.assertIn("self._load_policy(pid, policy_version)", source)
        self.assertIn("parse_seed_urls(seed_urls_json", source)
        self.assertIn("parse_seed_urls(supplemental_urls_json", source)

    def test_template_request_uses_default_policy_and_validates_required_fields(self):
        source = function_source("evidra_registry.py", "request_fact_by_template")
        self.assertIn("get_template(tid, template_version)", source)
        self.assertIn("default_policy_id", source)
        self.assertIn("default_policy_version", source)
        self.assertIn("required_fields_present", source)
        self.assertIn("template_fact_type_compatible", source)

    def test_refresh_is_mutable_only_and_forces_fresh_resolution(self):
        source = function_source("evidra_registry.py", "refresh_fact")
        self.assertIn('fact.mutability == MUTABLE_TTL', source)
        self.assertIn('"ALREADY_RESOLVED_IMMUTABLE"', source)
        self.assertIn('FORCE_FRESH', source)

    def test_reassessment_reuses_fact_binding_and_prioritizes_supplemental_urls(self):
        request = function_source("evidra_registry.py", "request_reassessment")
        resolver = function_source("evidra_resolver.py", "merge_resolution_urls")
        self.assertIn("fact.current_request_id", request)
        self.assertIn("req_prev.seed_urls_json", request)
        self.assertIn("supplemental_urls_json", request)
        self.assertIn('"origin": "supplemental"', resolver)
        self.assertIn('"origin": "seed"', resolver)

    def test_invalid_schema_mutability_and_reuse_inputs_fail_before_dispatch(self):
        source = function_source("evidra_registry.py", "_create_request")
        self.assertIn("mut in (IMMUTABLE, MUTABLE_TTL)", source)
        self.assertIn("_norm(schema) == SCHEMA_V1", source)
        self.assertIn("mode in (REUSE_IF_FRESH, FORCE_FRESH)", source)
        self.assertIn("_require(int(ttl_seconds) > 0", source)


class PauseFeesCreditsRegression(unittest.TestCase):
    def test_pause_blocks_new_requests_but_force_new_paths_are_explicit(self):
        create = function_source("evidra_registry.py", "_create_request")
        template = function_source("evidra_registry.py", "request_fact_by_template")
        refresh = function_source("evidra_registry.py", "refresh_fact")
        reassess = function_source("evidra_registry.py", "request_reassessment")
        self.assertIn("if not force_new", create)
        self.assertIn('"PAUSED"', create + template + refresh + reassess)
        self.assertIn("self.paused_new_requests = True", function_source("evidra_registry.py", "pause_new_requests"))
        self.assertIn("self.paused_new_requests = False", function_source("evidra_registry.py", "unpause_new_requests"))

    def test_protocol_fee_quote_distinguishes_reuse_from_new_request(self):
        source = function_source("evidra_registry.py", "quote_resolution_fee")
        self.assertIn("mode == REUSE_IF_FRESH", source)
        self.assertIn("return self.fee_reuse", source)
        self.assertIn("return self.fee_base + self.fee_per_attempt", source)

    def test_invalid_quote_mode_is_not_treated_as_reuse(self):
        source = function_source("evidra_registry.py", "quote_resolution_fee")
        self.assertNotIn('raise gl.vm.UserError("INVALID_PARAM")', source)
        self.assertIn("mode = reuse_mode.strip().upper()", source)

    def test_overpayment_becomes_sender_credit_and_withdrawal_is_cleared(self):
        take = function_source("evidra_registry.py", "_take_payment")
        withdraw = function_source("evidra_registry.py", "withdraw_credit")
        self.assertIn("extra = u256(int(value) - int(required))", take)
        self.assertIn("self._credit(gl.message.sender_address, extra)", take)
        self.assertIn("self.credits[who] = u256(0)", withdraw)
        self.assertIn('"NO_CREDIT"', withdraw)
        self.assertNotIn("self.credits[gl.message.sender_address]", withdraw)

    def test_credit_creation_ignores_zero_and_zero_address(self):
        credit = function_source("evidra_registry.py", "_credit")
        self.assertIn("if int(amount) == 0 or who == ZERO", credit)


class ResolverAndFinalityRegression(unittest.TestCase):
    def test_resolver_requires_registry_sender_and_revalidates_stored_urls(self):
        source = load_text("evidra_resolver.py")
        self.assertIn("def _only_registry", source)
        self.assertIn("self._validate_urls(urls)", source)
        self.assertIn("registry.validate_seed_url(url)", source)
        self.assertIn("self._verify_template(data)", source)
        self.assertIn("self._load_policy(data)", source)

    def test_registry_resolver_dispatch_and_callbacks_use_finalized_messages(self):
        registry = load_text("evidra_registry.py")
        self.assertIn('EvidraResolverIfc(req.assigned_resolver).emit(on="finalized")', registry)
        self.assertIn('consumer.emit(on="finalized")', registry)
        self.assertIn('EvidraRegistryIfc(self.registry).emit(on="finalized").commit_resolution', load_text("evidra_resolver.py"))

    def test_resolver_capability_equivalence_is_declared_not_verdict_truth(self):
        source = function_source("evidra_resolver.py", "get_capabilities")
        self.assertIn('equivalence="critical-fields-only"', source)
        self.assertIn("source_isolation=True", source)
        self.assertIn("injection_hardened=True", source)

    def test_web_fetch_is_after_url_validation_in_resolve_path(self):
        source = function_source("evidra_resolver.py", "resolve_request")
        self.assertLess(source.index("self._validate_urls(urls)"), source.index("def leader_fn"))
        self.assertIn("_resolve_semantics(spec, policy, urls)", source)

