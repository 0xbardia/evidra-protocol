# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""EvidraRegistry — request lifecycle, canonical facts, fees, and callbacks."""

import genlayer as gl
from genlayer.storage import TreeMap, DynArray, allow as allow_storage
from genlayer.types import Address, u256, u32
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import urllib.parse


ZERO = Address("0x0000000000000000000000000000000000000000")
MAX_PAGE = 50
MAX_INITIAL_SEED_SOURCES = 8
MAX_SUPPLEMENTAL_SOURCES = 6
MAX_TOTAL_RESOLUTION_SOURCES = 12
MAX_URLS = MAX_INITIAL_SEED_SOURCES
MAX_URL_LEN = 2048
MAX_TEXT = 1024
MAX_DESC = 2048
SCHEMA_V1 = "1"
ZERO_TEMPLATE_HASH = ""
OUTCOMES = ("TRUE", "FALSE", "UNRESOLVED")
DIAGNOSTICS = (
    "NONE",
    "AMBIGUOUS",
    "INSUFFICIENT_EVIDENCE",
    "CONFLICTING_EVIDENCE",
    "SOURCE_POLICY_UNSATISFIED",
    "SOURCE_UNAVAILABLE",
    "INTERNAL_RESOLUTION_ERROR",
)
REUSE_IF_FRESH = "REUSE_IF_FRESH"
FORCE_FRESH = "FORCE_FRESH_RESOLUTION"
IMMUTABLE = "IMMUTABLE"
MUTABLE_TTL = "MUTABLE_WITH_TTL"
STATUS_PENDING = "PENDING"
STATUS_DISPATCHED = "DISPATCHED"
STATUS_RESOLVED = "RESOLVED"
STATUS_REUSED = "REUSED"
STATUS_CANCELLED = "CANCELLED"
STATUS_FAILED = "FAILED"
CB_NONE = "NOT_REQUESTED"
CB_DISPATCHED = "DISPATCHED"
CB_ACKNOWLEDGED = "ACKNOWLEDGED"
CB_FAILED_REPORTED = "FAILED_REPORTED"


def _now() -> u256:
    return u256(int(datetime.now(timezone.utc).timestamp()))


