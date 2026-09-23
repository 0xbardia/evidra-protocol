import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDbPool, createDbPool, migrate, ProjectionRepository } from '../src/index.ts';

const url = process.env.EVIDRA_TEST_DATABASE_URL ?? 'postgresql:///evidra_test?host=/var/run/postgresql';

{
  test('migrations and projection upserts are idempotent', async () => {
    const pool = createDbPool(url);
    try {
      await migrate(pool);
      const repository = new ProjectionRepository(pool);
      await repository.upsertFact({ exists: true, fact_key: 'f'.repeat(64), claim_key: 'c'.repeat(64), policy_hash: 'p'.repeat(64), schema_version: '1', mutability: 'IMMUTABLE', current_resolution_id: 1n, latest_resolution_id: 1n, current_request_id: 1n, current_outcome: 'TRUE', resolved_at: 10n, valid_until: 0n, resolution_version: 1, template_hash: '' }, true);
      await repository.upsertResolution({ exists: true, resolution_id: 1n, request_id: 1n, attempt_id: 1n, claim_key: 'c'.repeat(64), fact_key: 'f'.repeat(64), spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), outcome: 'TRUE', diagnostic_reason: 'NONE', policy_satisfied: true, resolver_version: 'v1', evidence_manifest_hash: 'e'.repeat(64), reasoning_summary: 'informational', evaluated_at: 10n, committed_at: 10n, valid_until: 0n, resolution_version: 1, supersedes_resolution_id: 0n, template_id: '', template_version: 0, template_hash: '' }, { canonical: true, latest: true });
      await repository.upsertRequest({ exists: true, request_id: 1n, requester: '0x0000000000000000000000000000000000000001', claim_key: 'c'.repeat(64), fact_key: 'f'.repeat(64), spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), policy_id: 'example_policy', policy_version: 1, assigned_resolver: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477', created_at: 10n, status: 'RESOLVED', active_attempt_id: 1n, last_attempt_at: 10n, retry_after: 0n, max_attempts: 3, attempt_count: 1, callback_target: '0x0000000000000000000000000000000000000000', callback_status: 'NOT_REQUESTED', reuse_mode: 'REUSE_IF_FRESH', fee_paid: 0n, mutability: 'IMMUTABLE', schema_version: '1', ttl_seconds: 0n, seed_urls_json: '[]', subject: 'example.com', predicate: 'publishes Example Domain', object_value: 'Example Domain', qualifiers: '', temporal: '', description: '', current_resolution_id: 1n, supplemental_urls_json: '[]', template_id: '', template_version: 0, template_hash: '', fact_type: '', template_resolution_instructions: '' });
      const found = await repository.getFact('F'.repeat(64));
      assert.equal(found?.fact.current_outcome, 'TRUE');
      assert.equal(found?.canonicalResolution?.resolution_id, 1n);
      assert.equal(found?.currentRequest?.predicate, 'publishes Example Domain');
      const page = await repository.listFacts({ offset: 0, limit: 10, sort: 'recent' });
      assert.equal(page.total, 1);
      assert.equal(page.items.length, 1);
      const searched = await repository.listFacts({ offset: 0, limit: 10, sort: 'recent', search: 'publishes Example Domain' });
      assert.equal(searched.items[0]?.currentRequest?.subject, 'example.com');
      assert.equal((await repository.getStats()).facts, 1);
    } finally {
      await closeDbPool(pool);
    }
  });
}
