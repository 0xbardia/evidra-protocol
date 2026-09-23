'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApi, fetchApi, type ApiPage } from '../../../lib/api';
import { assertAddress } from '../../../lib/config';
import { formatTtl } from '../../../lib/format';
import { templateMutabilityLabel, templateMutabilityRule, templateRequiredFieldsLabel, validateTemplateRequiredFields, validateUrlList } from '../../../lib/validation';
import { deriveFactKey, friendlyWriteMessage, quoteProtocolFee, registryWrite, submitUserWrite, type WriteProgress } from '../../../lib/writes';
import { useWallet } from '../../../components/wallet-context';
import { ArrowLeft, ArrowRight, Check, Refresh } from '../../../components/icons';
import { ButtonLink, ErrorState, Hash, StatusPill } from '../../../components/ui';

interface Policy extends Record<string, unknown> { policy_id: string; version: number; name: string; active: boolean; deprecated: boolean; min_primary_sources: number; min_independent_sources: number; require_cross_check: boolean }
interface Template extends Record<string, unknown> { template_id: string; version: number; name: string; active: boolean; deprecated: boolean; fact_type: string; required_fields: string; default_policy_id: string; default_policy_version: number; template_hash: string }
type RegistryResponse<T> = ApiPage<T>;

const steps = ['Define fact', 'Template', 'Policy', 'Freshness', 'Sources', 'Reuse & callback', 'Review', 'Submit'];
const DRAFT_KEY = 'evidra.create.draft.v1';

interface FormState { subject: string; predicate: string; objectValue: string; qualifiers: string; temporal: string; description: string; mutability: 'IMMUTABLE' | 'MUTABLE_WITH_TTL'; ttl: string; templateId: string; templateVersion: number; policyId: string; policyVersion: number; sources: string; reuseMode: 'REUSE_IF_FRESH' | 'FORCE_FRESH_RESOLUTION'; callback: string }

const initialForm: FormState = { subject: '', predicate: '', objectValue: '', qualifiers: '', temporal: '', description: '', mutability: 'IMMUTABLE', ttl: '0', templateId: '', templateVersion: 1, policyId: '', policyVersion: 1, sources: '', reuseMode: 'REUSE_IF_FRESH', callback: '' };

export default function CreatePage() { return <Suspense fallback={<div className="app-header"><h1>Create fact</h1></div>}><CreateExperience /></Suspense>; }

function CreateExperience() {
  const search = useSearchParams(); const reassessKey = search.get('reassess');
  if (reassessKey) return <ReassessmentPanel factKey={reassessKey} />;
  return <CreateWizard />;
}