def _norm(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _sha256_hex(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _require(cond: bool, code: str) -> None:
    if not cond:
        raise gl.vm.UserError(code)


def _view_field(rec, name: str):
    """Studio Dev IC-to-IC views return dicts; local/direct tests may return dataclasses."""
    if rec is None:
        return None
    if isinstance(rec, dict):
        return rec.get(name)
    return getattr(rec, name)


def _bounded(value: str, max_len: int, code: str) -> str:
    text = value.strip()
    _require(len(text) > 0 and len(text) <= max_len, code)
    return text


def _bounded_opt(value: str, max_len: int, code: str) -> str:
    text = value.strip()
    _require(len(text) <= max_len, code)
    return text


def _is_ascii_letter(ch: str) -> bool:
    return ("a" <= ch <= "z") or ("A" <= ch <= "Z")


def _is_ascii_digit(ch: str) -> bool:
    return "0" <= ch <= "9"


def _is_ip_literal_hostname(host: str) -> bool:
    """Reject numeric and colon-form hosts without classifying IP ranges."""
    if ":" in host:
        return True
    labels = host.split(".")
    if len(labels) == 0:
        return True
    for label in labels:
        if label == "":
            return False
        all_digits = True
        for ch in label:
            if not _is_ascii_digit(ch):
                all_digits = False
                break
        if not all_digits:
            return False
    return True


def _validate_hostname(host: str) -> None:
    _require(host != "" and host == host.lower(), "INVALID_URL")
    _require("." in host and not host.startswith(".") and not host.endswith("."), "INVALID_URL")
    _require(len(host) <= 253, "INVALID_URL")
    _require(not _is_ip_literal_hostname(host), "INVALID_URL")
    labels = host.split(".")
    _require(len(labels) >= 2, "INVALID_URL")
    for label in labels:
        _require(0 < len(label) <= 63, "INVALID_URL")
        _require(_is_ascii_letter(label[0]) or _is_ascii_digit(label[0]), "INVALID_URL")
        _require(_is_ascii_letter(label[-1]) or _is_ascii_digit(label[-1]), "INVALID_URL")
        for ch in label:
            _require(_is_ascii_letter(ch) or _is_ascii_digit(ch) or ch == "-", "INVALID_URL")
    tld = labels[-1]
    _require(any(_is_ascii_letter(ch) for ch in tld), "INVALID_URL")
    _require(
        host not in (
            "localhost",
            "localhost.localdomain",
            "local",
            "localdomain",
            "broadcasthost",
            "ip6-localhost",
            "ip6-loopback",
        ),
        "INVALID_URL",
    )
    _require(
        not (
            host.endswith(".localhost")
            or host.endswith(".local")
            or host.endswith(".localdomain")
        ),
        "INVALID_URL",
    )


def validate_https_url(url: str) -> str:
    _require(isinstance(url, str), "INVALID_URL")
    _require(url == url.strip(), "INVALID_URL")
    _require(len(url) > 0 and len(url) <= MAX_URL_LEN, "INVALID_URL")
    for ch in url:
        _require(ord(ch) > 0x20 and ord(ch) != 0x7F and not ch.isspace(), "INVALID_URL")
    try:
        parsed = urllib.parse.urlparse(url)
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except Exception:
        raise gl.vm.UserError("INVALID_URL")
    _require(parsed.scheme.lower() == "https" and parsed.netloc != "", "INVALID_URL")
    _require("#" not in url, "INVALID_URL")
    _require("@" not in parsed.netloc, "INVALID_URL")
    _require("[" not in parsed.netloc and "]" not in parsed.netloc, "INVALID_URL")
    authority = parsed.netloc
    _require(authority.count(":") <= 1, "INVALID_URL")
    if ":" in authority:
        explicit_port = authority.rsplit(":", 1)[1]
        _require(explicit_port != "" and all(_is_ascii_digit(ch) for ch in explicit_port), "INVALID_URL")
        _require(port == 443, "INVALID_URL")
    else:
        _require(port is None, "INVALID_URL")
    _validate_hostname(host)
    return url


def parse_seed_urls(seed_urls_json: str, max_urls: int) -> list:
    text = seed_urls_json.strip()
    if text == "":
        return []
    try:
        data = json.loads(text)
    except Exception:
        raise gl.vm.UserError("INVALID_PARAM")
    _require(isinstance(data, list), "INVALID_PARAM")
    _require(len(data) <= max_urls, "TOO_MANY_SEEDS")
    out = []
    seen = {}
    for item in data:
        _require(isinstance(item, str), "INVALID_URL")
        url = validate_https_url(item)
        key = _norm(url)
        if key in seen:
            continue
        seen[key] = True
        out.append(url)
    return out


def canonical_claim_payload(
    subject: str,
    predicate: str,
    object_value: str,
    qualifiers: str,
    temporal: str,
    mutability: str,
) -> str:
    body = {
        "mutability": _norm(mutability),
        "object_value": _norm(object_value),
        "predicate": _norm(predicate),
        "qualifiers": _norm(qualifiers),
        "subject": _norm(subject),
        "temporal": _norm(temporal),
    }
    return json.dumps(body, sort_keys=True, separators=(",", ":"))


def compute_claim_key_value(
    subject: str,
    predicate: str,
    object_value: str,
    qualifiers: str,
    temporal: str,
    mutability: str,
) -> str:
    return _sha256_hex("EVIDRA_CLAIM_V1|" + canonical_claim_payload(subject, predicate, object_value, qualifiers, temporal, mutability))


def compute_fact_key_value(claim_key: str, policy_hash: str, schema_version: str, template_hash: str = "") -> str:
    th = (template_hash or "").strip().lower()
    body = {
        "claim_key": claim_key.strip().lower(),
        "policy_hash": policy_hash.strip().lower(),
        "schema_version": _norm(schema_version),
        "template_hash": th,
    }
    return _sha256_hex("EVIDRA_FACT_V1|" + json.dumps(body, sort_keys=True, separators=(",", ":")))


def compute_spec_hash_value(
    subject: str,
    predicate: str,
    object_value: str,
    qualifiers: str,
    temporal: str,
    mutability: str,
    schema_version: str,
    ttl_seconds: int,
    description: str,
    seed_urls: list,
) -> str:
    body = {
        "description": description.strip(),
        "mutability": _norm(mutability),
        "object_value": _norm(object_value),
        "predicate": _norm(predicate),
        "qualifiers": _norm(qualifiers),
        "schema_version": _norm(schema_version),
        "seed_urls": [_norm(u) for u in seed_urls],
        "subject": _norm(subject),
        "temporal": _norm(temporal),
        "ttl_seconds": ttl_seconds,
    }
    return _sha256_hex("EVIDRA_SPEC_V1|" + json.dumps(body, sort_keys=True, separators=(",", ":")))


def parse_name_list(raw: str) -> list:
    text = (raw or "").strip()
    if text == "":
        return []
    items = []
    if text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                items = [str(x) for x in data]
        except Exception:
            items = []
    if len(items) == 0:
        for part in text.replace(";", ",").split(","):
            if part.strip() != "":
                items.append(part)
    out = []
    seen = {}
    for item in items:
        n = _norm(item)
        if n == "" or n in seen:
            continue
        seen[n] = True
        out.append(n)
    return out


def template_fact_type_compatible(fact_type: str, mutability: str) -> bool:
    ft = _norm(fact_type)
    mut = mutability.strip().upper()
    if "immutable" in ft:
        return mut == IMMUTABLE
    if "ttl" in ft or "mutable" in ft:
        return mut == MUTABLE_TTL
    return True


def required_fields_present(required_raw: str, fields: dict) -> bool:
    for name in parse_name_list(required_raw):
        if name not in fields:
            return False
        val = fields[name]
        if val is None:
            return False
        if isinstance(val, str) and val.strip() == "":
            return False
    return True


def compute_callback_id_value(request_id: int, resolution_id: int, consumer_hex: str) -> str:
    body = "EVIDRA_CB_V1|" + str(int(request_id)) + "|" + str(int(resolution_id)) + "|" + consumer_hex.strip().lower()
    return _sha256_hex(body)


def freshness_allows_reuse(
    mutability: str,
    outcome: str,
    resolved_at: int,
    valid_until: int,
    requested_ttl: int,
    now: int,
) -> bool:
    if outcome not in ("TRUE", "FALSE"):
        return False
    if mutability == IMMUTABLE:
        return True
    if now > int(valid_until):
        return False
    age = int(now) - int(resolved_at)
    if age < 0:
        age = 0
    if int(requested_ttl) <= 0:
        return False
    return age <= int(requested_ttl)


def should_advance_canonical(prev_exists: bool, prev_outcome: str, new_outcome: str, policy_satisfied: bool) -> bool:
    if new_outcome in ("TRUE", "FALSE") and policy_satisfied:
        return True
    if not prev_exists:
        return True
    if prev_outcome not in ("TRUE", "FALSE"):
        return True
    return False


def next_history_version(prev_exists: bool, prev_version: int) -> int:
    """Monotonic attempt version. Independent of whether canonical head advanced."""
    if not prev_exists:
        return 1
    return int(prev_version) + 1


def history_supersedes_id(prev_exists: bool, prev_resolution_id: int) -> int:
    """Immediately previous historical attempt, not merely previous canonical head."""
    if not prev_exists:
        return 0
    return int(prev_resolution_id)


def callback_ack_sender_allowed(sender_hex: str, callback_target_hex: str) -> bool:
    target = (callback_target_hex or "").strip().lower()
    sender = (sender_hex or "").strip().lower()
    if target == "" or target == ZERO.as_hex.lower():
        return False
    return sender == target





@allow_storage
@dataclass
class SourcePolicyView:
    exists: bool
    policy_id: str
    version: u32
    name: str
    active: bool
    min_primary_sources: u32
    min_independent_sources: u32
    allowed_classes: str
    disallowed_classes: str
    require_cross_check: bool
    semantic_rules: str
    policy_hash: str
    published_at: u256
    deprecated: bool


@allow_storage
@dataclass
class TemplateView:
    exists: bool
    template_id: str
    version: u32
    name: str
    active: bool
    fact_type: str
    required_fields: str
    resolution_instructions: str
    default_policy_id: str
    default_policy_version: u32
    template_hash: str
    published_at: u256
    deprecated: bool


@gl.contract.interface
class EvidraPolicyRegistryIfc:
    class View:
        def get_source_policy(self, policy_id: str, version: u32) -> SourcePolicyView: ...
        def is_source_policy_active(self, policy_id: str, version: u32) -> bool: ...
        def get_template(self, template_id: str, version: u32) -> TemplateView: ...
        def is_template_active(self, template_id: str, version: u32) -> bool: ...
        def get_policy_hash(self, policy_id: str, version: u32) -> str: ...

    class Write:
        pass


@gl.contract.interface
class EvidraResolverIfc:
    class View:
        def get_resolver_version(self) -> str: ...

    class Write:
        def resolve_request(self, request_id: u256, attempt_id: u256) -> None: ...


@gl.contract.interface
class IEvidraConsumer:
    """Fixed consumer callback interface. Requesters cannot choose a method name."""

    class View:
        pass

    class Write:
        def on_evidra_result(
            self,
            request_id: u256,
            fact_key: str,
            resolution_id: u256,
            outcome: str,
            resolved_at: u256,
            valid_until: u256,
            callback_id: str,
        ) -> None: ...


@allow_storage
@dataclass
class ResolverInfo:
    exists: bool
    resolver: Address
    enabled: bool
    resolver_version: str
    capabilities: str
    registered_at: u256


@allow_storage
@dataclass
class RequestRecord:
    exists: bool
    request_id: u256
    requester: Address
    claim_key: str
    fact_key: str
    spec_hash: str
    policy_hash: str
    policy_id: str
    policy_version: u32
    assigned_resolver: Address
    created_at: u256
    status: str
    active_attempt_id: u256
    last_attempt_at: u256
    retry_after: u256
    max_attempts: u32
    attempt_count: u32
    callback_target: Address
    callback_status: str
    reuse_mode: str
    fee_paid: u256
    mutability: str
    schema_version: str
    ttl_seconds: u256
    seed_urls_json: str
    subject: str
    predicate: str
    object_value: str
    qualifiers: str
    temporal: str
    description: str
    current_resolution_id: u256
    supplemental_urls_json: str
    template_id: str
    template_version: u32
    template_hash: str
    fact_type: str
    template_resolution_instructions: str


@allow_storage
@dataclass
class ResolutionRecord:
    exists: bool
    resolution_id: u256
    request_id: u256
    attempt_id: u256
    claim_key: str
    fact_key: str
    spec_hash: str
    policy_hash: str
    outcome: str
    diagnostic_reason: str
    policy_satisfied: bool
    resolver_version: str
    evidence_manifest_hash: str
    reasoning_summary: str
    evaluated_at: u256
    committed_at: u256
    valid_until: u256
    resolution_version: u32
    supersedes_resolution_id: u256
    template_id: str
    template_version: u32
    template_hash: str


@allow_storage
@dataclass
class FactRecord:
    exists: bool
    fact_key: str
    claim_key: str
    policy_hash: str
    schema_version: str
    mutability: str
    current_resolution_id: u256
    latest_resolution_id: u256
    current_request_id: u256
    current_outcome: str
    resolved_at: u256
    valid_until: u256
    resolution_version: u32
    template_hash: str


@allow_storage
@dataclass
class ProtocolConfig:
    owner: Address
    pending_owner: Address
    guardian: Address
    policy_registry: Address
    default_resolver: Address
    paused_new_requests: bool
    fee_base: u256
    fee_per_attempt: u256
    fee_reuse: u256
    retry_delay_seconds: u256
    stale_after_seconds: u256
    max_attempts: u32
    max_seed_urls: u32
    schema_version: str
    registry_version: str


@allow_storage
@dataclass
class ProtocolStats:
    request_count: u256
    resolution_count: u256
    reused_count: u256
    paused: bool
    event_count: u256


@allow_storage
@dataclass
class ProtocolEvent:
    index: u256
    topic: str
    payload: str
    timestamp: u256


@allow_storage
@dataclass
class EventPage:
    offset: u32
    limit: u32
    total: u32
    items_json: str


@allow_storage
@dataclass
class ResolutionHistoryPage:
    fact_key: str
    offset: u32
    limit: u32
    total: u32
    resolution_ids_json: str


@allow_storage
@dataclass
class EvidenceManifestView:
    exists: bool
    resolution_id: u256
    manifest_hash: str
    manifest_json: str


class EvidraRegistry(gl.contract.Contract):
    owner: Address
    pending_owner: Address
    guardian: Address
    policy_registry: Address
    default_resolver: Address
    paused_new_requests: bool
    fee_base: u256
    fee_per_attempt: u256
    fee_reuse: u256
    retry_delay_seconds: u256
    stale_after_seconds: u256
    max_attempts: u32
    max_seed_urls: u32
    next_request_id: u256
    next_resolution_id: u256
    reused_count: u256
    requests: TreeMap[u256, RequestRecord]
    resolutions: TreeMap[u256, ResolutionRecord]
    facts: TreeMap[str, FactRecord]
    fact_history: TreeMap[str, str]
    evidence_manifests: TreeMap[u256, str]
    resolvers: TreeMap[Address, ResolverInfo]
    credits: TreeMap[Address, u256]
    events: DynArray[ProtocolEvent]

    def __init__(self, policy_registry: str):
        addr = Address(policy_registry)
        _require(addr != ZERO, "ZERO_ADDRESS")
        self.owner = gl.message.sender_address
        self.pending_owner = ZERO
        self.guardian = gl.message.sender_address
        self.policy_registry = addr
        self.default_resolver = ZERO
        self.paused_new_requests = False
        self.fee_base = u256(0)
        self.fee_per_attempt = u256(0)
        self.fee_reuse = u256(0)
        self.retry_delay_seconds = u256(60)
        self.stale_after_seconds = u256(86400)
        self.max_attempts = u32(5)
        self.max_seed_urls = u32(MAX_URLS)
        self.next_request_id = u256(1)
        self.next_resolution_id = u256(1)
        self.reused_count = u256(0)

    def _only_owner(self) -> None:
        _require(gl.message.sender_address == self.owner, "NOT_OWNER")

    def _only_guardian(self) -> None:
        sender = gl.message.sender_address
        _require(sender == self.guardian or sender == self.owner, "NOT_GUARDIAN")

    def _log(self, topic: str, payload: str) -> None:
        idx = u256(len(self.events))
        self.events.append(ProtocolEvent(index=idx, topic=topic, payload=payload, timestamp=_now()))
        print("EVIDRA_EVENT " + topic + " " + payload)

    def _empty_request(self) -> RequestRecord:
        return RequestRecord(
            exists=False,
            request_id=u256(0),
            requester=ZERO,
            claim_key="",
            fact_key="",
            spec_hash="",
            policy_hash="",
            policy_id="",
            policy_version=u32(0),
            assigned_resolver=ZERO,
            created_at=u256(0),
            status="",
            active_attempt_id=u256(0),
            last_attempt_at=u256(0),
            retry_after=u256(0),
            max_attempts=u32(0),
            attempt_count=u32(0),
            callback_target=ZERO,
            callback_status=CB_NONE,
            reuse_mode="",
            fee_paid=u256(0),
            mutability="",
            schema_version="",
            ttl_seconds=u256(0),
            seed_urls_json="[]",
            subject="",
            predicate="",
            object_value="",
            qualifiers="",
            temporal="",
            description="",
            current_resolution_id=u256(0),
            supplemental_urls_json="[]",
            template_id="",
            template_version=u32(0),
            template_hash="",
            fact_type="",
            template_resolution_instructions="",
        )

    def _empty_resolution(self) -> ResolutionRecord:
        return ResolutionRecord(
            exists=False,
            resolution_id=u256(0),
            request_id=u256(0),
            attempt_id=u256(0),
            claim_key="",
            fact_key="",
            spec_hash="",
            policy_hash="",
            outcome="",
            diagnostic_reason="",
            policy_satisfied=False,
            resolver_version="",
            evidence_manifest_hash="",
            reasoning_summary="",
            evaluated_at=u256(0),
            committed_at=u256(0),
            valid_until=u256(0),
            resolution_version=u32(0),
            supersedes_resolution_id=u256(0),
            template_id="",
            template_version=u32(0),
            template_hash="",
        )

    def _empty_fact(self) -> FactRecord:
        return FactRecord(
            exists=False,
            fact_key="",
            claim_key="",
            policy_hash="",
            schema_version="",
            mutability="",
            current_resolution_id=u256(0),
            latest_resolution_id=u256(0),
            current_request_id=u256(0),
            current_outcome="",
            resolved_at=u256(0),
            valid_until=u256(0),
            resolution_version=u32(0),
            template_hash="",
        )

    def _empty_resolver(self, addr: Address) -> ResolverInfo:
        return ResolverInfo(
            exists=False,
            resolver=addr,
            enabled=False,
            resolver_version="",
            capabilities="",
            registered_at=u256(0),
        )

    def _credit(self, who: Address, amount: u256) -> None:
        if int(amount) == 0 or who == ZERO:
            return
        current = self.credits.get(who, u256(0))
        self.credits[who] = current + amount
        self._log(
            "CreditCreated",
            json.dumps({"address": who.as_hex, "amount": int(amount)}, sort_keys=True, separators=(",", ":")),
        )

    def _take_payment(self, required: u256) -> u256:
        value = u256(0)
        try:
            value = gl.message.value
        except Exception:
            value = u256(0)
        if int(value) < int(required):
            raise gl.vm.UserError("FEE_INSUFFICIENT")
        extra = u256(int(value) - int(required))
        if int(extra) > 0:
            self._credit(gl.message.sender_address, extra)
        return required

    def _load_policy(self, policy_id: str, policy_version: u32) -> dict:
        pol = EvidraPolicyRegistryIfc(self.policy_registry)
        rec = pol.view().get_source_policy(policy_id, policy_version)
        exists = bool(_view_field(rec, "exists"))
        _require(exists, "UNKNOWN_POLICY")
        active = bool(_view_field(rec, "active"))
        deprecated = bool(_view_field(rec, "deprecated"))
        _require(active and (not deprecated), "POLICY_INACTIVE")
        return {
            "policy_hash": str(_view_field(rec, "policy_hash") or ""),
            "policy_id": str(_view_field(rec, "policy_id") or policy_id),
            "version": u32(int(_view_field(rec, "version") or policy_version)),
        }

    def _quote(self, reuse_hit: bool) -> u256:
        if reuse_hit:
            return self.fee_reuse
        return self.fee_base + self.fee_per_attempt

    def _fact_is_fresh(self, fact: FactRecord) -> bool:
        if not fact.exists:
            return False
        if fact.current_outcome not in ("TRUE", "FALSE"):
            return False
        if fact.mutability == IMMUTABLE:
            return True
        now = int(_now())
        return now <= int(fact.valid_until)

    def _can_reuse(
        self,
        fact: FactRecord,
        policy_hash: str,
        schema_version: str,
        reuse_mode: str,
        requested_ttl: int,
        template_hash: str,
    ) -> bool:
        if reuse_mode != REUSE_IF_FRESH:
            return False
        if not fact.exists:
            return False
        if fact.policy_hash != policy_hash:
            return False
        if _norm(fact.schema_version) != _norm(schema_version):
            return False
        incoming_th = (template_hash or "").strip().lower()
        stored_th = (fact.template_hash or "").strip().lower()
        if incoming_th != "" or stored_th != "":
            if incoming_th != stored_th:
                return False
        return freshness_allows_reuse(
            fact.mutability,
            fact.current_outcome,
            int(fact.resolved_at),
            int(fact.valid_until),
            int(requested_ttl),
            int(_now()),
        )

    def _append_history(self, fact_key: str, resolution_id: u256) -> None:
        raw = self.fact_history.get(fact_key, "[]")
        try:
            ids = json.loads(raw)
        except Exception:
            ids = []
        if not isinstance(ids, list):
            ids = []
        ids.append(int(resolution_id))
        self.fact_history[fact_key] = json.dumps(ids, separators=(",", ":"))

    def _emit_callback(self, req: RequestRecord, resolution_id: u256, outcome: str, resolved_at: u256, valid_until: u256) -> str:
        if req.callback_target == ZERO:
            return CB_NONE
        cid = compute_callback_id_value(int(req.request_id), int(resolution_id), req.callback_target.as_hex)
        consumer = IEvidraConsumer(req.callback_target)
        consumer.emit(on="finalized").on_evidra_result(
            req.request_id,
            req.fact_key,
            resolution_id,
            outcome,
            resolved_at,
            valid_until,
            cid,
        )
        self._log(
            "CallbackRequested",
            json.dumps(
                {
                    "callback_id": cid,
                    "request_id": int(req.request_id),
                    "resolution_id": int(resolution_id),
                    "target": req.callback_target.as_hex,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        return CB_DISPATCHED

    def _dispatch(self, req: RequestRecord) -> None:
        _require(req.assigned_resolver != ZERO, "NO_DEFAULT_RESOLVER")
        info = self.resolvers.get(req.assigned_resolver, self._empty_resolver(req.assigned_resolver))
        _require(info.exists and info.enabled, "RESOLVER_DISABLED")
        EvidraResolverIfc(req.assigned_resolver).emit(on="finalized").resolve_request(
            req.request_id, req.active_attempt_id
        )
        req.status = STATUS_DISPATCHED
        req.last_attempt_at = _now()
        req.retry_after = req.last_attempt_at + self.retry_delay_seconds
        self.requests[req.request_id] = req
        self._log(
            "ResolutionDispatched",
            json.dumps(
                {
                    "attempt_id": int(req.active_attempt_id),
                    "request_id": int(req.request_id),
                    "resolver": req.assigned_resolver.as_hex,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )

    def _create_request(
        self,
        subject: str,
        predicate: str,
        object_value: str,
        qualifiers: str,
        temporal: str,
        mutability: str,
        schema_version: str,
        ttl_seconds: u256,
        description: str,
        policy_id: str,
        policy_version: u32,
        seed_urls_json: str,
        callback_target: str,
        reuse_mode: str,
        supplemental_urls_json: str,
        force_new: bool,
        template_id: str,
        template_version: u32,
        template_hash: str,
        fact_type: str,
        template_resolution_instructions: str,
    ) -> u256:
        if not force_new:
            _require(not self.paused_new_requests, "PAUSED")
        sub = _bounded(subject, MAX_TEXT, "INVALID_PARAM")
        pred = _bounded(predicate, MAX_TEXT, "INVALID_PARAM")
        obj = _bounded_opt(object_value, MAX_TEXT, "INVALID_PARAM")
        quals = _bounded_opt(qualifiers, MAX_TEXT, "INVALID_PARAM")
        temp = _bounded_opt(temporal, MAX_TEXT, "INVALID_PARAM")
        mut = mutability.strip().upper()
        _require(mut in (IMMUTABLE, MUTABLE_TTL), "INVALID_PARAM")
        schema = schema_version.strip()
        if schema == "":
            schema = SCHEMA_V1
        _require(_norm(schema) == SCHEMA_V1, "INVALID_PARAM")
        desc = _bounded_opt(description, MAX_DESC, "INVALID_PARAM")
        pid = _bounded(policy_id, 64, "INVALID_PARAM")
        _require(int(policy_version) >= 1, "INVALID_PARAM")
        mode = reuse_mode.strip().upper()
        if mode == "":
            mode = REUSE_IF_FRESH
        _require(mode in (REUSE_IF_FRESH, FORCE_FRESH), "INVALID_PARAM")
        if mut == MUTABLE_TTL:
            _require(int(ttl_seconds) > 0, "INVALID_PARAM")
        seeds = parse_seed_urls(seed_urls_json, int(self.max_seed_urls))
        extras = parse_seed_urls(supplemental_urls_json, MAX_SUPPLEMENTAL_SOURCES)
        policy = self._load_policy(pid, policy_version)
        claim_key = compute_claim_key_value(sub, pred, obj, quals, temp, mut)
        spec_hash = compute_spec_hash_value(sub, pred, obj, quals, temp, mut, schema, int(ttl_seconds), desc, seeds)
        th = (template_hash or "").strip().lower()
        fact_key = compute_fact_key_value(claim_key, policy["policy_hash"], schema, th)
        fact = self.facts.get(fact_key, self._empty_fact())
        reuse_hit = (not force_new) and self._can_reuse(
            fact,
            policy["policy_hash"],
            schema,
            mode,
            int(ttl_seconds),
            template_hash,
        )
        fee = self._quote(reuse_hit)
        paid = self._take_payment(fee)
        cb = ZERO
        if callback_target.strip() != "":
            cb = Address(callback_target)
        assigned = self.default_resolver
        _require(assigned != ZERO, "NO_DEFAULT_RESOLVER")
        info = self.resolvers.get(assigned, self._empty_resolver(assigned))
        _require(info.exists and info.enabled, "RESOLVER_DISABLED")
        rid = self.next_request_id
        self.next_request_id = rid + u256(1)
        now = _now()
        req = RequestRecord(
            exists=True,
            request_id=rid,
            requester=gl.message.sender_address,
            claim_key=claim_key,
            fact_key=fact_key,
            spec_hash=spec_hash,
            policy_hash=policy["policy_hash"],
            policy_id=pid,
            policy_version=policy_version,
            assigned_resolver=assigned,
            created_at=now,
            status=STATUS_PENDING,
            active_attempt_id=u256(1),
            last_attempt_at=u256(0),
            retry_after=u256(0),
            max_attempts=self.max_attempts,
            attempt_count=u32(0),
            callback_target=cb,
            callback_status=CB_NONE,
            reuse_mode=mode,
            fee_paid=paid,
            mutability=mut,
            schema_version=schema,
            ttl_seconds=ttl_seconds,
            seed_urls_json=json.dumps(seeds, separators=(",", ":")),
            subject=sub,
            predicate=pred,
            object_value=obj,
            qualifiers=quals,
            temporal=temp,
            description=desc,
            current_resolution_id=u256(0),
            supplemental_urls_json=json.dumps(extras, separators=(",", ":")),
            template_id=template_id,
            template_version=template_version,
            template_hash=template_hash,
            fact_type=fact_type,
            template_resolution_instructions=template_resolution_instructions,
        )
        self._log(
            "FactRequested",
            json.dumps(
                {
                    "claim_key": claim_key,
                    "fact_key": fact_key,
                    "request_id": int(rid),
                    "reuse": reuse_hit,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        if reuse_hit:
            req.status = STATUS_REUSED
            req.current_resolution_id = fact.current_resolution_id
            req.attempt_count = u32(0)
            req.callback_status = self._emit_callback(
                req, fact.current_resolution_id, fact.current_outcome, fact.resolved_at, fact.valid_until
            )
            self.requests[rid] = req
            self.reused_count = self.reused_count + u256(1)
            self._log(
                "FactReused",
                json.dumps(
                    {
                        "fact_key": fact_key,
                        "request_id": int(rid),
                        "resolution_id": int(fact.current_resolution_id),
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                ),
            )
            return rid
        req.attempt_count = u32(1)
        self.requests[rid] = req
        self._dispatch(req)
        return rid

    @gl.public.write.payable
    def request_fact(
        self,
        subject: str,
        predicate: str,
        object_value: str,
        qualifiers: str,
        temporal: str,
        mutability: str,
        schema_version: str,
        ttl_seconds: u256,
        description: str,
        policy_id: str,
        policy_version: u32,
        seed_urls_json: str,
        callback_target: str,
        reuse_mode: str,
    ) -> u256:
        return self._create_request(
            subject,
            predicate,
            object_value,
            qualifiers,
            temporal,
            mutability,
            schema_version,
            ttl_seconds,
            description,
            policy_id,
            policy_version,
            seed_urls_json,
            callback_target,
            reuse_mode,
            "[]",
            False,
            "",
            u32(0),
            "",
            "",
            "",
        )

    @gl.public.write.payable
    def request_fact_by_template(
        self,
        template_id: str,
        template_version: u32,
        subject: str,
        predicate: str,
        object_value: str,
        qualifiers: str,
        temporal: str,
        mutability: str,
        ttl_seconds: u256,
        description: str,
        seed_urls_json: str,
        callback_target: str,
        reuse_mode: str,
    ) -> u256:
        _require(not self.paused_new_requests, "PAUSED")
        tid = _bounded(template_id, 64, "INVALID_PARAM")
        pol = EvidraPolicyRegistryIfc(self.policy_registry)
        tmpl = pol.view().get_template(tid, template_version)
        _require(bool(_view_field(tmpl, "exists")), "UNKNOWN_TEMPLATE")
        _require(bool(_view_field(tmpl, "active")) and (not bool(_view_field(tmpl, "deprecated"))), "TEMPLATE_INACTIVE")
        default_policy_id = str(_view_field(tmpl, "default_policy_id") or "")
        _require(default_policy_id != "", "INVALID_PARAM")
        template_hash = str(_view_field(tmpl, "template_hash") or "")
        _require(template_hash != "", "INVALID_PARAM")
        fact_type = str(_view_field(tmpl, "fact_type") or "")
        required_fields = str(_view_field(tmpl, "required_fields") or "")
        mut = mutability.strip().upper()
        _require(template_fact_type_compatible(fact_type, mut), "TEMPLATE_FACT_TYPE")
        fields = {
            "description": description,
            "mutability": mut,
            "object_value": object_value,
            "predicate": predicate,
            "qualifiers": qualifiers,
            "subject": subject,
            "temporal": temporal,
        }
        _require(required_fields_present(required_fields, fields), "TEMPLATE_REQUIRED_FIELD")
        desc = _bounded_opt(description, MAX_DESC, "INVALID_PARAM")
        instructions = str(_view_field(tmpl, "resolution_instructions") or "")
        default_policy_version = u32(int(_view_field(tmpl, "default_policy_version") or 0))
        return self._create_request(
            subject,
            predicate,
            object_value,
            qualifiers,
            temporal,
            mutability,
            SCHEMA_V1,
            ttl_seconds,
            desc,
            default_policy_id,
            default_policy_version,
            seed_urls_json,
            callback_target,
            reuse_mode,
            "[]",
            False,
            tid,
            template_version,
            template_hash,
            fact_type,
            instructions,
        )

    @gl.public.write.payable
    def refresh_fact(self, fact_key: str, seed_urls_json: str, callback_target: str) -> u256:
        _require(not self.paused_new_requests, "PAUSED")
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        _require(fact.exists, "UNKNOWN_FACT")
        _require(fact.mutability == MUTABLE_TTL, "ALREADY_RESOLVED_IMMUTABLE")
        current = self.resolutions.get(fact.current_resolution_id, self._empty_resolution())
        req_prev = self.requests.get(fact.current_request_id, self._empty_request())
        _require(req_prev.exists, "UNKNOWN_REQUEST")
        seeds = seed_urls_json
        if seeds.strip() == "":
            seeds = req_prev.seed_urls_json
        return self._create_request(
            req_prev.subject,
            req_prev.predicate,
            req_prev.object_value,
            req_prev.qualifiers,
            req_prev.temporal,
            req_prev.mutability,
            req_prev.schema_version,
            req_prev.ttl_seconds,
            req_prev.description,
            req_prev.policy_id,
            req_prev.policy_version,
            seeds,
            callback_target,
            FORCE_FRESH,
            "[]",
            False,
            req_prev.template_id,
            req_prev.template_version,
            req_prev.template_hash,
            req_prev.fact_type,
            req_prev.template_resolution_instructions,
        )

    @gl.public.write.payable
    def request_reassessment(self, fact_key: str, supplemental_urls_json: str, notes: str, callback_target: str) -> u256:
        _require(not self.paused_new_requests, "PAUSED")
        _bounded_opt(notes, MAX_DESC, "INVALID_PARAM")
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        _require(fact.exists, "UNKNOWN_FACT")
        req_prev = self.requests.get(fact.current_request_id, self._empty_request())
        _require(req_prev.exists, "UNKNOWN_REQUEST")
        rid = self._create_request(
            req_prev.subject,
            req_prev.predicate,
            req_prev.object_value,
            req_prev.qualifiers,
            req_prev.temporal,
            req_prev.mutability,
            req_prev.schema_version,
            req_prev.ttl_seconds,
            req_prev.description,
            req_prev.policy_id,
            req_prev.policy_version,
            req_prev.seed_urls_json,
            callback_target,
            FORCE_FRESH,
            supplemental_urls_json,
            False,
            req_prev.template_id,
            req_prev.template_version,
            req_prev.template_hash,
            req_prev.fact_type,
            req_prev.template_resolution_instructions,
        )
        self._log(
            "ReassessmentRequested",
            json.dumps(
                {"fact_key": fact.fact_key, "notes": notes.strip(), "request_id": int(rid)},
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        return rid

    @gl.public.write.payable
    def retry_resolution(self, request_id: u256) -> u256:
        req = self.requests.get(request_id, self._empty_request())
        _require(req.exists, "UNKNOWN_REQUEST")
        _require(gl.message.sender_address == req.requester or gl.message.sender_address == self.owner, "UNAUTHORIZED")
        _require(req.status in (STATUS_PENDING, STATUS_DISPATCHED), "NOTHING_TO_RETRY")
        _require(int(req.attempt_count) < int(req.max_attempts), "MAX_ATTEMPTS")
        _require(int(_now()) >= int(req.retry_after), "NOT_STALE")
        paid = self._take_payment(self.fee_per_attempt)
        req.fee_paid = req.fee_paid + paid
        req.active_attempt_id = req.active_attempt_id + u256(1)
        req.attempt_count = u32(int(req.attempt_count) + 1)
        req.status = STATUS_PENDING
        self.requests[request_id] = req
        self._log(
            "ResolutionRetry",
            json.dumps(
                {"attempt_id": int(req.active_attempt_id), "request_id": int(request_id)},
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        self._dispatch(req)
        return req.active_attempt_id

    @gl.public.write
    def cancel_stale_request(self, request_id: u256) -> None:
        req = self.requests.get(request_id, self._empty_request())
        _require(req.exists, "UNKNOWN_REQUEST")
        sender = gl.message.sender_address
        _require(sender == req.requester or sender == self.owner or sender == self.guardian, "UNAUTHORIZED")
        _require(req.status in (STATUS_PENDING, STATUS_DISPATCHED), "NOTHING_TO_RETRY")
        last = int(req.last_attempt_at)
        if last == 0:
            last = int(req.created_at)
        _require(int(_now()) >= last + int(self.stale_after_seconds), "NOT_STALE")
        req.status = STATUS_CANCELLED
        if int(req.fee_paid) > 0:
            self._credit(req.requester, req.fee_paid)
            req.fee_paid = u256(0)
        self.requests[request_id] = req

    @gl.public.write
    def commit_resolution(
        self,
        request_id: u256,
        attempt_id: u256,
        claim_key: str,
        fact_key: str,
        spec_hash: str,
        policy_hash: str,
        outcome: str,
        diagnostic_reason: str,
        policy_satisfied: bool,
        resolver_version: str,
        evidence_manifest_json: str,
        reasoning_summary: str,
        valid_until: u256,
    ) -> u256:
        req = self.requests.get(request_id, self._empty_request())
        _require(req.exists, "UNKNOWN_REQUEST")
        _require(gl.message.sender_address == req.assigned_resolver, "NOT_ASSIGNED_RESOLVER")
        _require(req.status in (STATUS_PENDING, STATUS_DISPATCHED), "NOTHING_TO_RETRY")
        _require(attempt_id == req.active_attempt_id, "STALE_ATTEMPT")
        _require(claim_key == req.claim_key, "BINDING_MISMATCH")
        _require(fact_key == req.fact_key, "BINDING_MISMATCH")
        _require(spec_hash == req.spec_hash, "BINDING_MISMATCH")
        _require(policy_hash == req.policy_hash, "BINDING_MISMATCH")
        out = outcome.strip().upper()
        diag = diagnostic_reason.strip().upper()
        _require(out in OUTCOMES, "INVALID_PARAM")
        _require(diag in DIAGNOSTICS, "INVALID_PARAM")
        if out in ("TRUE", "FALSE"):
            _require(diag == "NONE", "INVALID_PARAM")
        reason = _bounded_opt(reasoning_summary, MAX_DESC, "INVALID_PARAM")
        rver = _bounded_opt(resolver_version, 64, "INVALID_PARAM")
        manifest = _bounded_opt(evidence_manifest_json, 16384, "INVALID_PARAM")
        man_hash = _sha256_hex(manifest)
        now = _now()
        fact = self.facts.get(req.fact_key, self._empty_fact())
        prev_latest_id = u256(0)
        if fact.exists:
            prev_latest_id = fact.latest_resolution_id
            if int(prev_latest_id) == 0:
                prev_latest_id = fact.current_resolution_id
        prev_latest = self._empty_resolution()
        if int(prev_latest_id) > 0:
            prev_latest = self.resolutions.get(prev_latest_id, self._empty_resolution())
        supersedes = u256(history_supersedes_id(prev_latest.exists, int(prev_latest.resolution_id)))
        new_version = u32(next_history_version(prev_latest.exists, int(prev_latest.resolution_version)))
        until = valid_until
        if req.mutability == IMMUTABLE:
            until = u256(0)
        elif int(until) == 0:
            until = now + req.ttl_seconds
        resid = self.next_resolution_id
        self.next_resolution_id = resid + u256(1)
        rec = ResolutionRecord(
            exists=True,
            resolution_id=resid,
            request_id=request_id,
            attempt_id=attempt_id,
            claim_key=req.claim_key,
            fact_key=req.fact_key,
            spec_hash=req.spec_hash,
            policy_hash=req.policy_hash,
            outcome=out,
            diagnostic_reason=diag,
            policy_satisfied=policy_satisfied,
            resolver_version=rver,
            evidence_manifest_hash=man_hash,
            reasoning_summary=reason,
            evaluated_at=now,
            committed_at=now,
            valid_until=until,
            resolution_version=new_version,
            supersedes_resolution_id=supersedes,
            template_id=req.template_id,
            template_version=req.template_version,
            template_hash=req.template_hash,
        )
        self.resolutions[resid] = rec
        self.evidence_manifests[resid] = manifest
        self._append_history(req.fact_key, resid)
        advance = should_advance_canonical(
            bool(fact.exists),
            fact.current_outcome if fact.exists else "",
            out,
            bool(policy_satisfied),
        )
        if advance:
            canonical_id = resid
            canonical_request = request_id
            canonical_outcome = out
            canonical_resolved = now
            canonical_until = until
            canonical_version = new_version
            stored_th = req.template_hash
        else:
            canonical_id = fact.current_resolution_id
            canonical_request = fact.current_request_id
            canonical_outcome = fact.current_outcome
            canonical_resolved = fact.resolved_at
            canonical_until = fact.valid_until
            canonical_version = fact.resolution_version
            stored_th = fact.template_hash if fact.template_hash != "" else req.template_hash
        fact_rec = FactRecord(
            exists=True,
            fact_key=req.fact_key,
            claim_key=req.claim_key,
            policy_hash=req.policy_hash,
            schema_version=req.schema_version,
            mutability=req.mutability,
            current_resolution_id=canonical_id,
            latest_resolution_id=resid,
            current_request_id=canonical_request,
            current_outcome=canonical_outcome,
            resolved_at=canonical_resolved,
            valid_until=canonical_until,
            resolution_version=canonical_version,
            template_hash=stored_th,
        )
        self.facts[req.fact_key] = fact_rec
        req.status = STATUS_RESOLVED
        req.current_resolution_id = resid
        req.callback_status = self._emit_callback(req, resid, out, now, until)
        self.requests[request_id] = req
        self._log(
            "ResolutionCommitted",
            json.dumps(
                {
                    "attempt_id": int(attempt_id),
                    "canonical_advanced": advance,
                    "canonical_resolution_id": int(canonical_id),
                    "fact_key": req.fact_key,
                    "latest_resolution_id": int(resid),
                    "outcome": out,
                    "request_id": int(request_id),
                    "resolution_id": int(resid),
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        return resid

    @gl.public.write
    def request_callback_retry(self, request_id: u256) -> None:
        req = self.requests.get(request_id, self._empty_request())
        _require(req.exists, "UNKNOWN_REQUEST")
        _require(gl.message.sender_address == req.requester or gl.message.sender_address == self.owner, "UNAUTHORIZED")
        _require(req.callback_target != ZERO, "INVALID_PARAM")
        _require(req.status in (STATUS_RESOLVED, STATUS_REUSED), "NOTHING_TO_RETRY")
        _require(req.callback_status in (CB_DISPATCHED, CB_FAILED_REPORTED), "CALLBACK_NOT_FAILED")
        res = self.resolutions.get(req.current_resolution_id, self._empty_resolution())
        _require(res.exists, "UNKNOWN_RESOLUTION")
        req.callback_status = self._emit_callback(
            req, res.resolution_id, res.outcome, res.committed_at, res.valid_until
        )
        self.requests[request_id] = req

    @gl.public.write
    def mark_callback_result(self, request_id: u256, succeeded: bool) -> None:
        req = self.requests.get(request_id, self._empty_request())
        _require(req.exists, "UNKNOWN_REQUEST")
        sender = gl.message.sender_address
        _require(req.callback_target != ZERO, "INVALID_PARAM")
        _require(callback_ack_sender_allowed(sender.as_hex, req.callback_target.as_hex), "UNAUTHORIZED")
        if succeeded:
            req.callback_status = CB_ACKNOWLEDGED
            self._log("CallbackSucceeded", str(int(request_id)))
        else:
            req.callback_status = CB_FAILED_REPORTED
            self._log("CallbackFailed", str(int(request_id)))
        self.requests[request_id] = req

    @gl.public.write
    def withdraw_credit(self) -> u256:
        who = gl.message.sender_address
        amount = self.credits.get(who, u256(0))
        _require(int(amount) > 0, "NO_CREDIT")
        self.credits[who] = u256(0)
        gl.contract.get_at(who).emit_transfer(value=amount, on="finalized")
        self._log(
            "CreditWithdrawn",
            json.dumps({"address": who.as_hex, "amount": int(amount)}, sort_keys=True, separators=(",", ":")),
        )
        return amount

    @gl.public.write
    def set_resolver_enabled(self, resolver: str, enabled: bool, resolver_version: str, capabilities: str) -> None:
        self._only_owner()
        addr = Address(resolver)
        _require(addr != ZERO, "ZERO_ADDRESS")
        info = self.resolvers.get(addr, self._empty_resolver(addr))
        if not info.exists:
            info.exists = True
            info.resolver = addr
            info.registered_at = _now()
        info.enabled = enabled
        if resolver_version.strip() != "":
            info.resolver_version = _bounded(resolver_version, 64, "INVALID_PARAM")
        if capabilities.strip() != "":
            info.capabilities = _bounded_opt(capabilities, MAX_DESC, "INVALID_PARAM")
        self.resolvers[addr] = info
        self._log(
            "ResolverUpdated",
            json.dumps({"enabled": enabled, "resolver": addr.as_hex}, sort_keys=True, separators=(",", ":")),
        )

    @gl.public.write
    def set_default_resolver(self, resolver: str) -> None:
        self._only_owner()
        addr = Address(resolver)
        _require(addr != ZERO, "ZERO_ADDRESS")
        info = self.resolvers.get(addr, self._empty_resolver(addr))
        _require(info.exists and info.enabled, "RESOLVER_DISABLED")
        self.default_resolver = addr
        self._log("ResolverUpdated", json.dumps({"default": addr.as_hex}, sort_keys=True, separators=(",", ":")))

    @gl.public.write
    def set_fee_config(
        self,
        fee_base: u256,
        fee_per_attempt: u256,
        fee_reuse: u256,
        retry_delay_seconds: u256,
        stale_after_seconds: u256,
        max_attempts: u32,
        max_seed_urls: u32,
    ) -> None:
        self._only_owner()
        _require(int(max_attempts) >= 1 and int(max_attempts) <= 32, "INVALID_PARAM")
        _require(int(max_seed_urls) >= 1 and int(max_seed_urls) <= MAX_INITIAL_SEED_SOURCES, "INVALID_PARAM")
        _require(int(retry_delay_seconds) >= 0, "INVALID_PARAM")
        _require(int(stale_after_seconds) >= 1, "INVALID_PARAM")
        self.fee_base = fee_base
        self.fee_per_attempt = fee_per_attempt
        self.fee_reuse = fee_reuse
        self.retry_delay_seconds = retry_delay_seconds
        self.stale_after_seconds = stale_after_seconds
        self.max_attempts = max_attempts
        self.max_seed_urls = max_seed_urls

    @gl.public.write
    def set_guardian(self, guardian: str) -> None:
        self._only_owner()
        addr = Address(guardian)
        _require(addr != ZERO, "ZERO_ADDRESS")
        self.guardian = addr

    @gl.public.write
    def pause_new_requests(self) -> None:
        self._only_guardian()
        self.paused_new_requests = True
        self._log("ProtocolPaused", "1")

    @gl.public.write
    def unpause_new_requests(self) -> None:
        self._only_owner()
        self.paused_new_requests = False
        self._log("ProtocolUnpaused", "1")

    @gl.public.write
    def propose_owner(self, new_owner: str) -> None:
        self._only_owner()
        addr = Address(new_owner)
        _require(addr != ZERO, "ZERO_ADDRESS")
        self.pending_owner = addr
        self._log("OwnershipProposed", addr.as_hex)

    @gl.public.write
    def accept_owner(self) -> None:
        _require(gl.message.sender_address == self.pending_owner, "NOT_PENDING_OWNER")
        self.owner = self.pending_owner
        self.pending_owner = ZERO
        self._log("OwnershipAccepted", self.owner.as_hex)

    @gl.public.view
    def get_request(self, request_id: u256) -> RequestRecord:
        return self.requests.get(request_id, self._empty_request())

    @gl.public.view
    def get_request_status(self, request_id: u256) -> str:
        req = self.requests.get(request_id, self._empty_request())
        if not req.exists:
            return "UNKNOWN"
        return req.status

    @gl.public.view
    def get_fact(self, fact_key: str) -> FactRecord:
        return self.facts.get(fact_key.strip().lower(), self._empty_fact())

    @gl.public.view
    def get_current_resolution(self, fact_key: str) -> ResolutionRecord:
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        if not fact.exists:
            return self._empty_resolution()
        return self.resolutions.get(fact.current_resolution_id, self._empty_resolution())

    @gl.public.view
    def get_latest_resolution(self, fact_key: str) -> ResolutionRecord:
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        if not fact.exists:
            return self._empty_resolution()
        latest = fact.latest_resolution_id
        if int(latest) == 0:
            latest = fact.current_resolution_id
        return self.resolutions.get(latest, self._empty_resolution())

    @gl.public.view
    def get_resolution(self, resolution_id: u256) -> ResolutionRecord:
        return self.resolutions.get(resolution_id, self._empty_resolution())

    @gl.public.view
    def get_resolution_history(self, fact_key: str, offset: u32, limit: u32) -> ResolutionHistoryPage:
        _require(int(limit) > 0 and int(limit) <= MAX_PAGE, "INVALID_PAGINATION")
        key = fact_key.strip().lower()
        raw = self.fact_history.get(key, "[]")
        try:
            ids = json.loads(raw)
        except Exception:
            ids = []
        if not isinstance(ids, list):
            ids = []
        total = len(ids)
        start = int(offset)
        collected = []
        if start < total:
            end = start + int(limit)
            if end > total:
                end = total
            i = start
            while i < end:
                collected.append(int(ids[i]))
                i += 1
        return ResolutionHistoryPage(
            fact_key=key,
            offset=offset,
            limit=limit,
            total=u32(total),
            resolution_ids_json=json.dumps(collected, separators=(",", ":")),
        )

    @gl.public.view
    def get_evidence_manifest(self, resolution_id: u256) -> EvidenceManifestView:
        res = self.resolutions.get(resolution_id, self._empty_resolution())
        if not res.exists:
            return EvidenceManifestView(exists=False, resolution_id=resolution_id, manifest_hash="", manifest_json="")
        manifest = self.evidence_manifests.get(resolution_id, "")
        return EvidenceManifestView(
            exists=True,
            resolution_id=resolution_id,
            manifest_hash=res.evidence_manifest_hash,
            manifest_json=manifest,
        )

    @gl.public.view
    def compute_claim_key(
        self,
        subject: str,
        predicate: str,
        object_value: str,
        qualifiers: str,
        temporal: str,
        mutability: str,
    ) -> str:
        return compute_claim_key_value(subject, predicate, object_value, qualifiers, temporal, mutability)

    @gl.public.view
    def compute_fact_key(self, claim_key: str, policy_hash: str, schema_version: str, template_hash: str) -> str:
        return compute_fact_key_value(claim_key, policy_hash, schema_version, template_hash)

    @gl.public.view
    def compute_spec_hash(
        self,
        subject: str,
        predicate: str,
        object_value: str,
        qualifiers: str,
        temporal: str,
        mutability: str,
        schema_version: str,
        ttl_seconds: u256,
        description: str,
        seed_urls_json: str,
    ) -> str:
        seeds = parse_seed_urls(seed_urls_json, int(self.max_seed_urls))
        return compute_spec_hash_value(
            subject, predicate, object_value, qualifiers, temporal, mutability, schema_version, int(ttl_seconds), description, seeds
        )

    @gl.public.view
    def is_fact_fresh(self, fact_key: str) -> bool:
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        return self._fact_is_fresh(fact)

    @gl.public.view
    def can_reuse_fact(self, fact_key: str) -> bool:
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        if not fact.exists:
            return False
        own_ttl = int(fact.valid_until) - int(fact.resolved_at)
        if fact.mutability == IMMUTABLE:
            own_ttl = 1
        if own_ttl < 0:
            own_ttl = 0
        return self._can_reuse(
            fact,
            fact.policy_hash,
            fact.schema_version,
            REUSE_IF_FRESH,
            own_ttl,
            fact.template_hash,
        )

    @gl.public.view
    def can_reuse_with_freshness(self, fact_key: str, requested_ttl: u256) -> bool:
        fact = self.facts.get(fact_key.strip().lower(), self._empty_fact())
        if not fact.exists:
            return False
        return self._can_reuse(
            fact,
            fact.policy_hash,
            fact.schema_version,
            REUSE_IF_FRESH,
            int(requested_ttl),
            fact.template_hash,
        )

    @gl.public.view
    def compute_callback_id(self, request_id: u256, resolution_id: u256, consumer: str) -> str:
        hexv = consumer.strip().lower()
        if hexv == "":
            hexv = ZERO.as_hex
        return compute_callback_id_value(int(request_id), int(resolution_id), hexv)

    @gl.public.view
    def quote_resolution_fee(self, reuse_mode: str) -> u256:
        mode = reuse_mode.strip().upper()
        if mode == REUSE_IF_FRESH:
            return self.fee_reuse
        return self.fee_base + self.fee_per_attempt

    @gl.public.view
    def get_protocol_config(self) -> ProtocolConfig:
        return ProtocolConfig(
            owner=self.owner,
            pending_owner=self.pending_owner,
            guardian=self.guardian,
            policy_registry=self.policy_registry,
            default_resolver=self.default_resolver,
            paused_new_requests=self.paused_new_requests,
            fee_base=self.fee_base,
            fee_per_attempt=self.fee_per_attempt,
            fee_reuse=self.fee_reuse,
            retry_delay_seconds=self.retry_delay_seconds,
            stale_after_seconds=self.stale_after_seconds,
            max_attempts=self.max_attempts,
            max_seed_urls=self.max_seed_urls,
            schema_version=SCHEMA_V1,
            registry_version="evidra-registry-v1",
        )

    @gl.public.view
    def get_resolver(self, resolver: str) -> ResolverInfo:
        addr = Address(resolver)
        return self.resolvers.get(addr, self._empty_resolver(addr))

    @gl.public.view
    def get_protocol_stats(self) -> ProtocolStats:
        return ProtocolStats(
            request_count=self.next_request_id - u256(1),
            resolution_count=self.next_resolution_id - u256(1),
            reused_count=self.reused_count,
            paused=self.paused_new_requests,
            event_count=u256(len(self.events)),
        )

    @gl.public.view
    def get_credit(self, account: str) -> u256:
        return self.credits.get(Address(account), u256(0))

    @gl.public.view
    def get_job_snapshot(self, request_id: u256) -> str:
        req = self.requests.get(request_id, self._empty_request())
        if not req.exists:
            return "{}"
        return json.dumps(
            {
                "active_attempt_id": int(req.active_attempt_id),
                "assigned_resolver": req.assigned_resolver.as_hex,
                "callback_status": req.callback_status,
                "callback_target": req.callback_target.as_hex,
                "claim_key": req.claim_key,
                "description": req.description,
                "fact_key": req.fact_key,
                "fact_type": req.fact_type,
                "mutability": req.mutability,
                "object_value": req.object_value,
                "policy_hash": req.policy_hash,
                "policy_id": req.policy_id,
                "policy_version": int(req.policy_version),
                "predicate": req.predicate,
                "qualifiers": req.qualifiers,
                "request_id": int(req.request_id),
                "schema_version": req.schema_version,
                "seed_urls_json": req.seed_urls_json,
                "spec_hash": req.spec_hash,
                "status": req.status,
                "subject": req.subject,
                "supplemental_urls_json": req.supplemental_urls_json,
                "template_hash": req.template_hash,
                "template_id": req.template_id,
                "template_resolution_instructions": req.template_resolution_instructions,
                "template_version": int(req.template_version),
                "temporal": req.temporal,
                "ttl_seconds": int(req.ttl_seconds),
            },
            sort_keys=True,
            separators=(",", ":"),
        )

    @gl.public.view
    def get_owner(self) -> Address:
        return self.owner

    @gl.public.view
    def get_guardian(self) -> Address:
        return self.guardian

    @gl.public.view
    def is_paused(self) -> bool:
        return self.paused_new_requests

    @gl.public.view
    def get_policy_registry(self) -> Address:
        return self.policy_registry

    @gl.public.view
    def get_default_resolver(self) -> Address:
        return self.default_resolver

    @gl.public.view
    def get_registry_version(self) -> str:
        return "evidra-registry-v1"

    @gl.public.view
    def get_event_count(self) -> u256:
        return u256(len(self.events))

    @gl.public.view
    def get_events(self, offset: u32, limit: u32) -> EventPage:
        total = len(self.events)
        _require(int(limit) > 0 and int(limit) <= MAX_PAGE, "INVALID_PAGINATION")
        start = int(offset)
        collected = []
        if start < total:
            end = start + int(limit)
            if end > total:
                end = total
            i = start
            while i < end:
                ev = self.events[i]
                collected.append(
                    {
                        "index": int(ev.index),
                        "payload": ev.payload,
                        "timestamp": int(ev.timestamp),
                        "topic": ev.topic,
                    }
                )
                i += 1
        return EventPage(
            offset=offset,
            limit=limit,
            total=u32(total),
            items_json=json.dumps(collected, sort_keys=True, separators=(",", ":")),
        )

    @gl.public.view
    def validate_seed_url(self, url: str) -> bool:
        validate_https_url(url)
        return True
