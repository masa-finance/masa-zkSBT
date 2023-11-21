import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { getEnvParams, getPrivateKey } from "../src/EnvParams";

let admin: SignerWithAddress;

const func: DeployFunction = async ({
  // @ts-ignore
  getNamedAccounts,
  // @ts-ignore
  deployments,
  // @ts-ignore
  ethers,
  network
}) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  [admin] = await ethers.getSigners();
  const env = getEnvParams(network.name);
  const baseUri = `${env.BASE_URI}`;

  const constructorArguments = [
    env.ADMIN || admin.address,
    env.SBT_NAME,
    env.SBT_SYMBOL,
    baseUri,
    ethers.constants.AddressZero,
    [
      env.SWAP_ROUTER,
      env.WETH_TOKEN,
      env.USDC_TOKEN,
      env.MASA_TOKEN,
      env.PROJECTFEE_RECEIVER || admin.address,
      env.PROTOCOLFEE_RECEIVER || ethers.constants.AddressZero,
      env.PROTOCOLFEE_AMOUNT || 0,
      env.PROTOCOLFEE_PERCENT || 0,
      env.PROTOCOLFEE_PERCENT_SUB || 0
    ],
    1
  ];

  const zkSBTSelfSovereignDeploymentResult = await deploy(
    "ZKSBTSelfSovereign",
    {
      from: deployer,
      args: constructorArguments,
      log: true
    }
  );

  // verify contract with etherscan, if its not a local network
  if (network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: zkSBTSelfSovereignDeploymentResult.address,
        constructorArguments
      });
    } catch (error) {
      if (
        !error.message.includes("Contract source code already verified") &&
        !error.message.includes("Reason: Already Verified")
      ) {
        throw error;
      }
    }
  }

  if (network.name === "hardhat") {
    const signer = env.ADMIN
      ? new ethers.Wallet(getPrivateKey(network.name), ethers.provider)
      : admin;

    const zkSBTSelfSovereign = await ethers.getContractAt(
      "ZKSBTSelfSovereign",
      zkSBTSelfSovereignDeploymentResult.address
    );

    // add authority to ZKSBTSelfSovereign
    await zkSBTSelfSovereign
      .connect(signer)
      .addAuthority(env.AUTHORITY_WALLET || admin.address);
  }
};

func.tags = ["ZKSBTSelfSovereign"];
func.dependencies = [];
export default func;
