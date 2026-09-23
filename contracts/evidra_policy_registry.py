# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""EvidraPolicyRegistry — immutable versioned source policies and fact templates."""

import genlayer as gl
from genlayer.storage import TreeMap, DynArray, allow as allow_storage
from genlayer.types import Address, u256, u32
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json


ZERO = Address("0x0000000000000000000000000000000000000000")
MAX_NAME = 128
MAX_RULES = 4096
MAX_FIELDS = 2048
MAX_PAGE = 50
POLICY_KEY_SEP = "::"
MAX_POLICY_COUNTS = 12
SOURCE_CLASSES = (
    "OFFICIAL",
    "PRIMARY",
    "INDEPENDENT_SECONDARY",
    "DERIVED",
    "COMMUNITY",
    "SOCIAL",
    "UNKNOWN",
    "INVALID",
)
CLASS_ALIASES = {
    "official": "OFFICIAL",
    "primary": "PRIMARY",
    "docs": "PRIMARY",
    "documentation": "PRIMARY",
    "independent": "INDEPENDENT_SECONDARY",
    "independent_secondary": "INDEPENDENT_SECONDARY",
    "secondary": "INDEPENDENT_SECONDARY",
    "derived": "DERIVED",
    "mirror": "DERIVED",
    "community": "COMMUNITY",
    "social": "SOCIAL",
    "unverified": "UNKNOWN",
    "unknown": "UNKNOWN",
    "invalid": "INVALID",
}


def _now() -> u256:
    return u256(int(datetime.now(timezone.utc).timestamp()))


