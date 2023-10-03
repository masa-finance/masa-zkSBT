import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  VerifyCreditScore,
  VerifyCreditScore__factory,
  ZKSBTAuthority,
  ZKSBTAuthority__factory
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
let zkSBTAuthority: ZKSBTAuthority;
let verifyCreditScore: VerifyCreditScore;

let owner: SignerWithAddress;
let address1: Wallet;

const creditScore = 45;
const income = 3100;
const reportDate = new Date("2023-01-31T20:23:01.804Z").getTime();

let encryptedCreditScore;
let encryptedIncome;
let encryptedReportDate;
let root;
let rootHex;

describe("ZKP SBT Authority", () => {
  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    address1 = new ethers.Wallet(
      "0x41c5ab8f659237772a24848aefb3700202ec730c091b3c53affe3f9ebedbc3c9",
      // ethers.Wallet.createRandom().privateKey,
      ethers.provider
    );

    await deployments.fixture("ZKSBTAuthority", {
      fallbackToGlobal: true
    });
    await deployments.fixture("VerifyCreditScore", {
      fallbackToGlobal: true
    });

    await owner.sendTransaction({
      to: address1.address,
      value: ethers.utils.parseEther("1")
    });

    const { address: zkSBTAddress } = await deployments.get("ZKSBTAuthority");
    const { address: verifyCreditScoreAddress } = await deployments.get(
      "VerifyCreditScore"
    );

    zkSBTAuthority = ZKSBTAuthority__factory.connect(zkSBTAddress, owner);
    verifyCreditScore = VerifyCreditScore__factory.connect(
      verifyCreditScoreAddress,
      owner
    );

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
  });

  describe("sbt information", () => {
    it("should be able to get sbt information", async () => {
      expect(await zkSBTAuthority.name()).to.equal("ZKP SBT");

      expect(await zkSBTAuthority.symbol()).to.equal("ZKSBT");
    });
  });

  describe("mint", () => {
    it("should mint from owner", async () => {
      const mintTx = await zkSBTAuthority
        .connect(owner)
        .mint(
          address1.address,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate
        );
      const mintReceipt = await mintTx.wait();

      const toAddress = mintReceipt.events![1].args![1];

      expect(toAddress).to.equal(address1.address);
    });

    it("should fail to mint from non minter address", async () => {
      await expect(
        zkSBTAuthority
          .connect(address1)
          .mint(
            address1.address,
            rootHex,
            encryptedCreditScore,
            encryptedIncome,
            encryptedReportDate
          )
      ).to.be.reverted;
    });
  });

  describe("burn", () => {
    it("should burn", async () => {
      // we mint
      let mintTx = await zkSBTAuthority
        .connect(owner)
        .mint(
          address1.address,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate
        );
      let mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();

      const balanceBefore = await zkSBTAuthority.balanceOf(address1.address);

      await zkSBTAuthority.connect(address1).burn(tokenId);

      expect(await zkSBTAuthority.balanceOf(address1.address)).to.be.equal(
        balanceBefore.toNumber() - 1
      );
    });
  });

  describe("tokenUri", () => {
    it("should get a valid token URI from its tokenId", async () => {
      const mintTx = await zkSBTAuthority
        .connect(owner)
        .mint(
          address1.address,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const tokenUri = await zkSBTAuthority.tokenURI(tokenId);

      // check if it's a valid url
      expect(() => new URL(tokenUri)).to.not.throw();
      // we expect that the token uri is already encoded
      expect(tokenUri).to.equal(encodeURI(tokenUri));
      expect(tokenUri).to.contain("testserver/");
    });
  });

  describe("decrypt data", () => {
    it("decrypt the data with address1 private key and generate/validate proof", async () => {
      const mintTx = await zkSBTAuthority
        .connect(owner)
        .mint(
          address1.address,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkSBTAuthority.sbtData(tokenId);

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
        threshold: 40,
        operator: 3, // 3 = greater than or equal to
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
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(40);
    });

    it("proof with invalid creditScore will fail (incorrect hash)", async () => {
      const mintTx = await zkSBTAuthority
        .connect(owner)
        .mint(
          address1.address,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkSBTAuthority.sbtData(tokenId);

      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 3, // 3 = greater than or equal to
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

  describe("test ZKP comparator", () => {
    let tokenId;
    let sbtData;

    beforeEach(async () => {
      const mintTx = await zkSBTAuthority
        .connect(owner)
        .mint(
          address1.address,
          rootHex,
          encryptedCreditScore,
          encryptedIncome,
          encryptedReportDate
        );

      const mintReceipt = await mintTx.wait();
      tokenId = mintReceipt.events![0].args![1].toNumber();
      sbtData = await zkSBTAuthority.sbtData(tokenId);
    });

    it("proof with valid creditScore will succeed (45==45)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 45,
        operator: 0, // 0 = equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(45);
    });

    it("proof with valid creditScore will fail (45==40)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 0, // 0 = equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with valid creditScore will succeed (45!=40)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 1, // 1 = different than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(40);
    });

    it("proof with valid creditScore will fail (45!=45)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 45,
        operator: 1, // 1 = different than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with valid creditScore will succeed (45>40)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 2, // 2 = greater than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(40);
    });

    it("proof with valid creditScore will fail (45>45)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 45,
        operator: 2, // 2 = greater than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with invalid creditScore will fail (45>50)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 50,
        operator: 2, // 2 = greater than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof will fail because the hash is not correct
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with valid creditScore will succeed (45>=40)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 3, // 3 = greater than or equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(40);
    });

    it("proof with valid creditScore will succeed (45>=45)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 45,
        operator: 3, // 3 = greater than or equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(45);
    });

    it("proof with invalid creditScore will fail (45>=50)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 50,
        operator: 3, // 3 = greater than or equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof will fail because the hash is not correct
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with valid creditScore will succeed (45<50)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 50,
        operator: 4, // 4 = less than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(50);
    });

    it("proof with valid creditScore will fail (45<45)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 45,
        operator: 4, // 4 = less than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with invalid creditScore will fail (45<40)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 4, // 4 = less than
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof will fail because the hash is not correct
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });

    it("proof with valid creditScore will succeed (45<=50)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 50,
        operator: 5, // 5 = less than or equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(50);
    });

    it("proof with valid creditScore will succeed (45<=45)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 45,
        operator: 5, // 5 = less than or equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof
      const proof = await genProof(input);

      // check ZKP proof
      await verifyCreditScore.loanEligible(
        proof.a,
        proof.b,
        proof.c,
        proof.PubSignals,
        zkSBTAuthority.address,
        tokenId
      );

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(45);
    });

    it("proof with invalid creditScore will fail (45<=40)", async () => {
      // input of ZKP
      const input = {
        root: sbtData.root,
        owner: address1.address,
        threshold: 40,
        operator: 5, // 5 = less than or equal to
        value: +creditScore,
        data: [address1.address, +creditScore, +income, +reportDate]
      };

      // generate ZKP proof will fail because the hash is not correct
      await expect(genProof(input)).to.be.rejected;

      expect(
        await verifyCreditScore.isElegibleForLoan(address1.address)
      ).to.be.equal(0);
    });
  });
});
