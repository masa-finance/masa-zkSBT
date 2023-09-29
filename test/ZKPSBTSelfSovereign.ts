import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { deployments, ethers, getChainId } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  VerifyCreditScore,
  VerifyCreditScore__factory,
  ZKPSBTSelfSovereign,
  ZKPSBTSelfSovereign__factory
} from "../typechain";
import { Wallet } from "ethers";
import publicKeyToAddress from "ethereum-public-key-to-address";

const buildPoseidon = require("circomlibjs").buildPoseidon;

const {
  encryptWithPublicKey,
  decryptWithPrivateKey
} = require("../src/crypto");
const { genProof } = require("../src/solidity-proof-builder");

chai.use(chaiAsPromised);
chai.use(solidity);
const expect = chai.expect;

// contract instances
let zkpSBTSelfSovereign: ZKPSBTSelfSovereign;
let verifyCreditScore: VerifyCreditScore;

let owner: SignerWithAddress;
let authority: SignerWithAddress;
let address1: Wallet;

const signatureDate = Math.floor(Date.now() / 1000);
const creditScore = 45;
const income = 3100;
const reportDate = new Date("2023-01-31T20:23:01.804Z").getTime();
const threshold = 40;
const operator = 4; // 4 = greater than or equal to

let encryptedCreditScore;
let encryptedIncome;
let encryptedReportDate;
let root;
let rootHex;
let signature: string;

const signMint = async (
  to: string,
  authoritySigner: SignerWithAddress,
  root: string,
  encryptedCreditScore: string,
  encryptedIncome: string,
  encryptedReportDate: string
) => {
  const chainId = await getChainId();

  const signature = await authoritySigner._signTypedData(
    // Domain
    {
      name: "ZKPSBTSelfSovereign",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: zkpSBTSelfSovereign.address
    },
    // Types
    {
      Mint: [
        { name: "to", type: "address" },
        { name: "authorityAddress", type: "address" },
        { name: "signatureDate", type: "uint256" },
        { name: "root", type: "bytes" },
        { name: "encryptedCreditScore", type: "bytes" },
        { name: "encryptedIncome", type: "bytes" },
        { name: "encryptedReportDate", type: "bytes" }
      ]
    },
    // Value
    {
      to: to,
      authorityAddress: authoritySigner.address,
      signatureDate: signatureDate,
      root: root,
      encryptedCreditScore: encryptedCreditScore,
      encryptedIncome: encryptedIncome,
      encryptedReportDate: encryptedReportDate
    }
  );

  return signature;
};

