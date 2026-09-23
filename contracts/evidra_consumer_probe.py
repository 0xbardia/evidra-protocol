# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""IEvidraConsumer probe used to verify fixed-name finalized callbacks and idempotency."""

import genlayer as gl
from genlayer.types import Address, u256
import hashlib
import json


ZERO = Address("0x0000000000000000000000000000000000000000")


def _require(cond: bool, code: str) -> None:
    if not cond:
        raise gl.vm.UserError(code)


def _callback_id(request_id: u256, resolution_id: u256, consumer_hex: str) -> str:
    body = "EVIDRA_CB_V1|" + str(int(request_id)) + "|" + str(int(resolution_id)) + "|" + consumer_hex.lower()
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


class EvidraConsumerProbe(gl.contract.Contract):
    trusted_registry: Address
    last_request_id: u256
    last_fact_key: str
    last_resolution_id: u256
    last_outcome: str
    last_resolved_at: u256
    last_valid_until: u256
    last_callback_id: str
    callback_count: u256
    duplicate_ignored_count: u256
    processed_ids_json: str

    def __init__(self, trusted_registry: str):
        addr = Address(trusted_registry)
        _require(addr != ZERO, "ZERO_ADDRESS")
        self.trusted_registry = addr
        self.last_request_id = u256(0)
        self.last_fact_key = ""
        self.last_resolution_id = u256(0)
        self.last_outcome = ""
        self.last_resolved_at = u256(0)
        self.last_valid_until = u256(0)
        self.last_callback_id = ""
        self.callback_count = u256(0)
        self.duplicate_ignored_count = u256(0)
        self.processed_ids_json = "[]"

    def _already_processed(self, callback_id: str) -> bool:
        try:
            ids = json.loads(self.processed_ids_json)
        except Exception:
            ids = []
        if not isinstance(ids, list):
            ids = []
        return callback_id in ids

    def _mark_processed(self, callback_id: str) -> None:
        try:
            ids = json.loads(self.processed_ids_json)
        except Exception:
            ids = []
        if not isinstance(ids, list):
            ids = []
        ids.append(callback_id)
        self.processed_ids_json = json.dumps(ids, separators=(",", ":"))

    @gl.public.write
    def on_evidra_result(
        self,
        request_id: u256,
        fact_key: str,
        resolution_id: u256,
        outcome: str,
        resolved_at: u256,
        valid_until: u256,
        callback_id: str,
    ) -> None:
        _require(gl.message.sender_address == self.trusted_registry, "UNAUTHORIZED")
        cid = callback_id.strip().lower()
        if cid == "":
            cid = _callback_id(request_id, resolution_id, gl.message.contract_address.as_hex)
        if self._already_processed(cid):
            self.duplicate_ignored_count = self.duplicate_ignored_count + u256(1)
            return
        self._mark_processed(cid)
        self.last_request_id = request_id
        self.last_fact_key = fact_key
        self.last_resolution_id = resolution_id
        self.last_outcome = outcome
        self.last_resolved_at = resolved_at
        self.last_valid_until = valid_until
        self.last_callback_id = cid
        self.callback_count = self.callback_count + u256(1)

    @gl.public.view
    def get_trusted_registry(self) -> Address:
        return self.trusted_registry

    @gl.public.view
    def get_last_request_id(self) -> u256:
        return self.last_request_id

    @gl.public.view
    def get_last_fact_key(self) -> str:
        return self.last_fact_key

    @gl.public.view
    def get_last_resolution_id(self) -> u256:
        return self.last_resolution_id

    @gl.public.view
    def get_last_outcome(self) -> str:
        return self.last_outcome

    @gl.public.view
    def get_last_resolved_at(self) -> u256:
        return self.last_resolved_at

    @gl.public.view
    def get_last_valid_until(self) -> u256:
        return self.last_valid_until

    @gl.public.view
    def get_last_callback_id(self) -> str:
        return self.last_callback_id

    @gl.public.view
    def get_callback_count(self) -> u256:
        return self.callback_count

    @gl.public.view
    def get_duplicate_ignored_count(self) -> u256:
        return self.duplicate_ignored_count

    @gl.public.view
    def has_processed_callback(self, callback_id: str) -> bool:
        return self._already_processed(callback_id.strip().lower())
