import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { deployments, ethers, getChainId } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZKPSBT, ZKPSBT__factory } from "../typechain";
import { Wallet } from "ethers";
import EthCrypto from "eth-crypto";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";

chai.use(chaiAsPromised);
chai.use(solidity);
const expect = chai.expect;

// contract instances
let zkpSBT: ZKPSBT;

let owner: SignerWithAddress;
let authority: SignerWithAddress;
let address1: Wallet;
let address2: Wallet;

const signatureDate = Math.floor(Date.now() / 1000);
const data = {
  creditScore: 45,
  income: 100000
};

let encryptedData;
let hashData;
let signatureToAddress1: string;

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
  address2 = new ethers.Wallet(
    ethers.Wallet.createRandom().privateKey,
    ethers.provider
  );

  beforeEach(async () => {
    await deployments.fixture("ZKPSBT", {
      fallbackToGlobal: true
    });

    await owner.sendTransaction({
      to: address1.address,
      value: ethers.utils.parseEther("1")
    });

    await owner.sendTransaction({
      to: address2.address,
      value: ethers.utils.parseEther("1")
    });

    const { address: zkpSBTAddress } = await deployments.get("ZKPSBT");

    zkpSBT = ZKPSBT__factory.connect(zkpSBTAddress, owner);

    // we add authority account
    await zkpSBT.addAuthority(authority.address);

    hashData = keccak256(toUtf8Bytes(JSON.stringify(data)));

    // we encrypt data with public key of address2
    const encryptedDataWithPublicKey = await EthCrypto.encryptWithPublicKey(
      address2.publicKey.replace("0x", ""), // publicKey
      JSON.stringify(data) // message
    );
    encryptedData = {
      iv: "0x" + encryptedDataWithPublicKey.iv,
      ephemPublicKey: "0x" + encryptedDataWithPublicKey.ephemPublicKey,
      cipherText: "0x" + encryptedDataWithPublicKey.ciphertext,
      mac: "0x" + encryptedDataWithPublicKey.mac
    };

    // middleware signs the mint to let address1 mint
    signatureToAddress1 = await signMint(
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
          signatureToAddress1
        );
      await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signatureToAddress1
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
          signatureToAddress1
        );
      const mintReceipt = await mintTx.wait();

      const toAddress = mintReceipt.events![1].args![1];

      expect(toAddress).to.equal(address1.address);
    });

    it("should mint to an address, with a ZKP SBT not linked to an identity SC", async () => {
      const signatureToAddress2 = await signMint(
        address2.address,
        authority,
        hashData,
        encryptedData.cipherText
      );
      const mintTx = await zkpSBT
        .connect(address2)
        .mint(
          address2.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
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
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signatureToAddress1
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
          signatureToAddress1
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
          signatureToAddress1
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
    it("decrypt the data with address2 private key", async () => {
      const mintTx = await zkpSBT
        .connect(address1)
        .mint(
          address1.address,
          authority.address,
          signatureDate,
          hashData,
          encryptedData,
          signatureToAddress1
        );

      const mintReceipt = await mintTx.wait();
      const tokenId = mintReceipt.events![0].args![1].toNumber();
      const sbtData = await zkpSBT.sbtData(tokenId);

      // we decrypt the data with the private key of address2
      const decryptedData = await EthCrypto.decryptWithPrivateKey(
        address2.privateKey.replace("0x", ""), // privateKey
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
      const dataInAddress2 = JSON.parse(decryptedData);

      // we check that the hash of the data is the same
      expect(keccak256(toUtf8Bytes(decryptedData))).to.equal(sbtData.hashData);

      // we check that the data is the same
      expect(dataInAddress2.creditScore).to.equal(data.creditScore);
    });
  });
});
