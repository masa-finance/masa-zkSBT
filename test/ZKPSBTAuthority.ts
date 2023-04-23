import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  VerifyCreditScore,
  VerifyCreditScore__factory,
  ZKPSBTAuthority,
  ZKPSBTAuthority__factory
} from "../typechain";
import { Wallet } from "ethers";
import EthCrypto from "eth-crypto";
import { poseidon2 } from "poseidon-lite";
import publicKeyToAddress from "ethereum-public-key-to-address";

const { genProof } = require("../src/solidity-proof-builder");

chai.use(chaiAsPromised);
chai.use(solidity);
const expect = chai.expect;

// contract instances
let zkpSBTAuthority: ZKPSBTAuthority;
let verifyCreditScore: VerifyCreditScore;

let owner: SignerWithAddress;
let address1: Wallet;

const creditScore = 45;
const threshold = 40;

let encryptedData;
let hashData;
let hashDataHex;

describe("ZKP SBT Authority", () => {
  beforeEach(async () => {
    [, owner] = await ethers.getSigners();

    address1 = new ethers.Wallet(
      "0x41c5ab8f659237772a24848aefb3700202ec730c091b3c53affe3f9ebedbc3c9",
      // ethers.Wallet.createRandom().privateKey,
      ethers.provider
    );

    await deployments.fixture("ZKPSBTAuthority", {
      fallbackToGlobal: true
    });
    await deployments.fixture("VerifyCreditScore", {
      fallbackToGlobal: true
    });

    await owner.sendTransaction({
      to: address1.address,
      value: ethers.utils.parseEther("1")
    });

    const { address: zkpSBTAddress } = await deployments.get("ZKPSBTAuthority");
    const { address: verifyCreditScoreAddress } = await deployments.get(
      "VerifyCreditScore"
    );

    zkpSBTAuthority = ZKPSBTAuthority__factory.connect(zkpSBTAddress, owner);
    verifyCreditScore = VerifyCreditScore__factory.connect(
      verifyCreditScoreAddress,
      owner
    );

    // middleware checks that public key belongs to address1
    expect(publicKeyToAddress(address1.publicKey)).to.be.equal(
      address1.address
    );

    // middleware calculates hash of data
    hashData = poseidon2([BigInt(address1.address), BigInt(creditScore)]);
    hashDataHex = "0x" + BigInt(hashData).toString(16);

    // middleware encrypts data with public key of address1
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
  });

  describe("sbt information", () => {
    it("should be able to get sbt information", async () => {
      expect(await zkpSBTAuthority.name()).to.equal("ZKP SBT");

      expect(await zkpSBTAuthority.symbol()).to.equal("ZKPSBT");
    });
  });

  describe("mint", () => {
    it("should mint from owner", async () => {
      const mintTx = await zkpSBTAuthority
        .connect(owner)
        .mint(address1.address, hashDataHex, encryptedData);
      const mintReceipt = await mintTx.wait();

      const toAddress = mintReceipt.events![1].args![1];

      expect(toAddress).to.equal(address1.address);
    });

    it("should fail to mint from non minter address", async () => {
      await expect(
        zkpSBTAuthority
          .connect(address1)
          .mint(address1.address, hashDataHex, encryptedData)
      ).to.be.reverted;
    });
  });

  describe("burn", () => {
    it("should burn", async () => {
      // we mint
      let mintTx = await zkpSBTAuthority
        .connect(owner)
        .mint(address1.address, hashDataHex, encryptedData);
      let mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();

      const balanceBefore = await zkpSBTAuthority.balanceOf(address1.address);

      await zkpSBTAuthority.connect(address1).burn(tokenId);

      expect(await zkpSBTAuthority.balanceOf(address1.address)).to.be.equal(
        balanceBefore.toNumber() - 1
      );
    });
  });

  describe("tokenUri", () => {
    it("should get a valid token URI from its tokenId", async () => {
      const mintTx = await zkpSBTAuthority
        .connect(owner)
        .mint(address1.address, hashDataHex, encryptedData);

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const tokenUri = await zkpSBTAuthority.tokenURI(tokenId);

      // check if it's a valid url
      expect(() => new URL(tokenUri)).to.not.throw();
      // we expect that the token uri is already encoded
      expect(tokenUri).to.equal(encodeURI(tokenUri));
      expect(tokenUri).to.contain("testserver/");
    });
  });

  describe("decrypt data", () => {
    it("decrypt the data with address1 private key and generate/validate proof", async () => {
      const mintTx = await zkpSBTAuthority
        .connect(owner)
        .mint(address1.address, hashDataHex, encryptedData);

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkpSBTAuthority.sbtData(tokenId);

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

      // we check that the hash of the data is the same
      expect(
        "0x" +
          BigInt(
            poseidon2([BigInt(address1.address), BigInt(decryptedCreditScore)])
          ).toString(16)
      ).to.equal(sbtData.hashData);

      // we check that the data is the same
      expect(+decryptedCreditScore).to.equal(creditScore);

      // input of ZKP
      const input = {
        hashData: sbtData.hashData,
        ownerAddress: address1.address,
        threshold: threshold,
        creditScore: +decryptedCreditScore
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkpSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(threshold);
    });

    it("proof with invalid creditScore will fail (incorrect hash)", async () => {
      const mintTx = await zkpSBTAuthority
        .connect(owner)
        .mint(address1.address, hashDataHex, encryptedData);

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkpSBTAuthority.sbtData(tokenId);

      // input of ZKP
      const input = {
        hashData: sbtData.hashData,
        ownerAddress: address1.address,
        threshold: threshold,
        creditScore: 55 // invalid credit score
      };

      // generate ZKP proof will fail because the hash is not correct
      await expect(genProof(input)).to.throw;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });
  });
});
