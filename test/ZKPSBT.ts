import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { deployments, ethers, getChainId } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZKPSBT, ZKPSBT__factory } from "../typechain";

chai.use(chaiAsPromised);
chai.use(solidity);
const expect = chai.expect;

// contract instances
let zkpSBT: ZKPSBT;

let owner: SignerWithAddress;
let address1: SignerWithAddress;
let address2: SignerWithAddress;
let authority: SignerWithAddress;

const signatureDate = Math.floor(Date.now() / 1000);

let signatureToAddress: string;

const signMintToAddress = async (
  to: string,
  authoritySigner: SignerWithAddress
) => {
  const chainId = await getChainId();

  const signature = await authoritySigner._signTypedData(
    // Domain
    {
      name: "ZKPSBT",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: zkpSBT.address
    },
    // Types
    {
      Mint: [
        { name: "to", type: "address" },
        { name: "authorityAddress", type: "address" },
        { name: "signatureDate", type: "uint256" }
      ]
    },
    // Value
    {
      to: to,
      authorityAddress: authoritySigner.address,
      signatureDate: signatureDate
    }
  );

  return signature;
};

describe("ZKP SBT", () => {
  before(async () => {
    [, owner, address1, address2, authority] = await ethers.getSigners();
  });

  beforeEach(async () => {
    await deployments.fixture("ZKPSBT", {
      fallbackToGlobal: true
    });

    const { address: zkpSBTAddress } = await deployments.get("ZKPSBT");

    zkpSBT = ZKPSBT__factory.connect(zkpSBTAddress, owner);

    // we add authority account
    await zkpSBT.addAuthority(authority.address);

    signatureToAddress = await signMintToAddress(address1.address, authority);
  });

  describe("sbt information", () => {
    it("should be able to get sbt information", async () => {
      expect(await zkpSBT.name()).to.equal("ZKP SBT");

      expect(await zkpSBT.symbol()).to.equal("ZKPSBT");
    });
  });

  describe("mint", () => {
    it("should mint twice", async () => {
      await zkpSBT
        .connect(address1)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address1.address,
          authority.address,
          signatureDate,
          signatureToAddress
        );
      await zkpSBT
        .connect(address1)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address1.address,
          authority.address,
          signatureDate,
          signatureToAddress
        );

      expect(await zkpSBT.totalSupply()).to.equal(2);
      expect(await zkpSBT.tokenByIndex(0)).to.equal(0);
      expect(await zkpSBT.tokenByIndex(1)).to.equal(1);
    });

    it("should mint from final user address", async () => {
      const mintTx = await zkpSBT
        .connect(address1)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address1.address,
          authority.address,
          signatureDate,
          signatureToAddress
        );
      const mintReceipt = await mintTx.wait();

      const toAddress = mintReceipt.events![1].args![1];

      expect(toAddress).to.equal(address1.address);
    });

    it("should mint to an address, with a ZKP SBT not linked to an identity SC", async () => {
      const signatureToAddress2 = await signMintToAddress(
        address2.address,
        authority
      );
      const mintTx = await zkpSBT
        .connect(address2)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address2.address,
          authority.address,
          signatureDate,
          signatureToAddress2
        );
      const mintReceipt = await mintTx.wait();

      const toAddress = mintReceipt.events![1].args![1];

      expect(toAddress).to.equal(address2.address);

      const tokenId = mintReceipt.events![0].args![1].toNumber();

      // check that this ZKP SBT is not linked to an identity
      await expect(zkpSBT.getIdentityId(tokenId)).to.be.revertedWith(
        "NotLinkedToAnIdentitySBT"
      );
    });
  });

  describe("burn", () => {
    it("should burn", async () => {
      // we mint
      let mintTx = await zkpSBT
        .connect(address1)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address1.address,
          authority.address,
          signatureDate,
          signatureToAddress
        );
      let mintReceipt = await mintTx.wait();
      const tokenId1 = mintReceipt.events![0].args![1].toNumber();

      // we mint again
      mintTx = await zkpSBT
        .connect(address1)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address1.address,
          authority.address,
          signatureDate,
          signatureToAddress
        );
      mintReceipt = await mintTx.wait();
      const tokenId2 = mintReceipt.events![0].args![1].toNumber();

      expect(await zkpSBT.balanceOf(address1.address)).to.be.equal(2);
      expect(await zkpSBT.balanceOf(address1.address)).to.be.equal(2);
      expect(await zkpSBT["ownerOf(uint256)"](tokenId1)).to.be.equal(
        address1.address
      );
      expect(await zkpSBT["ownerOf(uint256)"](tokenId2)).to.be.equal(
        address1.address
      );

      await zkpSBT.connect(address1).burn(tokenId1);

      expect(await zkpSBT.balanceOf(address1.address)).to.be.equal(1);

      await zkpSBT.connect(address1).burn(tokenId2);

      expect(await zkpSBT.balanceOf(address1.address)).to.be.equal(0);
    });
  });

  describe("tokenUri", () => {
    it("should get a valid token URI from its tokenId", async () => {
      const mintTx = await zkpSBT
        .connect(address1)
        ["mint(address,address,address,uint256,bytes)"](
          ethers.constants.AddressZero,
          address1.address,
          authority.address,
          signatureDate,
          signatureToAddress
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const tokenUri = await zkpSBT.tokenURI(tokenId);

      // check if it's a valid url
      expect(() => new URL(tokenUri)).to.not.throw();
      // we expect that the token uri is already encoded
      expect(tokenUri).to.equal(encodeURI(tokenUri));
      expect(tokenUri).to.contain("testserver/");
    });
  });
});