function CreateWizard() {
  const wallet = useWallet(); const router = useRouter(); const policies = useApi<RegistryResponse<Policy>>('/policies?limit=50&offset=0'); const templates = useApi<RegistryResponse<Template>>('/templates?limit=50&offset=0'); const [step, setStep] = useState(0); const [form, setForm] = useState<FormState>(initialForm); const [draftLoaded, setDraftLoaded] = useState(false); const [error, setError] = useState<string | null>(null); const [fee, setFee] = useState<bigint | null>(null); const [progress, setProgress] = useState<WriteProgress | null>(null); const [result, setResult] = useState<{ txId: string; factKey?: string; indexed?: boolean } | null>(null);
  useEffect(() => {
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? 'null') as { form?: Partial<FormState>; step?: unknown } | null;
      if (draft?.form && typeof draft.form === 'object') setForm({ ...initialForm, ...draft.form });
      if (typeof draft?.step === 'number' && Number.isInteger(draft.step)) setStep(Math.max(0, Math.min(7, draft.step)));
    } catch { /* a damaged or unavailable browser draft is safe to ignore */ }
    setDraftLoaded(true);
  }, []);
  useEffect(() => {
    if (!draftLoaded) return;
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step })); } catch { /* draft recovery is optional */ }
  }, [draftLoaded, form, step]);
  const activePolicies = useMemo(() => (policies.data?.items ?? []).filter((item) => item.active && !item.deprecated), [policies.data]); const activeTemplates = useMemo(() => (templates.data?.items ?? []).filter((item) => item.active && !item.deprecated), [templates.data]);
  useEffect(() => { const first = activePolicies[0]; if (!form.policyId && first) setForm((current) => ({ ...current, policyId: first.policy_id, policyVersion: first.version })); }, [activePolicies, form.policyId]);
  useEffect(() => { if (form.mutability === 'IMMUTABLE' && form.ttl !== '0') setForm((current) => ({ ...current, ttl: '0' })); }, [form.mutability, form.ttl]);
  const selectedTemplate = activeTemplates.find((item) => item.template_id === form.templateId && item.version === form.templateVersion); const selectedPolicy = activePolicies.find((item) => item.policy_id === form.policyId && item.version === form.policyVersion); const selectedTemplateMutability = selectedTemplate ? templateMutabilityRule(selectedTemplate.fact_type) : null;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const sources = () => form.sources.split('\n').map((value) => value.trim()).filter(Boolean);
  const validateTemplateFields = () => {
    if (!form.templateId) return null;
    if (!selectedTemplate) return 'This template is no longer available. Choose an active template or a custom fact.';
    return validateTemplateRequiredFields(selectedTemplate.required_fields, {
      description: form.description,
      mutability: form.mutability,
      object_value: form.objectValue,
      predicate: form.predicate,
      qualifiers: form.qualifiers,
      subject: form.subject,
      temporal: form.temporal,
    });
  };
  const validateSubmission = (): { step: number; message: string } | null => {
    if (!form.subject.trim() || !form.predicate.trim()) return { step: 0, message: 'Subject and predicate are required.' };
    const templateIssue = validateTemplateFields();
    if (templateIssue) return { step: 0, message: templateIssue };
    if (!selectedTemplate && !selectedPolicy) return { step: 2, message: 'Choose an active policy or template before submitting.' };
    if (selectedTemplateMutability && form.mutability !== selectedTemplateMutability) return { step: 3, message: `This template requires ${templateMutabilityLabel(selectedTemplate!.fact_type).toLowerCase()}.` };
    if (form.mutability === 'MUTABLE_WITH_TTL' && (!Number.isSafeInteger(Number(form.ttl)) || Number(form.ttl) <= 0)) return { step: 3, message: 'Mutable facts require a positive whole-number TTL in seconds.' };
    const sourceIssue = validateUrlList(sources(), 8);
    if (sourceIssue) return { step: 4, message: sourceIssue };
    if (form.callback) {
      try { assertAddress(form.callback, 'Callback target'); }
      catch (cause) { return { step: 5, message: cause instanceof Error ? cause.message : 'Invalid callback target.' }; }
    }
    return null;
  };
  const validateStep = (): string | null => {
    if (step === 0 && (!form.subject.trim() || !form.predicate.trim())) return 'Subject and predicate are required.';
    if ((step === 0 || step === 1) && validateTemplateFields()) return validateTemplateFields();
    if (step === 2 && !form.templateId && !selectedPolicy) return 'Select an active source policy.';
    if (step === 3 && selectedTemplateMutability && form.mutability !== selectedTemplateMutability) return `This template requires ${templateMutabilityLabel(selectedTemplate!.fact_type).toLowerCase()}.`;
    if ((step === 3 || step === 6) && form.mutability === 'MUTABLE_WITH_TTL' && (!Number.isSafeInteger(Number(form.ttl)) || Number(form.ttl) <= 0)) return 'Mutable facts require a positive whole-number TTL in seconds.';
    if (step === 4) return validateUrlList(sources(), 8);
    if (step === 5 && form.callback) { try { assertAddress(form.callback, 'Callback target'); } catch (cause) { return cause instanceof Error ? cause.message : 'Invalid callback target.'; } }
    if (step === 6) return validateSubmission()?.message ?? null;
    return null;
  };
  const next = () => { const issue = validateStep(); if (issue) { setError(issue); if (step === 1 && selectedTemplate && validateTemplateFields()) setStep(0); return; } setError(null); setStep((current) => Math.min(7, current + 1)); };
  const continueToSubmit = () => { const issue = validateSubmission(); if (issue) { setError(issue.message); setStep(issue.step); return; } setError(null); setStep(7); };
  const previous = () => { setError(null); setStep((current) => Math.max(0, current - 1)); };
  const quote = async () => { setError(null); try { setFee(await quoteProtocolFee(form.reuseMode)); } catch (cause) { setError(friendlyWriteMessage(cause)); } };
  const submit = async () => {
    const issue = validateSubmission();
    if (issue) { setError(issue.message); setStep(issue.step); return; }
    if (result?.txId) { setError('This transaction is already finalized. Do not submit it again; check the registry after indexing catches up.'); return; }
    if (!wallet.account || !wallet.rightNetwork) { setError('Connect a wallet on Studio Dev before submitting.'); return; }
    if (!selectedPolicy && !selectedTemplate) { setError('Choose an active policy or template before submitting.'); return; }
    try {
      setError(null);
      const selected = selectedTemplate ? undefined : selectedPolicy;
      const value = fee ?? await quoteProtocolFee(form.reuseMode);
      setFee(value);
      const args = selectedTemplate
        ? [selectedTemplate.template_id, selectedTemplate.version, form.subject, form.predicate, form.objectValue, form.qualifiers, form.temporal, form.mutability, BigInt(form.ttl || '0'), form.description, JSON.stringify(sources()), form.callback, form.reuseMode] as const
        : [form.subject, form.predicate, form.objectValue, form.qualifiers, form.temporal, form.mutability, '1', BigInt(form.ttl || '0'), form.description, selected?.policy_id ?? form.policyId, selected?.version ?? form.policyVersion, JSON.stringify(sources()), form.callback, form.reuseMode] as const;
      const method = selectedTemplate ? 'request_fact_by_template' : 'request_fact';
      const submitted = await submitUserWrite(wallet.account, registryWrite(method, args, value), setProgress);
      setResult({ txId: submitted.txId });
      try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* the finalized write does not depend on storage */ }

      try {
        const identity = { subject: form.subject, predicate: form.predicate, objectValue: form.objectValue, qualifiers: form.qualifiers, temporal: form.temporal, mutability: form.mutability, policyId: selectedTemplate?.default_policy_id ?? selected?.policy_id ?? form.policyId, policyVersion: selectedTemplate?.default_policy_version ?? selected?.version ?? form.policyVersion, ...(selectedTemplate ? { templateId: selectedTemplate.template_id, templateVersion: selectedTemplate.version } : {}) };
        const factKey = await deriveFactKey(identity);
        setResult({ txId: submitted.txId, factKey });
        const check = await fetchApi<{ fact: { exists?: boolean } }>(`/facts/${factKey}?source=cache`);
        if (check.fact?.exists) {
          setResult({ txId: submitted.txId, factKey, indexed: true });
          window.setTimeout(() => router.push(`/app/facts/${factKey}`), 900);
        } else {
          setError('The transaction is finalized, but the Fact is not in the index yet. Do not submit again; check the registry after the next index update.');
        }
      } catch {
        setError('The transaction is finalized, but the Fact lookup is delayed. Do not submit again; check the registry after the read service recovers.');
      }
    } catch (cause) {
      const message = friendlyWriteMessage(cause);
      setError(message);
      setProgress((current) => current?.stage === 'failed' ? current : { method: selectedTemplate ? 'request_fact_by_template' : 'request_fact', stage: 'failed', detail: message });
    }
  };
  const renderStep = () => { if (step === 0) return <><h2>Define the fact</h2><p>Describe one semantic claim. These fields feed the contract&apos;s claim identity; changing them changes the Fact key.</p><div className="form-stack"><Field id="subject" label="Subject" value={form.subject} onChange={(value) => update('subject', value)} placeholder="e.g. https://evidra-protocol.bydx.fun" hint="The entity or object the claim is about." /><Field id="predicate" label="Predicate" value={form.predicate} onChange={(value) => update('predicate', value)} placeholder="e.g. has released version" hint="The relationship you want consensus to assess." /><Field id="object" label="Object / value" value={form.objectValue} onChange={(value) => update('objectValue', value)} placeholder="e.g. 1.0.0" hint="Optional value or target of the predicate." /><Field id="qualifiers" label="Qualifiers" value={form.qualifiers} onChange={(value) => update('qualifiers', value)} placeholder="Optional scope, jurisdiction, or conditions" /><Field id="temporal" label="Temporal constraint" value={form.temporal} onChange={(value) => update('temporal', value)} placeholder="e.g. as of 2026-09-21" hint={selectedTemplate?.required_fields.split(',').map((field) => field.trim()).includes('temporal') ? 'Required by this template.' : undefined} /><Field id="description" label="Description" value={form.description} onChange={(value) => update('description', value)} multiline hint="Human context is stored with the request; template instructions and protocol rules remain authoritative." /></div></>; if (step === 1) return <><h2>Choose a template</h2><p>Use a versioned rule set when the fact type is known. You can also submit a custom specification with an explicit policy.</p><div className="choice-grid"><button type="button" className={`choice-card ${!form.templateId ? 'selected' : ''}`} onClick={() => { update('templateId', ''); setError(null); }}><strong>Custom fact</strong><p>Use your own fields and choose a source policy next.</p></button>{activeTemplates.map((template) => <button type="button" key={`${template.template_id}-${template.version}`} className={`choice-card ${form.templateId === template.template_id && form.templateVersion === template.version ? 'selected' : ''}`} onClick={() => { update('templateId', template.template_id); update('templateVersion', template.version); update('policyId', template.default_policy_id); update('policyVersion', template.default_policy_version); update('mutability', templateMutabilityRule(template.fact_type) ?? form.mutability); setError(null); }}><strong>{template.name || template.template_id} <span className="mono">v{template.version}</span></strong><p>{templateMutabilityLabel(template.fact_type)} · required: {templateRequiredFieldsLabel(template.required_fields)}</p></button>)}</div></>; if (step === 2) return <><h2>Set the evidence policy</h2><p>{selectedTemplate ? 'This template binds its default policy. It will be stored with the exact template and policy hashes.' : 'Choose the policy that determines which source classes and provenance counts can satisfy the resolution.'}</p>{selectedTemplate ? <div className="panel"><div className="panel-body"><StatusPill tone="positive">Bound by template</StatusPill><h3>{selectedTemplate.default_policy_id} / v{selectedTemplate.default_policy_version}</h3><p className="muted">The contract resolves the default policy from the selected template version.</p></div></div> : <div className="choice-grid">{activePolicies.map((policy) => <button type="button" key={`${policy.policy_id}-${policy.version}`} className={`choice-card ${form.policyId === policy.policy_id && form.policyVersion === policy.version ? 'selected' : ''}`} onClick={() => { update('policyId', policy.policy_id); update('policyVersion', policy.version); }}><strong>{policy.name || policy.policy_id} <span className="mono">v{policy.version}</span></strong><p>{policy.min_primary_sources} primary · {policy.min_independent_sources} independent{policy.require_cross_check ? ' · cross-check' : ''}</p></button>)}</div>}{!activePolicies.length && !policies.loading && <ErrorState title="No active policies available" detail="The protocol policy registry is not returning a selectable active policy." />}</>; if (step === 3) return <><h2>Choose freshness</h2><p>{selectedTemplateMutability ? 'This template requires ' + templateMutabilityLabel(selectedTemplate!.fact_type).toLowerCase() + '.' : 'Freshness is a time rule, not confidence. Immutable facts do not expire; mutable facts use the exact TTL you provide.'}</p><div className="choice-grid">{selectedTemplateMutability !== 'MUTABLE_WITH_TTL' && <button type="button" className={'choice-card' + (form.mutability === 'IMMUTABLE' ? ' selected' : '')} onClick={() => update('mutability', 'IMMUTABLE')}><strong>Immutable</strong><p>No TTL expiry. Reassessment is still possible when reality changes.</p></button>}{selectedTemplateMutability !== 'IMMUTABLE' && <button type="button" className={'choice-card' + (form.mutability === 'MUTABLE_WITH_TTL' ? ' selected' : '')} onClick={() => update('mutability', 'MUTABLE_WITH_TTL')}><strong>Mutable with TTL</strong><p>Result remains fresh until the contract&apos;s valid_until boundary.</p></button>}</div>{form.mutability === 'MUTABLE_WITH_TTL' && <Field id="ttl" label="TTL in seconds" value={form.ttl} onChange={(value) => update('ttl', value)} hint={`Current value: ${formatTtl(form.ttl)}. This is freshness, never confidence.`} />}</>; if (step === 4) return <><h2>Add seed evidence</h2><p>One HTTPS domain URL per line. The contract is authoritative; this preflight only catches obvious invalid input before wallet approval.</p><Field id="sources" label="Seed URLs" value={form.sources} onChange={(value) => update('sources', value)} multiline placeholder="https://example.com/source\nhttps://another-domain.example/report" hint="Maximum 8 seed sources. No IP literals, localhost, credentials, fragments, or non-443 ports." /><div className="callout"><strong>Evidence is metadata, not page HTML.</strong>Evidra records URLs, classification, provenance, and policy eligibility. The app never frames or injects remote page content.</div></>; if (step === 5) return <><h2>Reuse & callback</h2><p>Choose whether an existing fresh Fact may be reused. Callback targets are for integrators who understand delivery acknowledgement.</p><div className="choice-grid"><button type="button" className={`choice-card ${form.reuseMode === 'REUSE_IF_FRESH' ? 'selected' : ''}`} onClick={() => update('reuseMode', 'REUSE_IF_FRESH')}><strong>Reuse if fresh</strong><p>Use a fresh canonical resolution when the identity and policy match.</p></button><button type="button" className={`choice-card ${form.reuseMode === 'FORCE_FRESH_RESOLUTION' ? 'selected' : ''}`} onClick={() => update('reuseMode', 'FORCE_FRESH_RESOLUTION')}><strong>Force fresh resolution</strong><p>Always create a new resolution attempt for this request.</p></button></div><Field id="callback" label="Callback target (advanced, optional)" value={form.callback} onChange={(value) => update('callback', value)} placeholder="0x…" hint="The target acknowledges delivery separately from canonical resolution success." /></>; if (step === 6) return <><h2>Review request</h2><p>Review the exact user-facing fields before wallet approval. Fee quote covers configured protocol surcharge; wallet/network execution cost is separate.</p><div className="review-list"><Review label="Fact" value={`${form.subject} · ${form.predicate}`} /><Review label="Object / value" value={form.objectValue || 'None specified'} /><Review label="Qualifiers" value={form.qualifiers || 'None specified'} /><Review label="Time scope" value={form.temporal || 'None specified'} /><Review label="Description" value={form.description || 'None specified'} /><Review label="Template" value={selectedTemplate ? `${selectedTemplate.name || selectedTemplate.template_id} / v${selectedTemplate.version}` : 'Custom'} /><Review label="Policy" value={selectedTemplate ? `${selectedTemplate.default_policy_id} / v${selectedTemplate.default_policy_version}` : `${form.policyId} / v${form.policyVersion}`} /><Review label="Freshness" value={form.mutability === 'IMMUTABLE' ? 'Immutable' : `Mutable with TTL · ${form.ttl}s`} /><Review label="Evidence" value={`${sources().length} seed source${sources().length === 1 ? '' : 's'}`} /><Review label="Reuse" value={form.reuseMode === 'REUSE_IF_FRESH' ? 'Reuse a fresh Fact' : 'Require a new resolution'} /><Review label="Callback" value={form.callback || 'None'} /><Review label="Network" value={`Studio Dev · chain 61997`} /></div><div className="hero-actions"><button className="button button-secondary" type="button" onClick={() => void quote()}>Get fee quote</button>{fee !== null && <StatusPill tone="positive">Protocol fee: {fee.toString()}</StatusPill>}</div></>; return <><h2>Submit to the protocol</h2><p>Wallet approval starts a GenLayer transaction. Finalized transaction state is followed by a finalized Fact read before this flow redirects.</p><SubmitPanel progress={progress} result={result} error={error} fee={fee} /></>; };
  return <><div className="app-header"><div><span className="eyebrow">New protocol request</span><h1>Create fact</h1><p>A guided path from a semantic claim to a user-signed request.</p></div><ButtonLink href="/app/facts" variant="secondary">Cancel <ArrowLeft size={14} /></ButtonLink></div><div className="wizard"><nav className="wizard-steps" aria-label="Create fact steps">{steps.map((label, index) => <button type="button" key={label} className={`wizard-step ${index === step ? 'current' : ''} ${index < step ? 'complete' : ''}`} onClick={() => index <= step && setStep(index)}><span className="wizard-step-index">{index < step ? <Check size={13} /> : index + 1}</span>{label}</button>)}</nav><section className="wizard-form">{renderStep()}{error && step !== 7 && <p className="field-error" role="alert">{error}</p>}<div className="form-actions">{step > 0 ? <button className="button button-quiet" type="button" onClick={previous}><ArrowLeft size={14} /> Back</button> : <span />}{step < 6 ? <button className="button button-primary" type="button" onClick={next}>Continue <ArrowRight size={14} /></button> : step === 6 ? <button className="button button-primary" type="button" onClick={continueToSubmit}>Continue to submit <ArrowRight size={14} /></button> : <button className="button button-primary" type="button" onClick={() => void submit()} disabled={Boolean(progress && ['preparing', 'wallet', 'submitted', 'consensus', 'decided', 'finalizing'].includes(progress.stage)) || Boolean(result?.factKey)}>Approve in wallet <ArrowRight size={14} /></button>}</div></section></div></>;
}

