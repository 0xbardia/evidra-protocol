# Evidra Protocol V1 — Reconstructed Regression Coverage

## Scope and provenance

The historical 128-test suite was unavailable and was **not** recovered or
recreated by count. This is a new independent suite derived from:

- the four immutable V1 contract sources;
- the Phase 0 audit and security invariants;
- the method matrix, protocol types, and error catalog;
- the integration, lifecycle, and reconciliation specifications; and
- the current post-SSRF deployed read state.

Deterministic helper tests compile functions directly from the current source.
Structural tests inspect the actual source AST/body for authorization,
state-machine, finality, and cross-contract invariants. The deployed read
certification separately invokes every public view using `latest-final`.

No test is skipped. No live write is used.

## Matrix

| ID | Category | Contract/function | Invariant or behavior | Test type | Positive | Negative | Boundary | Implemented test | Status |
|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | AUTH | Policy/Registry admin writes | Owner-only gates are present | Source/AST | owner guard | non-owner rejected by guard | pending owner path | `test_policy_admin_writes_are_owner_guarded`; `test_registry_admin_and_guardian_permissions_are_explicit` | COVERED |
| AUTH-02 | AUTH | `commit_resolution` | Only assigned resolver commits | Source/AST | assigned resolver | other caller | exact address equality | `test_resolution_and_callback_callers_are_not_user_selectable` | COVERED |
| AUTH-03 | AUTH | `resolve_request` | Resolver accepts Registry only | Source/AST | Registry sender | other sender | snapshot resolver match | `test_resolver_requires_registry_sender_and_revalidates_stored_urls` | COVERED |
| AUTH-04 | AUTH | callback ACK / ConsumerProbe | Callback target and trusted Registry are authenticated | Source/helper | exact target | attacker/owner/resolver | zero target | `test_callback_ack_sender_requires_exact_nonzero_target`; `test_I22_consumer_callback_authentication` | COVERED |
| OWN-01 | OWNERSHIP | `propose_owner` / `accept_owner` | Two-step ownership transfer | Source/AST | pending owner accepts | wrong caller | zero address rejected | `test_two_step_ownership_is_present_on_both_owner_contracts` | COVERED |
| PAUSE-01 | PAUSE | pause/unpause/new requests | Pause blocks new requests and unpause restores path | Source/AST | paused flag set/cleared | new request guard | force-new distinction | `test_pause_blocks_new_requests_but_force_new_paths_are_explicit` | COVERED |
| RES-01 | RESOLVER | Resolver registration/dispatch | Enabled default resolver is required | Source/AST | configured resolver | disabled/no default | exact assigned resolver | `test_custom_request_binds_policy_identity_and_execution_fields`; `test_resolver_requires_registry_sender_and_revalidates_stored_urls` | COVERED |
| RES-02 | RESOLVER | Resolver capabilities | Capabilities are explicit and not verdict truth | Source/AST | critical-fields-only declaration | no confidence claim | equivalence field | `test_resolver_capability_equivalence_is_declared_not_verdict_truth` | COVERED |
| REQUEST-01 | REQUEST | `_create_request` | Custom request binds policy, hashes, URLs, and execution fields | Source/AST | valid binding fields | malformed input | bounded fields | `test_custom_request_binds_policy_identity_and_execution_fields` | COVERED |
| REQUEST-02 | REQUEST | `request_fact_by_template` | Template uses exact default policy and required fields | Source/AST | compatible template | missing/incorrect fields | fact-type/mutability | `test_template_request_uses_default_policy_and_validates_required_fields` | COVERED |
| REQUEST-03 | REQUEST | refresh/reassessment | Existing fact/request is referenced | Source/AST | existing fact path | unknown/immutable fact | supplemental list | `test_refresh_is_mutable_only_and_forces_fresh_resolution`; `test_reassessment_reuses_fact_binding_and_prioritizes_supplemental_urls` | COVERED |
| ID-01 | IDENTITY | `compute_claim_key_value` | Claim identity is deterministic and normalized | Deterministic | same semantic fields | changed semantic field | whitespace/case | `test_claim_key_normalizes_semantic_text_and_is_deterministic` | COVERED |
| ID-02 | IDENTITY | `compute_claim_key_value` | Execution-only fields do not redefine claim identity | Deterministic | same claim | changed description/TTL/seeds | mutability remains semantic | `test_claim_key_excludes_execution_only_fields` | COVERED |
| ID-03 | IDENTITY | `compute_fact_key_value` | Policy/schema/template regime binds fact identity | Deterministic | same four inputs | each identity change | empty vs non-empty template | `test_fact_key_binds_policy_schema_and_template_regime` | COVERED |
| ID-04 | IDENTITY | `compute_spec_hash_value` | Request specification is field-sensitive and canonical | Deterministic | repeat hash | changed request field | seed list and TTL | `test_spec_hash_is_canonical_and_field_sensitive` | COVERED |
| ID-05 | IDENTITY | `compute_callback_id_value` | Callback ID is domain-separated and deterministic | Deterministic | same normalized consumer | request/resolution/consumer change | case/whitespace | `test_callback_id_is_domain_separated_and_case_insensitive` | COVERED |
| POLICY-01 | POLICY | `parse_source_classes` | Documented aliases normalize to exact classes | Deterministic | official/docs aliases | unknown token | JSON/list form | `test_policy_class_parser_accepts_documented_aliases` | COVERED |
| POLICY-02 | POLICY | policy class parser | Unknown, malformed, duplicate classes fail closed | Deterministic | valid class | invalid/duplicate | empty policy | `test_policy_class_parser_fails_closed` | COVERED |
| POLICY-03 | POLICY | `validate_policy_classes` | Allowed/disallowed intersection is rejected | Deterministic | disjoint sets | contradictory set | empty unrestricted lists | `test_policy_allowed_and_disallowed_cannot_contradict` | COVERED |
| POLICY-04 | POLICY | policy hash | Policy hash binds all policy rules | Deterministic | normalized equivalent inputs | each rule change | alias normalization | `test_policy_hash_changes_for_security_relevant_fields` | COVERED |
| POLICY-05 | POLICY | live PolicyRegistry views | Stored policy versions and hashes are readable | Deployed read | configured `core/1` | missing policy | active state | `read_certification_final.json`, scenario coverage | COVERED |
| TEMPLATE-01 | TEMPLATE | template hash | Template hash binds ID/version/rules/default policy | Deterministic | repeat hash | each template field change | version transition | `test_template_hash_binds_version_rules_and_default_policy` | COVERED |
| TEMPLATE-02 | TEMPLATE | template request | Fact type and required fields are enforced | Deterministic/source | compatible fields | blank/missing/incompatible | immutable vs TTL | `test_template_fact_type_and_required_fields_are_enforced` | COVERED |
| TEMPLATE-03 | TEMPLATE | resolver template verification | Exact ID/version/hash snapshot is required | Deterministic/source | exact snapshot | any mismatch | no-template empty case | `test_template_snapshot_requires_exact_id_version_and_hash` | COVERED |
| TEMPLATE-04 | TEMPLATE | policy/template publication | Existing versions cannot be overwritten; deprecation is historical | Source/AST | new version | duplicate version | v1/v2 | `test_template_versions_are_immutable_records` | COVERED |
| SOURCE-01 | SOURCE | resolver heuristic class | Subject-relative authority controls primary classification | Deterministic | subject-owned source | non-owned source | platform account path | `test_subject_authority_is_structural_and_not_text_poisonable`; `test_platform_and_generic_host_classification` | COVERED |
| SOURCE-02 | SOURCE | resolver heuristic class | Object/qualifier/description/template text cannot confer authority | Deterministic | subject-only authority | poisoned context | exact host/path | `test_object_qualifier_description_and_template_text_cannot_grant_authority` | COVERED |
| SOURCE-03 | SOURCE | source policy application | Allowed/disallowed classes and zero usable evidence are enforced | Deterministic | eligible source | disallowed/unavailable | empty allow list | `test_allow_and_disallow_lists_control_eligibility`; `test_zero_eligible_sources_fails_closed` | COVERED |
| SOURCE-04 | SOURCE | policy normalization | Boolean output is clamped when policy counts fail | Deterministic | satisfied policy | insufficient primary/independent | cross-check | `test_policy_normalization_clamps_boolean_when_counts_fail` | COVERED |
| SOURCE-05 | SOURCE | empty allowed classes | Empty allowed list retains intended unrestricted V1 semantics | Deterministic | UNKNOWN eligible | explicit disallow | no allow tokens | `test_empty_allow_list_is_intentionally_unrestricted` | COVERED |
| PROV-01 | PROVENANCE | `_cluster_sources` | Exact/canonical duplicates are derived | Deterministic | first source usable | duplicate excluded | trailing slash | `test_exact_and_canonical_duplicates_are_derived` | COVERED |
| PROV-02 | PROVENANCE | `_cluster_sources` | Similar/copied cross-domain content is not independent | Deterministic | derivative detected | no independent count | similarity threshold | `test_copied_content_across_domains_is_not_independent` | COVERED |
| PROV-03 | PROVENANCE | `_cluster_sources` | Genuine origin groups remain distinct | Deterministic | distinct reports | no accidental merge | separate registrable domains | `test_genuine_domains_get_separate_provenance_groups` | COVERED |
| PROV-04 | PROVENANCE | `_policy_eval` | Independence counts once per provenance group | Deterministic | two groups satisfy cross-check | same group does not double count | min=2 | `test_independence_is_counted_once_per_provenance_group` | COVERED |
| SSRF-01 | SSRF | `validate_https_url` | Strict HTTPS/domain-only allow model | Deterministic | normal hostname/:443 | HTTP/FTP/file/data/javascript | explicit port | `tests/test_ssrf_validation.py` | COVERED |
| SSRF-02 | SSRF | `validate_https_url` | All direct IP literal forms are rejected | Deterministic | ordinary domain | IPv4/IPv6/mapped/numeric | bracket/short numeric | `test_every_direct_ipv4_form_is_rejected_without_range_classification`; `test_every_direct_ipv6_form_is_rejected` | COVERED |
| SSRF-03 | SSRF | URL authority parser | Localhost, userinfo, fragments, malformed labels/authority fail | Deterministic | safe authority | dangerous forms | whitespace/control chars | `test_localhost_names_are_rejected`; `test_userinfo_and_authority_confusion_are_rejected`; `test_fragments_whitespace_controls_and_malformed_labels_are_rejected` | COVERED |
| SSRF-04 | SSRF | all URL ingress paths | Seed, supplemental, and Resolver paths share validation | Source/AST | validator call present | bypass path absent | Resolver-before-fetch order | `test_all_url_ingresses_and_resolver_defense_are_wired`; `test_web_fetch_is_after_url_validation_in_resolve_path` | COVERED |
| FRESH-01 | FRESHNESS | `freshness_allows_reuse` | Immutable boolean facts remain fresh | Deterministic | TRUE/FALSE | UNRESOLVED | valid_until=0 | `test_immutable_boolean_is_fresh_and_unresolved_is_not` | COVERED |
| FRESH-02 | FRESHNESS | `freshness_allows_reuse` | Mutable TTL is fresh through boundary and stale after | Deterministic | now<=valid_until | now>valid_until | exact age/TTL boundary | `test_mutable_ttl_is_fresh_at_boundary_and_stale_after` | COVERED |
| REUSE-01 | REUSE | `_can_reuse` | Reuse requires same policy/schema/template and fresh boolean | Source/AST | matching identity | mismatch/unresolved | requested TTL | `test_force_fresh_and_identity_mismatch_prevent_reuse` | COVERED |
| REUSE-02 | REUSE | request modes | FORCE_FRESH cannot reuse a cached fact | Source/AST | force path creates request | reuse hit blocked | mode default/explicit | `test_I13_force_fresh_never_reuses` | COVERED |
| RETRY-01 | RETRY | `retry_resolution` | Retry requires requester/owner, delay, and attempts | Source/AST | eligible pending/dispatched | unauthorized/too early/max | attempt increment | `test_retry_cancel_and_callback_retry_have_state_and_permission_guards` | COVERED |
| RETRY-02 | RETRY | `commit_resolution` | Late attempt cannot overwrite active attempt | Source/AST | active attempt | stale attempt | binding order | `test_attempt_and_binding_guards_precede_commit`; `test_I07_stale_attempt_is_rejected` | COVERED |
| REASS-01 | REASSESSMENT | `request_reassessment` | Supplemental evidence is first within shared budget | Deterministic/source | supplemental first | overflow/dedupe | 6 supplemental/12 total | `test_supplemental_sources_are_first_and_budgeted` | COVERED |
| REASS-02 | REASSESSMENT | canonical advancement | Unresolved reassessment preserves prior boolean canonical head | Deterministic | TRUE/FALSE reassessment | UNRESOLVED does not advance | expired canonical | `test_expired_canonical_cannot_become_fresh_from_unresolved_latest`; `test_I11_unresolved_reassessment_preserves_boolean_canonical_head` | COVERED |
| CAN-01 | CANONICAL | `should_advance_canonical` | Policy-satisfied TRUE/FALSE advances canonical | Deterministic | boolean + satisfied | unsatisfied | prior unresolved | `test_canonical_rules_match_true_false_unresolved_matrix` | COVERED |
| CAN-02 | CANONICAL | `FactRecord` writes | Latest and canonical pointers are independent | Source/AST/deployed | matching pointers | unresolved latest | separate IDs | `test_canonical_and_latest_are_written_independently`; live canonical/latest reads | COVERED |
| HISTORY-01 | HISTORY | version/supersedes helpers | Versions and supersedes IDs are monotonic/latest-linked | Deterministic | v1→v4 | no duplicate version | first version | `test_history_versions_are_strictly_monotonic`; `test_I23_historical_resolution_versions_are_strict` | COVERED |
| HISTORY-02 | HISTORY | append/history pagination | History is append-only and bounded | Source/deployed | `[2,3]` live history | no mutation/deletion | offset/limit | `test_registry_commits_latest_but_canonical_uses_advance_rule`; deployed history scenario | COVERED |
| CALLBACK-01 | CALLBACK | `_emit_callback` | Callback ID and fixed method are deterministic | Source/helper | target receives ID | arbitrary method absent | target zero | `test_callback_id_is_passed_to_fixed_consumer_method` | COVERED |
| CALLBACK-02 | CALLBACK | ConsumerProbe | First callback accepted; duplicate ignored | Source/AST | callback count increments | duplicate no-op | duplicate counter | `test_callback_is_idempotent`; `test_I10_callback_is_idempotent` | COVERED |
| CALLBACK-03 | CALLBACK | callback retry/ACK | Delivery status is separate from canonical resolution | Source/AST | DISPATCHED/ACK | ACK does not edit fact | FAILED_REPORTED retry | `test_callback_retry_does_not_change_resolution_truth` | COVERED |
| FEES-01 | FEES | fee quote/payment | Reuse and new-request protocol fee branches differ | Source/AST | each quote branch | invalid mode not reuse | zero configured fees | `test_protocol_fee_quote_distinguishes_reuse_from_new_request`; `test_invalid_quote_mode_is_not_treated_as_reuse` | COVERED |
| FEES-02 | FEES | `_take_payment` | Insufficient value rejects; overpayment credits sender | Source/AST | required payment | insufficient | exact surplus | `test_overpayment_becomes_sender_credit_and_withdrawal_is_cleared` | COVERED |
| CREDITS-01 | CREDITS | `withdraw_credit` | Caller withdraws only own credit once | Source/AST | positive own credit | no credit/other account | zero after withdrawal | `test_overpayment_becomes_sender_credit_and_withdrawal_is_cleared` | COVERED |
| CREDITS-02 | CREDITS | `_credit` | Zero amount/address creates no credit | Source/AST | nonzero valid credit | zero inputs | zero address | `test_credit_creation_ignores_zero_and_zero_address` | COVERED |
| PAG-01 | PAGINATION | events/history | Pagination limit is 1..50 | Source/deployed | limit 50 | 0/>50 | offset beyond total | `test_registry_history_and_event_pages_reject_unbounded_limits`; `test_policy_event_page_has_same_limit_guard` | COVERED |
| ERR-01 | ERRORS | error catalog/source | Major auth, input, state, URL, callback, and pagination errors are stable | Source/docs | catalogued codes | missing code detected | operation mapping | `test_major_error_categories_are_catalogued_and_used` | COVERED |
| BOUNDS-01 | BOUNDS | URL/source/text limits | URL, text, description, source, render, and page bounds exist | Source/deterministic | within bound | over bound | max values | `test_scalar_and_url_bounds_are_source_enforced`; seed bound test | COVERED |
| READ-01 | READS | all public views | Every 64 unique public views is called successfully | Deployed read-only | 64/64 | failures recorded | latest-final | `docs/READ_METHOD_CERTIFICATION_FINAL.md`; JSON artifact | COVERED |
| READ-02 | READS | method matrix | Source public methods equal machine-readable inventory | Source/AST | exact 90/64/26 counts | extra/missing method | payable mode | `test_machine_matrix_matches_actual_public_method_names_and_modes` | COVERED |
| FINAL-01 | FINALITY | IC-to-IC callbacks | Resolver/consumer messages use finalized delivery | Source/AST | `emit(on="finalized")` | no non-final path | child reconciliation | `test_registry_resolver_dispatch_and_callbacks_use_finalized_messages` | COVERED |
| SERIAL-01 | SERIALIZATION | job/page/manifest returns | JSON-string fields and audit shapes are explicit | Source/deployed | parseable fields | missing empty shapes | bigint-safe ints | `test_job_snapshot_is_json_and_contains_integration_bindings`; serialization tests | COVERED |
| SERIAL-02 | SERIALIZATION | evidence metadata | Manifest/reasoning are metadata, not critical verdict fields | Deterministic/source | metadata changes allowed | outcome changes critical | bounded summary | `test_validator_critical_fields_exclude_free_form_metadata` | COVERED |

## Explicit security-invariant coverage

`tests/reconstructed/test_security_invariants.py` contains one named test for
each of I1–I23 in `docs/SECURITY_INVARIANTS.md`. All 23 pass. Structural
invariants are intentionally tested against the source because executing
owner/resolver/callback writes against Studio Dev would violate the read-only
closure rules.

## Coverage result

- Test files: 9 total, including the focused SSRF file.
- Tests: 120.
- Pass: 120.
- Fail: 0.
- Skip: 0.
- Deployed public views: 64/64 PASS.
- Important uncovered behavior: none identified in the final comparison of
  the method matrix, protocol types, error catalog, and security invariants.
