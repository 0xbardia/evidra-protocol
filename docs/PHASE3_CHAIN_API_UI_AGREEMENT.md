# Phase 3 Chain / API / UI Agreement

> Historical consistency review from 2026-09-21. Any blocked fields here refer
> to the then-current hosted-RPC limitation, not the release gate. See
> [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md) for current release
> status.

## Comparison contract

The canonical comparison for a completed write is:

| Field | Finalized chain | API | UI |
| --- | --- | --- | --- |
| request ID | request record | `GET /requests/:requestId` | request/transaction state |
| fact key | request/fact record | fact envelope | Fact detail |
| claim key | request/fact record | fact envelope | Fact detail |
| canonical resolution ID | fact current ID | `canonical_resolution` | Canonical Resolution card |
| latest resolution ID | fact latest ID | `latest_resolution` | Latest Attempt card |
| outcome | resolution record | consensus/outcome | Outcome state |
| diagnostic | resolution record | consensus/diagnostic | diagnostic text |
| policy/template | request and snapshots | request/fact projection | Fact detail |
| freshness | finalized fact timestamps | `freshness.is_fresh` | fresh/stale state |
| resolution version | resolution record | resolution envelope | history/timeline |

The API is a projection/cache and exposes source/sync metadata. The UI must
not promote a submitted or decided transaction to a finalized Fact until a
finalized read and API reconciliation support it. Canonical and latest values
must remain visually separate.

## Current real-write comparison

The parent request identity agrees across the UI submission, the request
transaction, and the API request record:

- request id: `4`
- claim key:
  `33b1d96c4e77e633e4a913406801862d90dcde883a56a09be30202b561d153a0`
- fact key:
  `f3f1b9ad892bd1e026e9147b8d325705d4b058511849535088b984292c06ad86`
- request status at the last available read: `DISPATCHED`

The parent request transaction finalized successfully. The resolver child was
last observed as `PROPOSING` with `NO_MAJORITY`; no resolution record was
available. Therefore canonical resolution, latest resolution, outcome,
diagnostic, policy satisfaction, freshness, and timestamps are **BLOCKED**,
not missing by assumption.

## Blocking condition

Studio Dev now returns `Rate limit exceeded: 5000 requests per day`. The API
readiness endpoint correctly returns `503`, so a full chain/API/UI agreement
cannot be certified until the normal quota resets and the finalized reads are
repeated.