function Field({ id, label, value, onChange, placeholder, hint, multiline = false }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; hint?: string | undefined; multiline?: boolean }) { return <div className="form-field"><label htmlFor={id}>{label}</label>{multiline ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}{hint && <span className="field-hint">{hint}</span>}</div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="review-item"><dt>{label}</dt><dd>{value}</dd></div>; }
function SubmitPanel({ progress, result, error, fee }: { progress: WriteProgress | null; result: { txId: string; factKey?: string; indexed?: boolean } | null; error: string | null; fee: bigint | null }) {
  const stages = ['preparing', 'wallet', 'submitted', 'consensus', 'decided', 'finalizing', 'finalized'] as const;
  const current = progress ? stages.indexOf(progress.stage as (typeof stages)[number]) : -1;
  return <div className="tx-panel">
    {fee !== null && <p className="field-hint">Protocol fee quoted: {fee.toString()} base units. Wallet execution cost is separate.</p>}
    <div className="tx-progress">{stages.slice(0, -1).map((stage, index) => <div className={`tx-step ${progress?.stage === stage ? 'active' : ''} ${index < current ? 'done' : ''}`} key={stage}>{index + 1}<span>{stage === 'wallet' ? 'Wallet approval' : stage[0]?.toUpperCase() + stage.slice(1)}</span></div>)}</div>
    {progress && <p role="status">{progress.detail ?? `Transaction is ${progress.stage}.`}</p>}
    {result && <>
      <StatusPill tone={progress?.stage === 'finalized' ? 'positive' : 'warning'}>{progress?.stage === 'finalized' ? 'Transaction finalized' : 'Transaction submitted'}</StatusPill>
      <p className="field-hint">{result.indexed ? 'The Fact is indexed and ready to view.' : result.factKey ? 'The Fact key is known; the registry projection may still be catching up.' : 'The transaction is recorded. Fact details will appear after its key can be verified.'}</p>
      <Hash value={result.txId} label="Copy transaction" />
      {result.factKey && <Hash value={result.factKey} label="Copy Fact key" />}
      {!result.indexed && <ButtonLink href="/app/facts" variant="secondary">Search the registry <ArrowRight size={14} /></ButtonLink>}
    </>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}

function ReassessmentPanel({ factKey }: { factKey: string }) {
  const wallet = useWallet();
  const [urls, setUrls] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (!wallet.account || !wallet.rightNetwork) { setError('Connect a wallet on Studio Dev before submitting.'); return; }
    const list = urls.split('\n').map((value) => value.trim()).filter(Boolean);
    const issue = validateUrlList(list, 8);
    if (issue) { setError(issue); return; }
    try {
      setError(null);
      const fee = await quoteProtocolFee('FORCE_FRESH_RESOLUTION');
      await submitUserWrite(wallet.account, registryWrite('request_reassessment', [factKey, JSON.stringify(list), notes, ''], fee), setProgress);
    } catch (cause) {
      const message = friendlyWriteMessage(cause);
      setError(message);
      setProgress((current) => current?.stage === 'failed' ? current : { method: 'request_reassessment', stage: 'failed', ...(current?.txId ? { txId: current.txId } : {}), detail: message });
    }
  };
  return <>
    <div className="app-header"><div><span className="eyebrow">New evidence / {factKey.slice(0, 10)}…</span><h1>Request reassessment</h1><p>Add new real-world sources to an existing Fact. This preserves history and is not a validator appeal.</p></div><ButtonLink href={`/app/facts/${factKey}`} variant="secondary">Back to Fact <ArrowLeft size={14} /></ButtonLink></div>
    <div className="panel" style={{ maxWidth: 760 }}><div className="panel-body"><div className="form-stack">
      <Field id="reassessment-sources" label="Supplemental HTTPS sources" value={urls} onChange={setUrls} multiline placeholder="https://new-source.example/report" hint="One source per line. Supplemental sources are processed before the original seed list." />
      <Field id="reassessment-notes" label="Notes (optional)" value={notes} onChange={setNotes} multiline hint="Stored as request context; it cannot override template or policy rules." />
      <div className="form-actions"><span /><button type="button" className="button button-primary" onClick={() => void run()} disabled={Boolean(progress && progress.stage !== 'failed' && progress.stage !== 'finalized')}>Approve reassessment <Refresh size={14} /></button></div>
      {progress && <SubmitPanel progress={progress} result={progress.txId ? { txId: progress.txId } : null} error={error} fee={null} />}
    </div></div></div>
  </>;
}
