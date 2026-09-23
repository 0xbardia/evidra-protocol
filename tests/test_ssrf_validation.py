"""Focused regression tests for the V1 source-URL boundary.

The repository snapshot does not include the historical GenLayer test runner,
so these tests execute the real Registry validator extracted from the contract
source with only its deterministic dependencies stubbed.
"""

import ast
import json
import types
import unittest
import urllib.parse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_SOURCE = ROOT / "contracts" / "evidra_registry.py"
RESOLVER_SOURCE = ROOT / "contracts" / "evidra_resolver.py"


class _UserError(Exception):
    pass


def _load_url_functions():
    tree = ast.parse(REGISTRY_SOURCE.read_text(encoding="utf-8"))
    wanted = {
        "_require",
        "_is_ascii_letter",
        "_is_ascii_digit",
        "_is_ip_literal_hostname",
        "_validate_hostname",
        "validate_https_url",
        "_norm",
        "parse_seed_urls",
    }
    body = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted:
            body.append(node)
        elif isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == "MAX_URL_LEN" for target in node.targets):
                body.append(node)
    namespace = {
        "gl": types.SimpleNamespace(vm=types.SimpleNamespace(UserError=_UserError)),
        "json": json,
        "urllib": urllib,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), str(REGISTRY_SOURCE), "exec"), namespace)
    return namespace


class URLValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = _load_url_functions()
        cls.validate = staticmethod(cls.ns["validate_https_url"])
        cls.parse_seed_urls = staticmethod(cls.ns["parse_seed_urls"])

    def assert_accepts(self, url):
        self.assertEqual(self.validate(url), url)

    def assert_rejects(self, url):
        with self.assertRaises(_UserError, msg=url):
            self.validate(url)

    def test_normal_https_domains_and_explicit_443_are_accepted(self):
        for url in (
            "https://example.com/",
            "https://example.com/path",
            "https://sub.example.com/a/b?x=1",
            "https://example.com:443/path",
            "https://123.example.com/",
            "https://xn--bcher-kva.example/",
        ):
            with self.subTest(url=url):
                self.assert_accepts(url)

    def test_non_https_schemes_are_rejected(self):
        for url in (
            "http://example.com/",
            "ftp://example.com/",
            "file:///etc/passwd",
            "data:text/plain,test",
            "javascript:alert(1)",
            "https:example.com/",
            "https:///example.com/",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_localhost_names_are_rejected(self):
        for url in (
            "https://localhost/",
            "https://localhost./",
            "https://foo.localhost/",
            "https://localhost.localdomain/",
            "https://foo.local/",
            "https://ip6-loopback.local/",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_every_direct_ipv4_form_is_rejected_without_range_classification(self):
        for url in (
            "https://127.0.0.1/",
            "https://127.1/",
            "https://0.0.0.0/",
            "https://10.0.0.1/",
            "https://172.16.0.1/",
            "https://192.168.1.1/",
            "https://169.254.1.1/",
            "https://1.1.1.1/",
            "https://2130706433/",
            "https://0x7f000001/",
            "https://0177.0.0.1/",
            "https://127.0.0.1./",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_every_direct_ipv6_form_is_rejected(self):
        for url in (
            "https://[::1]/",
            "https://[::]/",
            "https://[fc00::1]/",
            "https://[fe80::1]/",
            "https://[2001:4860:4860::8888]/",
            "https://[::ffff:127.0.0.1]/",
            "https://[::ffff:7f00:1]/",
            "https://[::ffff:10.0.0.1]/",
            "https://2001:db8::1/",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_userinfo_and_authority_confusion_are_rejected(self):
        for url in (
            "https://user@example.com/",
            "https://user:pass@example.com/",
            "https://@example.com/",
            "https://example.com:443@evil.example/",
            "https://[example.com]/",
            "https://example.com]/",
            "https://[example.com/",
            "https://example.com:443:443/",
            "https://example.com:/",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_only_implicit_or_explicit_443_is_allowed(self):
        self.assert_accepts("https://example.com/")
        self.assert_accepts("https://example.com:443/")
        for url in (
            "https://example.com:80/",
            "https://example.com:8080/",
            "https://example.com:8443/",
            "https://example.com:444/",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_fragments_whitespace_controls_and_malformed_labels_are_rejected(self):
        for url in (
            " https://example.com/",
            "https://example.com/ ",
            "https://example.com/a b",
            "https://example.com/a\tb",
            "https://example.com/a\nb",
            "https://example.com/#fragment",
            "https://example.com#",
            "https://example..com/",
            "https://-example.com/",
            "https://example-.com/",
            "https://.example.com/",
            "https://example.com./",
            "https://example.123/",
            "https://exa_mple.com/",
            "https://" + ("a" * 64) + ".example/",
        ):
            with self.subTest(url=url):
                self.assert_rejects(url)

    def test_seed_parser_routes_each_item_through_the_validator(self):
        accepted = json.dumps(["https://example.com/", "https://example.com:443/path"])
        self.assertEqual(self.parse_seed_urls(accepted, 8), ["https://example.com/", "https://example.com:443/path"])
        for payload in (
            json.dumps(["https://[::ffff:127.0.0.1]/"]),
            json.dumps(["https://example.com:8080/"]),
            json.dumps(["https://user@example.com/"]),
        ):
            with self.subTest(payload=payload):
                with self.assertRaises(_UserError):
                    self.parse_seed_urls(payload, 8)

    def test_all_url_ingresses_and_resolver_defense_are_wired(self):
        registry = REGISTRY_SOURCE.read_text(encoding="utf-8")
        resolver = RESOLVER_SOURCE.read_text(encoding="utf-8")
        self.assertGreaterEqual(registry.count("validate_https_url("), 2)
        self.assertIn("seeds = parse_seed_urls(seed_urls_json", registry)
        self.assertIn("extras = parse_seed_urls(supplemental_urls_json", registry)
        self.assertIn("def _validate_urls(self, urls: list)", resolver)
        self.assertIn("registry.validate_seed_url(url)", resolver)
        self.assertIn("self._validate_urls(urls)", resolver)
        self.assertLess(resolver.index("self._validate_urls(urls)"), resolver.index("def leader_fn"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
