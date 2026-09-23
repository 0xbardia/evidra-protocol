# Wallet Integration

Phase 2 uses a browser-injected EIP-1193 provider (`window.ethereum`) and the
connected user account. The application never asks for a seed phrase, stores
private key material, or signs on the server.

## Network guard

Every write checks `eth_chainId` immediately before submission and accepts
only chain `61997` (GenLayer Studio Dev). The wallet button reports a wrong
network and offers `wallet_switchEthereumChain`; if the wallet reports the
chain is missing, it offers `wallet_addEthereumChain` with the frozen public
RPC metadata. The app never silently submits to another chain.

## Account lifecycle

The provider is observed for `accountsChanged` and `chainChanged`. A changed
account or chain immediately changes write availability. Disconnect is a local
UI state reset; the app does not attempt wallet custody or account revocation.

## Public configuration

Only public deployment data is exposed through `NEXT_PUBLIC_` variables. The
values are checked against the frozen constants in `@evidra/protocol`, so a
local environment cannot silently point the UI at an older Evidra deployment.

## Pending writes

After wallet submission, the method, account, transaction ID, and timestamp
are stored in local storage under `evidra.pending.write.v1`. This is a
recovery pointer, not a credential. On the app shell’s next load the adapter
reconnects to the transaction through read-only SDK calls, waits for decision
and finalization, and clears the pointer only after successful finalization.
An existing pending pointer blocks another write to prevent accidental
double submission.
