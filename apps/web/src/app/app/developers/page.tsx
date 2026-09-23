import { CONTRACT_ADDRESSES, FROZEN_NETWORK } from '../../../lib/config';
import { ArrowRight, External } from '../../../components/icons';
import { ButtonLink, Hash, SectionHeading } from '../../../components/ui';

export default function DevelopersPage() {
  return <>
    <div className="app-header"><div><span className="eyebrow">Integration surface</span><h1>Developers</h1><p>Read indexed data through the API, verify finalized state with the shared client, and submit user writes from a browser wallet.</p></div><ButtonLink href="/docs/quickstart" variant="primary">Quickstart <ArrowRight size={15} /></ButtonLink></div>
    <SectionHeading eyebrow="Network" title="One frozen deployment" />
    <div className="detail-grid">
      <div className="panel"><div className="panel-heading"><h2>Studio Dev</h2></div><div className="panel-body"><dl className="key-list">
        <div><dt>RPC endpoint</dt><dd className="mono">{FROZEN_NETWORK.rpcUrl}</dd></div>
        <div><dt>Chain ID</dt><dd>{FROZEN_NETWORK.chainId}</dd></div>
        <div><dt>Explorer</dt><dd><a className="external-link" href={FROZEN_NETWORK.explorerUrl} target="_blank" rel="noreferrer noopener">Open explorer <External size={13} /></a></dd></div>
        <div><dt>Read API</dt><dd className="mono">/api/v1</dd></div>
      </dl></div></div>
      <div className="panel"><div className="panel-heading"><h2>Frozen V1 contracts</h2></div><div className="panel-body"><dl className="key-list">
        <div><dt>Registry</dt><dd><Hash value={CONTRACT_ADDRESSES.registry} /></dd></div>
        <div><dt>Policy registry</dt><dd><Hash value={CONTRACT_ADDRESSES.policyRegistry} /></dd></div>
        <div><dt>Resolver</dt><dd><Hash value={CONTRACT_ADDRESSES.resolver} /></dd></div>
        <div><dt>Consumer probe</dt><dd><Hash value={CONTRACT_ADDRESSES.consumerProbe} /></dd></div>
      </dl></div></div>
    </div>
    <div className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Integration rules</h2></div><div className="panel-body">
      <ul className="signal-list"><li><i />The Registry is canonical; API data is an indexed projection.</li><li><i />Read canonical and latest resolution fields separately.</li><li><i />Writes require a connected user wallet on chain 61997.</li><li><i />Callback delivery state is separate from the verdict.</li></ul>
      <div className="hero-actions"><ButtonLink href="/docs/api" variant="secondary">API reference <ArrowRight size={14} /></ButtonLink><ButtonLink href="/docs/contracts" variant="quiet">Contract reference <ArrowRight size={14} /></ButtonLink></div>
    </div></div>
  </>;
}