describe("ZKP SBT SelfSovereign", () => {
  beforeEach(async () => {
    [, owner, authority] = await ethers.getSigners();

    address1 = new ethers.Wallet(
      "0x41c5ab8f659237772a24848aefb3700202ec730c091b3c53affe3f9ebedbc3c9",
      // ethers.Wallet.createRandom().privateKey,
      ethers.provider
    );

    await deployments.fixture("ZKPSBTSelfSovereign", {
      fallbackToGlobal: true
    });
    await deployments.fixture("VerifyCreditScore", {
      fallbackToGlobal: true
    });

    await owner.sendTransaction({
      to: address1.address,
      value: ethers.utils.parseEther("1")
    });

    const { address: zkpSBTAddress } = await deployments.get(
      "ZKPSBTSelfSovereign"
    );
    const { address: verifyCreditScoreAddress } = await deployments.get(
      "VerifyCreditScore"
    );

    zkpSBTSelfSovereign = ZKPSBTSelfSovereign__factory.connect(
      zkpSBTAddress,
      owner
    );
    verifyCreditScore = VerifyCreditScore__factory.connect(
      verifyCreditScoreAddress,
      owner
    );

    // we add authority account
    await zkpSBTSelfSovereign.addAuthority(authority.address);

    // middleware checks that public key belongs to address1
    expect(publicKeyToAddress(address1.publicKey)).to.be.equal(
      address1.address
    );

    // middleware calculates hash of data
    const poseidon = await buildPoseidon();
    root = poseidon([
      BigInt(address1.address),
      BigInt(creditScore),
      BigInt(income),
      BigInt(reportDate)
    ]);
    rootHex = "0x" + BigInt(poseidon.F.toString(root)).toString(16);

    // middleware encrypts data with public key of address1
    encryptedCreditScore = await encryptWithPublicKey(
      address1.publicKey,
      creditScore.toString()
    );

    encryptedIncome = await encryptWithPublicKey(
      address1.publicKey,
      income.toString()
    );

    encryptedReportDate = await encryptWithPublicKey(
      address1.publicKey,
      reportDate.toString()
    );

    // middleware signs the mint to let address1 mint
    signature = await signMint(
      address1.address,
      authority,
      rootHex,
      encryptedCreditScore.ciphertext,
      encryptedIncome.ciphertext,
      encryptedReportDate.ciphertext
    );
  });

  describe("sbt information", () => {
    it("should be able to get sbt information", async () => {
      expect(await zkpSBTSelfSovereign.name()).to.equal("ZKP SBT");

      expect(await zkpSBTSelfSovereign.symbol()).to.equal("ZKPSBT");
    });
  });

  describe("mint", () => {
    it("should mint from final user address", async () => {
      const mintTx = await zkpSBTSelfSovereign
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate,
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
      let mintTx = await zkpSBTSelfSovereign
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate,
          signature
        );
      let mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();

      const balanceBefore = await zkpSBTSelfSovereign.balanceOf(
        address1.address
      );

      await zkpSBTSelfSovereign.connect(address1).burn(tokenId);

      expect(await zkpSBTSelfSovereign.balanceOf(address1.address)).to.be.equal(
        balanceBefore.toNumber() - 1
      );
    });
  });

  describe("tokenUri", () => {
    it("should get a valid token URI from its tokenId", async () => {
      const mintTx = await zkpSBTSelfSovereign
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate,
          signature
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const tokenUri = await zkpSBTSelfSovereign.tokenURI(tokenId);

      // check if it's a valid url
      expect(() => new URL(tokenUri)).to.not.throw();
      // we expect that the token uri is already encoded
      expect(tokenUri).to.equal(encodeURI(tokenUri));
      expect(tokenUri).to.contain("testserver/");
    });
  });

  describe("decrypt data", () => {
    it("decrypt the data with address1 private key and generate/validate proof", async () => {
      const mintTx = await zkpSBTSelfSovereign
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate,
          signature
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkpSBTSelfSovereign.sbtData(tokenId);

      // we decrypt the data with the private key of address1
      const decryptedCreditScore = await decryptWithPrivateKey(
        address1.privateKey,
        sbtData.encryptedCreditScore
      );
      const decryptedIncome = await decryptWithPrivateKey(
        address1.privateKey,
        sbtData.encryptedIncome
      );
      const decryptedReportDate = await decryptWithPrivateKey(
        address1.privateKey,
        sbtData.encryptedReportDate
      );

      // we check that the hash of the data is the same
      const poseidon = await buildPoseidon();
      expect(
        "0x" +
          BigInt(
            poseidon.F.toString(
              poseidon([
                BigInt(address1.address),
                BigInt(decryptedCreditScore),
                BigInt(income),
                BigInt(reportDate)
              ])
            )
          ).toString(16)
      ).to.equal(sbtData.root);

      // we check that the data is the same
      expect(+decryptedCreditScore).to.equal(creditScore);

      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: threshold,
        operator: operator,
        value: +decryptedCreditScore,
        data: [
          address1.address,
          +decryptedCreditScore,
          +decryptedIncome,
          +decryptedReportDate
        ]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkpSBTSelfSovereign.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(threshold);
    });

    it("proof with invalid creditScore will fail (incorrect hash)", async () => {
      const mintTx = await zkpSBTSelfSovereign
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate,
          signature
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkpSBTSelfSovereign.sbtData(tokenId);

      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: threshold,
        operator: operator,
        value: 55, // invalid credit score
        data: [address1.address, 55, income, reportDate]
      };

      // generate ZKP proof will fail because the hash is not correct
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });
  });
});
