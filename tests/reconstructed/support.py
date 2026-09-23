"""Small source-derived harness used by the reconstructed regression suite.

The historical GenLayer test project is unavailable.  These helpers execute
the frozen contracts' deterministic functions directly from their current
source, while structural assertions inspect the actual public methods and
authorization guards.  No contract source is copied or modified.
"""

from __future__ import annotations

import ast
import hashlib
import json
import types
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"


class ContractUserError(Exception):
    """Deterministic stand-in for ``gl.vm.UserError``."""


class Address:
    """Minimal deterministic Address value for pure source-function tests."""

    def __init__(self, value):
        if isinstance(value, Address):
            self._hex = value.as_hex
        elif isinstance(value, bytes):
            self._hex = "0x" + value.hex()
        else:
            text = str(value)
            if text.startswith("addr#"):
                text = "0x" + text[5:]
            if not text.startswith("0x"):
                text = "0x" + text
            self._hex = text.lower()

    @property
    def as_hex(self):
        return self._hex

    @property
    def as_bytes(self):
        return bytes.fromhex(self._hex[2:])

    def __eq__(self, other):
        return isinstance(other, Address) and self.as_hex == other.as_hex

    def __hash__(self):
        return hash(self.as_hex)

    def __str__(self):
        return self.as_hex


class _Web:
    def render(self, *_args, **_kwargs):
        raise RuntimeError("web access is intentionally unavailable in local tests")


class _Nondet:
    web = _Web()

    def exec_prompt(self, *_args, **_kwargs):
        raise RuntimeError("LLM access is intentionally unavailable in local tests")


def _gl_namespace():
    return types.SimpleNamespace(
        vm=types.SimpleNamespace(UserError=ContractUserError),
        nondet=_Nondet(),
    )


def load_source_functions(filename: str) -> dict:
    """Load top-level constants/functions without importing GenLayer runtime.

    Class bodies and decorators are excluded.  Every function under test is
    still compiled from the immutable contract file at test time.
    """

    path = CONTRACTS / filename
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    nodes = []
    for node in tree.body:
        if isinstance(node, (ast.Assign, ast.AnnAssign, ast.FunctionDef, ast.AsyncFunctionDef)):
            nodes.append(node)
    placeholders = {
        name: type(name, (), {})
        for name in (
            "SourcePolicyView",
            "TemplateView",
            "SourcePolicyRecord",
            "TemplateRecord",
            "ProtocolEvent",
            "EventPage",
            "OwnershipView",
            "ResolverInfo",
            "RequestRecord",
            "ResolutionRecord",
            "FactRecord",
            "ProtocolConfig",
            "ProtocolStats",
            "ResolutionHistoryPage",
            "EvidenceManifestView",
            "ResolverCapabilities",
        )
    }
    namespace = {
        **placeholders,
        "Address": Address,
        "u256": int,
        "u32": int,
        "gl": _gl_namespace(),
        "hashlib": hashlib,
        "json": json,
        "urllib": urllib,
        "datetime": datetime,
        "timezone": timezone,
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), "exec"), namespace)
    return namespace


def load_text(filename: str) -> str:
    return (CONTRACTS / filename).read_text(encoding="utf-8")


def source_tree(filename: str) -> ast.Module:
    path = CONTRACTS / filename
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def public_methods(filename: str) -> dict[str, str]:
    """Return public method name -> mode from actual decorator syntax."""

    result = {}
    nodes = []
    for top in source_tree(filename).body:
        if isinstance(top, (ast.FunctionDef, ast.AsyncFunctionDef)):
            nodes.append(top)
        elif isinstance(top, ast.ClassDef):
            nodes.extend(
                child
                for child in top.body
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef))
            )
    for node in nodes:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            text = ast.unparse(decorator)
            if text in {"gl.public.view", "gl.public.write", "gl.public.write.payable"}:
                result[node.name] = "view" if text == "gl.public.view" else "write"
    return result


def function_source(filename: str, name: str) -> str:
    tree = source_tree(filename)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return ast.get_source_segment(load_text(filename), node) or ""
    raise KeyError(name)


def expect_user_error(callable_, code: str | None = None):
    try:
        callable_()
    except ContractUserError as exc:
        if code is not None:
            assert str(exc) == code, (str(exc), code)
        return str(exc)
    raise AssertionError("expected ContractUserError")


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def json_load(value: str):
    return json.loads(value)
