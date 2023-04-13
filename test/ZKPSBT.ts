import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { deployments, ethers, getChainId } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  VerifyCreditScore,
  VerifyCreditScore__factory,
  ZKPSBT,
  ZKPSBT__factory
} from "../typechain";
import { Wallet } from "ethers";
import EthCrypto from "eth-crypto";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";

const { genProof } = require("../src/solidity-proof-builder");

chai.use(chaiAsPromised);
chai.use(solidity);
const expect = chai.expect;

// contract instances
let zkpSBT: ZKPSBT;
let verifyCreditScore: VerifyCreditScore;

let owner: SignerWithAddress;
let authority: SignerWithAddress;
let address1: Wallet;

const signatureDate = Math.floor(Date.now() / 1000);
const creditScore = 45;
const threshold = 40;

let encryptedData;
let hashData;
let signature: string;

const signMint = async (
  to: string,
  authoritySigner: SignerWithAddress,
  hashData: string,
  cipherData: string
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
        { name: "signatureDate", type: "uint256" },
        { name: "hashData", type: "bytes" },
        { name: "cipherData", type: "bytes" }
      ]
    },
    // Value
    {
      to: to,
      authorityAddress: authoritySigner.address,
      signatureDate: signatureDate,
      hashData: hashData,
      cipherData: cipherData
    }
  );

  return signature;
};

describe("ZKP SBT", () => {
  before(async () => {
    [, owner, authority] = await ethers.getSigners();
  });

  address1 = new ethers.Wallet(
    ethers.Wallet.createRandom().privateKey,
    ethers.provider
  );

  beforeEach(async () => {
    await deployments.fixture("VerifyCreditScore", {
      fallbackToGlobal: true
    });
    await deployments.fixture("ZKPSBT", {
      fallbackToGlobal: true
    });

    await owner.sendTransaction({
      to: address1.address,
      value: ethers.utils.parseEther("1")
    });

    const { address: zkpSBTAddress } = await deployments.get("ZKPSBT");
    const { address: verifyCreditScoreAddress } = await deployments.get(
      "VerifyCreditScore"
    );

    zkpSBT = ZKPSBT__factory.connect(zkpSBTAddress, owner);
    verifyCreditScore = VerifyCreditScore__factory.connect(
      verifyCreditScoreAddress,
      owner
    );

    // we add authority account
    await zkpSBT.addAuthority(authority.address);

    // hashData = keccak256(toUtf8Bytes(JSON.stringify(data));
    hashData = keccak256(toUtf8Bytes(address1.address + "+" + creditScore));

    // we encrypt data with public key of address1
    const encryptedDataWithPublicKey = await EthCrypto.encryptWithPublicKey(
      address1.publicKey.replace("0x", ""), // publicKey
      creditScore.toString() // message JSON.stringify(data)
    );
    encryptedData = {
      iv: "0x" + encryptedDataWithPublicKey.iv,
      ephemPublicKey: "0x" + encryptedDataWithPublicKey.ephemPublicKey,
      cipherText: "0x" + encryptedDataWithPublicKey.ciphertext,
      mac: "0x" + encryptedDataWithPublicKey.mac
    };

    // middleware signs the mint to let address1 mint
    signature = await signMint(
      address1.address,
      authority,
      hashData,
      encryptedData.cipherText
    );
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
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
        );
      await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
        );

      expect(await zkpSBT.totalSupply()).to.equal(2);
      expect(await zkpSBT.tokenByIndex(0)).to.equal(0);
      expect(await zkpSBT.tokenByIndex(1)).to.equal(1);
    });

    it("should mint from final user address", async () => {
      const mintTx = await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
        );
      const mintReceipt = await mintTx.wait();

      const toAddress = mintReceipt.events![1].args![1];

      expect(toAddress).to.equal(address1.address);
    });
  });

  describe("burn", () => {
    it("should burn", async () => {
      // we mint
      let mintTx = await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
        );
      let mintReceipt = await mintTx.wait();
      const tokenId1 = mintReceipt.events![0].args![1].toNumber();

      // we mint again
      mintTx = await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
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
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
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

  describe("decrypt data", () => {
    it("decrypt the data with address1 private key", async () => {
      const mintTx = await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signature
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkpSBT.sbtData(tokenId);

      // we decrypt the data with the private key of address1
      const decryptedCreditScore = await EthCrypto.decryptWithPrivateKey(
        address1.privateKey.replace("0x", ""), // privateKey
        {
          iv: sbtData.encryptedData.iv.replace("0x", ""),
          ephemPublicKey: sbtData.encryptedData.ephemPublicKey.replace(
            "0x",
            ""
          ),
          ciphertext: sbtData.encryptedData.cipherText.replace("0x", ""),
          mac: sbtData.encryptedData.mac.replace("0x", "")
        } // encrypted-data
      );

      // const dataInAddress1 = JSON.parse(decryptedData);

      // we check that the hash of the data is the same
      expect(
        keccak256(toUtf8Bytes(address1.address + "+" + decryptedCreditScore))
      ).to.equal(sbtData.hashData);

      // we check that the data is the same
      expect(+decryptedCreditScore).to.equal(creditScore);

      // we generate a ZKP proof
      // input public hash
      // input public to
      // input public threshold
      // input private creditScore

      // input of ZKP
      const input = {
        creditScore: +decryptedCreditScore,
        threshold: threshold
      };

      // generate ZKP proof
      const proof = await genProof(input);

      console.log(proof);
      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        threshold
      );
    });
  });
});
