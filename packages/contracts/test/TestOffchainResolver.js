const { expect } = require("chai");
const { ethers } = require("hardhat");
const namehash = require("eth-ens-namehash");
const {
  defaultAbiCoder,
  SigningKey,
  arrayify,
  hexConcat,
} = require("ethers/lib/utils");
const { dnsName } = require("../utils");

const TEST_ADDRESS = "0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe";

describe("OffchainResolver", function(accounts) {
  let signer, address, resolver, snapshot, signingKey, signingAddress;

  async function fetcher(url, json) {
    console.log({ url, json });
    return {
      jobRunId: "1",
      statusCode: 200,
      data: {
        result: "0x",
      },
    };
  }

  before(async () => {
    signingKey = new SigningKey(ethers.utils.randomBytes(32));
    signingAddress = ethers.utils.computeAddress(signingKey.privateKey);
    signer = await ethers.provider.getSigner();
    address = await signer.getAddress();
    const OffchainResolver = await ethers.getContractFactory(
      "OffchainResolver"
    );
    resolver = await OffchainResolver.deploy("http://localhost:8080/", [
      signingAddress,
    ]);
  });

  beforeEach(async () => {
    snapshot = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshot]);
  });

  describe("addSigners()", async () => {
    it("allows owner to add signers", async () => {
      const signers = await ethers.getSigners();
      await resolver.addSigners(signers.map((signer) => signer.address));
      for (signer of signers) {
        expect(await resolver.signers(signer.address)).to.equal(true);
      }
    });

    it("does not allow non-owner to add signers", async () => {
      const signers = await ethers.getSigners();
      await expect(
        resolver
          .connect(signers[1])
          .addSigners(signers.map((signer) => signer.address))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("removeSigners()", async () => {
    it("allows owner to remove signers", async () => {
      await resolver.disableSigner(signingAddress);
      expect(await resolver.signers(signingAddress)).to.equal(false);
    });

    it("does not allow non-owner to remove signers", async () => {
      const [, notOwner] = await ethers.getSigners();
      await expect(
        resolver.connect(notOwner).disableSigner(signingAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setUrl()", async () => {
    it("allows owner to set url", async () => {
      await resolver.setUrl("http://localhost:8081/");
      expect(await resolver.url()).to.equal("http://localhost:8081/");
    });

    it("does not allow non-owner to set url", async () => {
      const [, notOwner] = await ethers.getSigners();
      await expect(
        resolver.connect(notOwner).setUrl("http://localhost:8081/")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("supportsInterface()", async () => {
    it("supports known interfaces", async () => {
      expect(await resolver.supportsInterface("0x9061b923")).to.equal(true); // IExtendedResolver
    });

    it("does not support a random interface", async () => {
      expect(await resolver.supportsInterface("0x3b3b57df")).to.equal(false);
    });
  });

  describe("resolve()", async () => {
    it("returns a CCIP-read error", async () => {
      await expect(
        resolver.resolve(dnsName("test.eth"), "0x")
      ).to.be.revertedWith("OffchainLookup");
    });
  });

  describe("resolveWithProof()", async () => {
    let name, expires, iface, callData, resultData, sig;

    before(async () => {
      name = "test.eth";
      expires = Math.floor(Date.now() / 1000 + 3600);
      // Encode the nested call to 'addr'
      iface = new ethers.utils.Interface([
        "function addr(bytes32) returns(address)",
      ]);
      const addrData = iface.encodeFunctionData("addr", [
        namehash.hash("test.eth"),
      ]);

      // Encode the outer call to 'resolve'
      callData = resolver.interface.encodeFunctionData("resolve", [
        dnsName("test.eth"),
        addrData,
      ]);

      // Encode the result data
      resultData = iface.encodeFunctionResult("addr", [TEST_ADDRESS]);

      // Generate a signature hash for the response from the gateway
      const callDataHash = await resolver.makeSignatureHash(
        resolver.address,
        expires,
        callData,
        resultData
      );

      // Sign it
      sig = signingKey.signDigest(callDataHash);
    });

    it("resolves an address given a valid signature", async () => {
      // Generate the response data
      const response = defaultAbiCoder.encode(
        ["bytes", "uint64", "bytes"],
        [resultData, expires, hexConcat([sig.r, sig._vs])]
      );
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ["bytes", "address"],
        [callData, resolver.address]
      );

      // Call the function with the request and response
      const [result] = iface.decodeFunctionResult(
        "addr",
        await resolver.resolveWithProof(response, encodedData)
      );
      expect(result).to.equal(TEST_ADDRESS);
    });

    it("reverts given an invalid signature", async () => {
      // Corrupt the sig
      const deadsig = arrayify(hexConcat([sig.r, sig._vs])).slice();
      deadsig[0] = deadsig[0] + 1;

      // Generate the response data
      const response = defaultAbiCoder.encode(
        ["bytes", "uint64", "bytes"],
        [resultData, expires, deadsig]
      );

      // Call the function with the request and response
      await expect(resolver.resolveWithProof(response, callData)).to.be
        .reverted;
    });

    it("reverts given an expired signature", async () => {
      // Generate the response data
      const response = defaultAbiCoder.encode(
        ["bytes", "uint64", "bytes"],
        [
          resultData,
          Math.floor(Date.now() / 1000 - 1),
          hexConcat([sig.r, sig._vs]),
        ]
      );

      // Call the function with the request and response
      await expect(resolver.resolveWithProof(response, callData)).to.be
        .reverted;
    });
  });
});
