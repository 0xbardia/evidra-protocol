"""Authorization boundaries and request/resolution state-machine structure."""

import unittest

from .support import function_source, load_text, public_methods


class MethodSurfaceRegression(unittest.TestCase):
    def test_public_surface_is_complete_and_partitioned(self):
        policy = public_methods("evidra_policy_registry.py")
        registry = public_methods("evidra_registry.py")
        resolver = public_methods("evidra_resolver.py")
        consumer = public_methods("evidra_consumer_probe.py")
        all_methods = {**{f"PolicyRegistry.{k}": v for k, v in policy.items()}, **{f"Registry.{k}": v for k, v in registry.items()}, **{f"Resolver.{k}": v for k, v in resolver.items()}, **{f"ConsumerProbe.{k}": v for k, v in consumer.items()}}
        self.assertEqual(len(all_methods), 90)
        self.assertEqual(sum(v == "view" for v in all_methods.values()), 64)
        self.assertEqual(sum(v == "write" for v in all_methods.values()), 26)
        self.assertEqual(policy["publish_source_policy"], "write")
        self.assertEqual(registry["get_fact"], "view")
        self.assertEqual(resolver["resolve_request"], "write")
        self.assertEqual(consumer["on_evidra_result"], "write")

    def test_no_unexpected_public_write_is_missing_from_matrix(self):
        expected = {
            "publish_source_policy", "deprecate_source_policy", "publish_template", "deprecate_template", "propose_owner", "accept_owner",
        }
        actual = {name for name, mode in public_methods("evidra_policy_registry.py").items() if mode == "write"}
        self.assertEqual(actual, expected)
        self.assertEqual(
            {name for name, mode in public_methods("evidra_resolver.py").items() if mode == "write"},
            {"resolve_request"},
        )


class AuthorizationRegression(unittest.TestCase):
    def test_policy_admin_writes_are_owner_guarded(self):
        for name in ("publish_source_policy", "deprecate_source_policy", "publish_template", "deprecate_template", "propose_owner"):
            with self.subTest(name=name):
                self.assertIn("self._only_owner()", function_source("evidra_policy_registry.py", name))
        self.assertIn("gl.message.sender_address == self.pending_owner", function_source("evidra_policy_registry.py", "accept_owner"))

    def test_registry_admin_and_guardian_permissions_are_explicit(self):
        for name in ("set_resolver_enabled", "set_default_resolver", "set_fee_config", "set_guardian", "unpause_new_requests", "propose_owner"):
            with self.subTest(name=name):
                self.assertIn("self._only_owner()", function_source("evidra_registry.py", name))
        self.assertIn("self._only_guardian()", function_source("evidra_registry.py", "pause_new_requests"))
        self.assertIn("sender == req.requester or sender == self.owner or sender == self.guardian", function_source("evidra_registry.py", "cancel_stale_request"))

    def test_resolution_and_callback_callers_are_not_user_selectable(self):
        commit = function_source("evidra_registry.py", "commit_resolution")
        self.assertIn("gl.message.sender_address == req.assigned_resolver", commit)
        self.assertIn("attempt_id == req.active_attempt_id", commit)
        self.assertIn("req.status in (STATUS_PENDING, STATUS_DISPATCHED)", commit)
        self.assertIn("callback_ack_sender_allowed", function_source("evidra_registry.py", "mark_callback_result"))
        self.assertIn("gl.message.sender_address == self.trusted_registry", function_source("evidra_consumer_probe.py", "on_evidra_result"))
        self.assertIn("self._only_registry()", function_source("evidra_resolver.py", "resolve_request"))

    def test_admin_has_no_truth_override_or_manual_verdict_method(self):
        registry = load_text("evidra_registry.py")
        self.assertNotIn("set_verdict", registry)
        self.assertNotIn("override_outcome", registry)
        commit = function_source("evidra_registry.py", "commit_resolution")
        self.assertNotIn("self._only_owner()", commit)
        self.assertIn("outcome.strip().upper()", commit)

    def test_two_step_ownership_is_present_on_both_owner_contracts(self):
        for filename in ("evidra_policy_registry.py", "evidra_registry.py"):
            with self.subTest(filename=filename):
                propose = function_source(filename, "propose_owner")
                accept = function_source(filename, "accept_owner")
                self.assertIn("self.pending_owner", propose)
                self.assertIn("self.owner = self.pending_owner", accept)
                self.assertIn("self.pending_owner = ZERO", accept)


class StateMachineRegression(unittest.TestCase):
    def test_request_lifecycle_statuses_are_declared_and_written_at_expected_edges(self):
        source = load_text("evidra_registry.py")
        for value in ("PENDING", "DISPATCHED", "RESOLVED", "REUSED", "CANCELLED", "FAILED"):
            self.assertIn(f'STATUS_{value}', source)
        self.assertIn("req.status = STATUS_PENDING", source)
        self.assertIn("req.status = STATUS_DISPATCHED", source)
        self.assertIn("req.status = STATUS_RESOLVED", source)
        self.assertIn("req.status = STATUS_CANCELLED", source)
        self.assertNotIn("req.status = STATUS_FAILED", source)

    def test_attempt_and_binding_guards_precede_commit(self):
        commit = function_source("evidra_registry.py", "commit_resolution")
        order = [
            "req.exists",
            "gl.message.sender_address == req.assigned_resolver",
            "req.status in (STATUS_PENDING, STATUS_DISPATCHED)",
            "attempt_id == req.active_attempt_id",
            "claim_key == req.claim_key",
            "fact_key == req.fact_key",
            "spec_hash == req.spec_hash",
            "policy_hash == req.policy_hash",
        ]
        positions = [commit.index(part) for part in order]
        self.assertEqual(positions, sorted(positions))

    def test_canonical_and_latest_are_written_independently(self):
        source = function_source("evidra_registry.py", "commit_resolution")
        self.assertIn("latest_resolution_id=resid", source)
        self.assertIn("canonical_id = fact.current_resolution_id", source)
        self.assertIn("canonical_outcome = fact.current_outcome", source)
        self.assertIn("canonical_request = fact.current_request_id", source)
        self.assertIn("advance = should_advance_canonical", source)

    def test_retry_cancel_and_callback_retry_have_state_and_permission_guards(self):
        retry = function_source("evidra_registry.py", "retry_resolution")
        cancel = function_source("evidra_registry.py", "cancel_stale_request")
        callback = function_source("evidra_registry.py", "request_callback_retry")
        self.assertIn("req.status in (STATUS_PENDING, STATUS_DISPATCHED)", retry)
        self.assertIn("req.attempt_count) < int(req.max_attempts)", retry)
        self.assertIn("int(_now()) >= int(req.retry_after)", retry)
        self.assertIn("req.status in (STATUS_PENDING, STATUS_DISPATCHED)", cancel)
        self.assertIn("last + int(self.stale_after_seconds)", cancel)
        self.assertIn("req.status in (STATUS_RESOLVED, STATUS_REUSED)", callback)
        self.assertIn("req.callback_status in (CB_DISPATCHED, CB_FAILED_REPORTED)", callback)

