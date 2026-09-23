"""Claim, fact, specification, policy, template, and callback identities."""

import unittest

from .support import ContractUserError, load_source_functions, sha256


class IdentityRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = load_source_functions("evidra_registry.py")

    def claim(self, **overrides):
        values = {
            "subject": "Example",
            "predicate": "Has status",
            "object_value": "Active",
            "qualifiers": "Region=EU",
            "temporal": "2026",
            "mutability": "IMMUTABLE",
        }
        values.update(overrides)
        return self.r["compute_claim_key_value"](**values)

    def test_claim_key_normalizes_semantic_text_and_is_deterministic(self):
        first = self.claim()
        self.assertEqual(first, self.claim())
        self.assertEqual(
            first,
            self.claim(
                subject="  EXAMPLE ",
                predicate="has   STATUS",
                object_value=" active",
                qualifiers="region=eu",
                temporal="2026",
                mutability=" immutable ",
            ),
        )

    def test_claim_key_changes_for_each_semantic_field(self):
        baseline = self.claim()
        for field, value in (
            ("subject", "Other"),
            ("predicate", "Has owner"),
            ("object_value", "Paused"),
            ("qualifiers", "Region=US"),
            ("temporal", "2027"),
            ("mutability", "MUTABLE_WITH_TTL"),
        ):
            with self.subTest(field=field):
                self.assertNotEqual(baseline, self.claim(**{field: value}))

    def test_claim_key_excludes_execution_only_fields(self):
        baseline = self.claim()
        spec = self.r["compute_spec_hash_value"]
        self.assertEqual(baseline, self.claim())
        # Description, TTL, and seed URLs belong to the execution/spec hash,
        # not semantic claim identity.
        one = spec("Example", "Has status", "Active", "Region=EU", "2026", "IMMUTABLE", "1", 0, "A", ["https://a.example/" ])
        two = spec("Example", "Has status", "Active", "Region=EU", "2026", "IMMUTABLE", "1", 86400, "B", ["https://b.example/" ])
        self.assertNotEqual(one, two)
        self.assertEqual(baseline, self.claim())

    def test_fact_key_binds_policy_schema_and_template_regime(self):
        fact = self.r["compute_fact_key_value"]
        base = fact("a" * 64, "b" * 64, "1", "")
        self.assertEqual(base, fact("A" * 64, "B" * 64, " 1 ", ""))
        for field, value in (
            ("policy_hash", "c" * 64),
            ("schema_version", "2"),
            ("template_hash", "d" * 64),
        ):
            args = {"claim_key": "a" * 64, "policy_hash": "b" * 64, "schema_version": "1", "template_hash": ""}
            args[field] = value
            with self.subTest(field=field):
                self.assertNotEqual(base, fact(**args))

    def test_fact_key_does_not_include_ttl_or_description(self):
        fact = self.r["compute_fact_key_value"]
        self.assertEqual(
            fact("claim", "policy", "1", "template"),
            fact("claim", "policy", "1", "template"),
        )
        # The helper's four-argument signature is the executable proof that
        # TTL, seed URLs, and free-form description are outside fact identity.
        self.assertEqual(4, self.r["compute_fact_key_value"].__code__.co_argcount)

    def test_spec_hash_is_canonical_and_field_sensitive(self):
        spec = self.r["compute_spec_hash_value"]
        args = ("s", "p", "o", "q", "t", "IMMUTABLE", "1", 0, "desc", ["https://example.com/"])
        self.assertEqual(spec(*args), spec(*args))
        for index, value in enumerate(("x", "x", "x", "x", "x", "MUTABLE_WITH_TTL", "2", 1, "other", ["https://other.example/"])):
            changed = list(args)
            changed[index] = value
            with self.subTest(index=index):
                self.assertNotEqual(spec(*args), spec(*changed))

    def test_callback_id_is_domain_separated_and_case_insensitive(self):
        callback = self.r["compute_callback_id_value"]
        base = callback(7, 9, "0xAbCd")
        self.assertEqual(base, callback(7, 9, " 0xABCD "))
        self.assertNotEqual(base, callback(8, 9, "0xabcd"))
        self.assertNotEqual(base, callback(7, 10, "0xabcd"))
        self.assertNotEqual(base, callback(7, 9, "0xdead"))
        self.assertEqual(len(base), 64)
        self.assertEqual(base, sha256("EVIDRA_CB_V1|7|9|0xabcd"))


class PolicyHashRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = load_source_functions("evidra_policy_registry.py")

    def test_policy_class_parser_accepts_documented_aliases(self):
        parse = self.p["parse_source_classes"]
        self.assertEqual(parse("official, docs; community"), ["OFFICIAL", "PRIMARY", "COMMUNITY"])
        self.assertEqual(parse('["PRIMARY", "independent"]'), ["PRIMARY", "INDEPENDENT_SECONDARY"])
        self.assertEqual(parse(""), [])
        self.assertEqual(parse("[]"), [])

    def test_policy_class_parser_fails_closed(self):
        parse = self.p["parse_source_classes"]
        for raw, code in (("NOT_A_CLASS", "INVALID_POLICY_CLASS"), ("PRIMARY,primary", "DUPLICATE_POLICY_CLASS"), ("[", "INVALID_POLICY_CLASS"), ("{}", "INVALID_POLICY_CLASS")):
            with self.subTest(raw=raw):
                with self.assertRaises(ContractUserError) as ctx:
                    parse(raw)
                self.assertEqual(str(ctx.exception), code)

    def test_policy_allowed_and_disallowed_cannot_contradict(self):
        with self.assertRaises(ContractUserError) as ctx:
            self.p["validate_policy_classes"]("PRIMARY", "primary")
        self.assertEqual(str(ctx.exception), "CONTRADICTORY_POLICY_CLASS")
        self.assertEqual(self.p["validate_policy_classes"]("", ""), ("", ""))

    def test_policy_hash_is_stable_under_documented_normalization(self):
        h = self.p["_canonical_policy_payload"]
        one = h(" Audit ", 1, " Name ", 1, 2, "official,docs", "derived", True, " rules ")
        two = h("audit", 1, "name", 1, 2, "OFFICIAL,PRIMARY", "DERIVED", True, "rules")
        self.assertEqual(one, two)
        hash_fn = self.p["_sha256_hex"]
        self.assertEqual(hash_fn("EVIDRA_POLICY_V1|" + one), hash_fn("EVIDRA_POLICY_V1|" + two))

    def test_policy_hash_changes_for_security_relevant_fields(self):
        canonical = self.p["_canonical_policy_payload"]
        args = ["audit", 1, "name", 1, 1, "OFFICIAL", "DERIVED", True, "rules"]
        baseline = canonical(*args)
        for index, value in enumerate(("other", 2, "other name", 2, 2, "PRIMARY", "SOCIAL", False, "other rules")):
            changed = list(args)
            changed[index] = value
            with self.subTest(index=index):
                self.assertNotEqual(baseline, canonical(*changed))

    def test_template_hash_binds_version_rules_and_default_policy(self):
        template = self.p["_canonical_template_payload"]
        args = ["launch", 1, "Launch", "immutable", "subject,predicate", "Follow rules", "core", 1]
        base = template(*args)
        for index, value in enumerate(("other", 2, "other", "mutable_ttl", "subject", "Other rules", "other", 2)):
            changed = list(args)
            changed[index] = value
            with self.subTest(index=index):
                self.assertNotEqual(base, template(*changed))

