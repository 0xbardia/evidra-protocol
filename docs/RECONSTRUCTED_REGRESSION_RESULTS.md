# Evidra Protocol V1 — Reconstructed Regression Results

Date: 2026-09-21

The historical 128-test suite was unavailable and was not recovered. This
result is from the independent reconstructed suite.

Command:

```text
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover -s tests -p 'test*.py'
```

Result:

- Test files: 9
- Tests: 120
- PASS: 120
- FAIL: 0
- SKIP: 0
- Critical invariant tests: 23/23 PASS
- SSRF regression tests: 10/10 PASS
- Live writes: none

Coverage traceability is in
`docs/RECONSTRUCTED_REGRESSION_COVERAGE.md`.

The suite combines source-derived deterministic execution with source-level
checks for authorization and state-machine properties. Deployed behavior is
covered separately by the 64/64 finalized read certification.
