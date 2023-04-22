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

  [, admin] = await ethers.getSigners();
  const env = getEnvParams(network.name);
  const baseUri = `${env.BASE_URI}`;

  const constructorArguments = [
    env.ADMIN || admin.address,
    env.SBT_NAME,
    env.SBT_SYMBOL,
    baseUri
  ];

  const zkpSBTAuthorityDeploymentResult = await deploy("ZKPSBTAuthority", {
    from: deployer,
    args: constructorArguments,
    log: true
  });

  // verify contract with etherscan, if its not a local network
  if (network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: zkpSBTAuthorityDeploymentResult.address,
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
};

func.tags = ["ZKPSBTAuthority"];
func.dependencies = [];
export default func;