def _norm(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _sha256_hex(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _require(cond: bool, code: str) -> None:
    if not cond:
        raise gl.vm.UserError(code)


def _bounded(value: str, max_len: int, code: str) -> str:
    text = value.strip()
    _require(len(text) > 0 and len(text) <= max_len, code)
    return text


def _bounded_opt(value: str, max_len: int, code: str) -> str:
    text = value.strip()
    _require(len(text) <= max_len, code)
    return text


def _policy_storage_key(policy_id: str, version: u32) -> str:
    return policy_id + POLICY_KEY_SEP + str(int(version))


def _split_class_tokens(raw: str) -> list:
    text = (raw or "").strip()
    if text == "":
        return []
    if text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return [str(x) for x in data]
            raise gl.vm.UserError("INVALID_POLICY_CLASS")
        except gl.vm.UserError:
            raise
        except Exception:
            raise gl.vm.UserError("INVALID_POLICY_CLASS")
    items = []
    for part in text.replace(";", ",").split(","):
        if part.strip() != "":
            items.append(part)
    return items


def parse_source_classes(raw: str) -> list:
    """Fail-closed parser. Unknown tokens, bad JSON, and duplicates revert."""
    text = (raw or "").strip()
    if text == "" or text == "[]":
        return []
    tokens = _split_class_tokens(text)
    if len(tokens) == 0:
        raise gl.vm.UserError("INVALID_POLICY_CLASS")
    out = []
    seen = {}
    for item in tokens:
        alias = CLASS_ALIASES.get(_norm(item), _norm(item).upper().replace(" ", "_"))
        if alias not in SOURCE_CLASSES:
            raise gl.vm.UserError("INVALID_POLICY_CLASS")
        if alias in seen:
            raise gl.vm.UserError("DUPLICATE_POLICY_CLASS")
        seen[alias] = True
        out.append(alias)
    return out


def validate_policy_classes(allowed_raw: str, disallowed_raw: str):
    allowed = parse_source_classes(allowed_raw)
    disallowed = parse_source_classes(disallowed_raw)
    for cls in allowed:
        if cls in disallowed:
            raise gl.vm.UserError("CONTRADICTORY_POLICY_CLASS")
    return ",".join(allowed), ",".join(disallowed)


def _canonical_policy_payload(
    policy_id: str,
    version: int,
    name: str,
    min_primary_sources: int,
    min_independent_sources: int,
    allowed_classes: str,
    disallowed_classes: str,
    require_cross_check: bool,
    semantic_rules: str,
) -> str:
    allowed, disallowed = validate_policy_classes(allowed_classes, disallowed_classes)
    body = {
        "allowed_classes": allowed,
        "disallowed_classes": disallowed,
        "min_independent_sources": min_independent_sources,
        "min_primary_sources": min_primary_sources,
        "name": _norm(name),
        "policy_id": _norm(policy_id),
        "require_cross_check": require_cross_check,
        "semantic_rules": semantic_rules.strip(),
        "version": version,
    }
    return json.dumps(body, sort_keys=True, separators=(",", ":"))


def _canonical_template_payload(
    template_id: str,
    version: int,
    name: str,
    fact_type: str,
    required_fields: str,
    resolution_instructions: str,
    default_policy_id: str,
    default_policy_version: int,
) -> str:
    body = {
        "default_policy_id": _norm(default_policy_id),
        "default_policy_version": default_policy_version,
        "fact_type": _norm(fact_type),
        "name": _norm(name),
        "required_fields": required_fields.strip(),
        "resolution_instructions": resolution_instructions.strip(),
        "template_id": _norm(template_id),
        "version": version,
    }
    return json.dumps(body, sort_keys=True, separators=(",", ":"))


@allow_storage
@dataclass
class SourcePolicyRecord:
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
class TemplateRecord:
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
class OwnershipView:
    owner: Address
    pending_owner: Address


class EvidraPolicyRegistry(gl.contract.Contract):
    owner: Address
    pending_owner: Address
    policies: TreeMap[str, SourcePolicyRecord]
    latest_policy_version: TreeMap[str, u32]
    templates: TreeMap[str, TemplateRecord]
    latest_template_version: TreeMap[str, u32]
    events: DynArray[ProtocolEvent]
    policy_count: u256
    template_count: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pending_owner = ZERO
        self.policy_count = u256(0)
        self.template_count = u256(0)

    def _only_owner(self) -> None:
        _require(gl.message.sender_address == self.owner, "NOT_OWNER")

    def _log(self, topic: str, payload: str) -> None:
        idx = u256(len(self.events))
        self.events.append(
            ProtocolEvent(index=idx, topic=topic, payload=payload, timestamp=_now())
        )
        print("EVIDRA_EVENT " + topic + " " + payload)

    def _empty_policy(self) -> SourcePolicyRecord:
        return SourcePolicyRecord(
            exists=False,
            policy_id="",
            version=u32(0),
            name="",
            active=False,
            min_primary_sources=u32(0),
            min_independent_sources=u32(0),
            allowed_classes="",
            disallowed_classes="",
            require_cross_check=False,
            semantic_rules="",
            policy_hash="",
            published_at=u256(0),
            deprecated=False,
        )

    def _empty_template(self) -> TemplateRecord:
        return TemplateRecord(
            exists=False,
            template_id="",
            version=u32(0),
            name="",
            active=False,
            fact_type="",
            required_fields="",
            resolution_instructions="",
            default_policy_id="",
            default_policy_version=u32(0),
            template_hash="",
            published_at=u256(0),
            deprecated=False,
        )

    @gl.public.write
    def publish_source_policy(
        self,
        policy_id: str,
        version: u32,
        name: str,
        min_primary_sources: u32,
        min_independent_sources: u32,
        allowed_classes: str,
        disallowed_classes: str,
        require_cross_check: bool,
        semantic_rules: str,
    ) -> str:
        self._only_owner()
        pid = _bounded(policy_id, 64, "INVALID_PARAM")
        _require(int(version) >= 1, "INVALID_PARAM")
        nm = _bounded(name, MAX_NAME, "INVALID_PARAM")
        _require(int(min_primary_sources) >= 0 and int(min_primary_sources) <= MAX_POLICY_COUNTS, "INVALID_PARAM")
        _require(int(min_independent_sources) >= 0 and int(min_independent_sources) <= MAX_POLICY_COUNTS, "INVALID_PARAM")
        allowed_in = _bounded_opt(allowed_classes, 512, "INVALID_PARAM")
        disallowed_in = _bounded_opt(disallowed_classes, 512, "INVALID_PARAM")
        rules = _bounded_opt(semantic_rules, MAX_RULES, "INVALID_PARAM")
        key = _policy_storage_key(pid, version)
        existing = self.policies.get(key, self._empty_policy())
        _require(not existing.exists, "POLICY_EXISTS")
        allowed, disallowed = validate_policy_classes(allowed_in, disallowed_in)
        payload = _canonical_policy_payload(
            pid,
            int(version),
            nm,
            int(min_primary_sources),
            int(min_independent_sources),
            allowed,
            disallowed,
            require_cross_check,
            rules,
        )
        phash = _sha256_hex("EVIDRA_POLICY_V1|" + payload)
        rec = SourcePolicyRecord(
            exists=True,
            policy_id=pid,
            version=version,
            name=nm,
            active=True,
            min_primary_sources=min_primary_sources,
            min_independent_sources=min_independent_sources,
            allowed_classes=allowed,
            disallowed_classes=disallowed,
            require_cross_check=require_cross_check,
            semantic_rules=rules,
            policy_hash=phash,
            published_at=_now(),
            deprecated=False,
        )
        self.policies[key] = rec
        current_latest = int(self.latest_policy_version.get(pid, u32(0)))
        if int(version) > current_latest:
            self.latest_policy_version[pid] = version
        self.policy_count = self.policy_count + u256(1)
        self._log(
            "PolicyPublished",
            json.dumps(
                {"policy_id": pid, "version": int(version), "policy_hash": phash},
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        return phash

    @gl.public.write
    def deprecate_source_policy(self, policy_id: str, version: u32) -> None:
        self._only_owner()
        pid = _bounded(policy_id, 64, "INVALID_PARAM")
        key = _policy_storage_key(pid, version)
        rec = self.policies.get(key, self._empty_policy())
        _require(rec.exists, "UNKNOWN_POLICY")
        rec.active = False
        rec.deprecated = True
        self.policies[key] = rec
        self._log(
            "PolicyDeprecated",
            json.dumps(
                {"policy_id": pid, "version": int(version), "policy_hash": rec.policy_hash},
                sort_keys=True,
                separators=(",", ":"),
            ),
        )

    @gl.public.write
    def publish_template(
        self,
        template_id: str,
        version: u32,
        name: str,
        fact_type: str,
        required_fields: str,
        resolution_instructions: str,
        default_policy_id: str,
        default_policy_version: u32,
    ) -> str:
        self._only_owner()
        tid = _bounded(template_id, 64, "INVALID_PARAM")
        _require(int(version) >= 1, "INVALID_PARAM")
        nm = _bounded(name, MAX_NAME, "INVALID_PARAM")
        ft = _bounded(fact_type, 64, "INVALID_PARAM")
        fields = _bounded_opt(required_fields, MAX_FIELDS, "INVALID_PARAM")
        instructions = _bounded(resolution_instructions, MAX_RULES, "INVALID_PARAM")
        dpid = _bounded_opt(default_policy_id, 64, "INVALID_PARAM")
        key = _policy_storage_key(tid, version)
        existing = self.templates.get(key, self._empty_template())
        _require(not existing.exists, "TEMPLATE_EXISTS")
        payload = _canonical_template_payload(
            tid,
            int(version),
            nm,
            ft,
            fields,
            instructions,
            dpid,
            int(default_policy_version),
        )
        thash = _sha256_hex("EVIDRA_TEMPLATE_V1|" + payload)
        rec = TemplateRecord(
            exists=True,
            template_id=tid,
            version=version,
            name=nm,
            active=True,
            fact_type=ft,
            required_fields=fields,
            resolution_instructions=instructions,
            default_policy_id=dpid,
            default_policy_version=default_policy_version,
            template_hash=thash,
            published_at=_now(),
            deprecated=False,
        )
        self.templates[key] = rec
        current_latest = int(self.latest_template_version.get(tid, u32(0)))
        if int(version) > current_latest:
            self.latest_template_version[tid] = version
        self.template_count = self.template_count + u256(1)
        self._log(
            "TemplatePublished",
            json.dumps(
                {"template_id": tid, "version": int(version), "template_hash": thash},
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        return thash

    @gl.public.write
    def deprecate_template(self, template_id: str, version: u32) -> None:
        self._only_owner()
        tid = _bounded(template_id, 64, "INVALID_PARAM")
        key = _policy_storage_key(tid, version)
        rec = self.templates.get(key, self._empty_template())
        _require(rec.exists, "UNKNOWN_TEMPLATE")
        rec.active = False
        rec.deprecated = True
        self.templates[key] = rec
        self._log(
            "TemplateDeprecated",
            json.dumps(
                {
                    "template_id": tid,
                    "version": int(version),
                    "template_hash": rec.template_hash,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )

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
    def get_source_policy(self, policy_id: str, version: u32) -> SourcePolicyRecord:
        key = _policy_storage_key(policy_id.strip(), version)
        return self.policies.get(key, self._empty_policy())

    @gl.public.view
    def get_latest_source_policy(self, policy_id: str) -> SourcePolicyRecord:
        pid = policy_id.strip()
        ver = self.latest_policy_version.get(pid, u32(0))
        if int(ver) == 0:
            return self._empty_policy()
        return self.get_source_policy(pid, ver)

    @gl.public.view
    def is_source_policy_active(self, policy_id: str, version: u32) -> bool:
        rec = self.get_source_policy(policy_id, version)
        return bool(rec.exists and rec.active and (not rec.deprecated))

    @gl.public.view
    def get_policy_hash(self, policy_id: str, version: u32) -> str:
        rec = self.get_source_policy(policy_id, version)
        return rec.policy_hash

    @gl.public.view
    def get_template(self, template_id: str, version: u32) -> TemplateRecord:
        key = _policy_storage_key(template_id.strip(), version)
        return self.templates.get(key, self._empty_template())

    @gl.public.view
    def get_latest_template(self, template_id: str) -> TemplateRecord:
        tid = template_id.strip()
        ver = self.latest_template_version.get(tid, u32(0))
        if int(ver) == 0:
            return self._empty_template()
        return self.get_template(tid, ver)

    @gl.public.view
    def is_template_active(self, template_id: str, version: u32) -> bool:
        rec = self.get_template(template_id, version)
        return bool(rec.exists and rec.active and (not rec.deprecated))

    @gl.public.view
    def get_template_hash(self, template_id: str, version: u32) -> str:
        rec = self.get_template(template_id, version)
        return rec.template_hash

    @gl.public.view
    def get_latest_policy_version(self, policy_id: str) -> u32:
        return self.latest_policy_version.get(policy_id.strip(), u32(0))

    @gl.public.view
    def get_latest_template_version(self, template_id: str) -> u32:
        return self.latest_template_version.get(template_id.strip(), u32(0))

    @gl.public.view
    def get_ownership(self) -> OwnershipView:
        return OwnershipView(owner=self.owner, pending_owner=self.pending_owner)

    @gl.public.view
    def get_owner(self) -> Address:
        return self.owner

    @gl.public.view
    def get_pending_owner(self) -> Address:
        return self.pending_owner

    @gl.public.view
    def get_protocol_stats(self) -> str:
        return json.dumps(
            {
                "policy_count": int(self.policy_count),
                "template_count": int(self.template_count),
            },
            sort_keys=True,
            separators=(",", ":"),
        )

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
    def compute_policy_hash(
        self,
        policy_id: str,
        version: u32,
        name: str,
        min_primary_sources: u32,
        min_independent_sources: u32,
        allowed_classes: str,
        disallowed_classes: str,
        require_cross_check: bool,
        semantic_rules: str,
    ) -> str:
        payload = _canonical_policy_payload(
            policy_id.strip(),
            int(version),
            name,
            int(min_primary_sources),
            int(min_independent_sources),
            allowed_classes,
            disallowed_classes,
            require_cross_check,
            semantic_rules,
        )
        return _sha256_hex("EVIDRA_POLICY_V1|" + payload)

    @gl.public.view
    def compute_template_hash(
        self,
        template_id: str,
        version: u32,
        name: str,
        fact_type: str,
        required_fields: str,
        resolution_instructions: str,
        default_policy_id: str,
        default_policy_version: u32,
    ) -> str:
        payload = _canonical_template_payload(
            template_id.strip(),
            int(version),
            name,
            fact_type,
            required_fields,
            resolution_instructions,
            default_policy_id,
            int(default_policy_version),
        )
        return _sha256_hex("EVIDRA_TEMPLATE_V1|" + payload)

    @gl.public.view
    def get_registry_version(self) -> str:
        return "evidra-policy-registry-v1"
