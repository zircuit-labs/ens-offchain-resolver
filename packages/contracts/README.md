# ENS Offchain Resolver Contracts

This package contains Solidity contracts you can customise and deploy to provide offchain resolution of ENS names.

These contracts implement [ENSIP 10](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution) (wildcard resolution support) and [EIP 3668](https://eips.ethereum.org/EIPS/eip-3668) (CCIP Read). Together this means that the resolver contract can be very straightforward; it simply needs to respond to all resolution requests with a redirect to your gateway, and verify gateway responses by checking the signature on the returned message.

These contracts can also be used as a starting point for other verification methods, such as allowing the owner of the name to sign the records themselves, or relying on another verification mechanism such as a merkle tree or an L2 such as Optimism. To do so, start by replacing the calls to `SignatureVerifier` in `OffchainResolver` with your own solution.

Steps for deploying and end to end testing this contract can be found in the project root folder.

## Contracts

### [IExtendedResolver.sol](contracts/IExtendedResolver.sol)
This is the interface for wildcard resolution specified in ENSIP 10. In time this will likely be moved to the [@ensdomains/ens-contracts](https://github.com/ensdomains/ens-contracts) repository.

### [SignatureVerifier.sol](contracts/SignatureVerifier.sol)
This library facilitates checking signatures over CCIP read responses.

### [OffchainResolver.sol](contracts/OffchainResolver.sol)
This contract implements the offchain resolution system. Set this contract as the resolver for a name, and that name and all its subdomains that are not present in the ENS registry will be resolved via the provided gateway by supported clients.

### ENV VARS

- `ETHERSCAN_API_KEY`: etherscan api key for verify the contracts
- `SEPOLIA_ALCHEMY_KEY`: alchemy api key for sepolia
- `ETH_ALCHEMY_KEY`: alchemy api key for the ethereum mainnet
- `DEPLOYER_PRIVATE_KEY`: deployer private key, without `0x` prefix
- `DEPLOYER_ADDRESS`: deployer address, for local testing, left this envvar empty in order to use the default ethers.js signers
- `SIGNER_ADDRESS`: signer address that is used by the gateway, testing signer: `0x56b5d20AFB05EdAf36fdAC47C52D7912fE9684a7`, for local testing, left this envvar empty in order to use the default ethers.js signers
- `GATEWAY_URL`: gateway url for the lookup endpoint, testing gateway: `https://ens-offchain-resolver-poc-53bc35fa24af.herokuapp.com`
