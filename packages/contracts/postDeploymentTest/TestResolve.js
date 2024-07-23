const { ethers } = require("hardhat");
const { dnsName } = require("../utils");
const {
  abi,
} = require("../artifacts/contracts/OffchainResolver.sol/OffchainResolver.json");
const {
  abi: officialResolverAbi,
} = require("@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json");

const provider = new ethers.providers.AlchemyProvider(
  "mainnet",
  process.env.ETH_ALCHEMY_KEY
);

const main = async () => {
  const simpleName = process.argv[2] ?? 'martinet.zircut.com'

  // need to update the address of the resolver contract
  const resolver = new ethers.Contract(
    "0xDE70A11f68bc27C5cf10782810e268F673Dd71EC",
    abi,
    provider
  );

  // STEP #1 Follow CCIP Protocol to call resolve on the contract, should return a OffchainLookup Error
  const Resolver = new ethers.utils.Interface(officialResolverAbi);
  const callData = Resolver.encodeFunctionData("addr(bytes32)", [
    ethers.utils.namehash(simpleName),
  ]);
  const name = dnsName(simpleName);

  let extraData, urls, sender, gatewayCallData;

  try {
    await resolver.resolve(name, callData);
    throw Error('Contract should have failed for CCIP protocol')
  } catch (e) {
    urls = e.errorArgs.urls;
    sender = e.errorArgs.sender
    gatewayCallData = e.errorArgs.callData
    extraData = e.errorArgs.extraData
  }

  // STEP #2 Follow CCIP Protocol to fetch data from Gateways
  let successfulGatewayCall = false, i = 0;
  let result;
  while (!successfulGatewayCall && i < urls.length) {
    const url = urls[i].replace('{data}', gatewayCallData).replace('{sender}', sender)

    try {
      const fetchResponse = await fetch(url)
      result = await fetchResponse.json()

      // If we don't get a real response back from the gateway, we should try the other urls in the list
      successfulGatewayCall = !!result
    } catch (e) {
      console.log(e)
    }

    i++;
  }

  // STEP #3 Follow CCIP Protocol to hit the contract again to verify and decode the data
  const resultData = await resolver.resolveWithProof(result.data, extraData);
  console.log("result data:", resultData);
};

main();
