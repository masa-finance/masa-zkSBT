import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DeployFunction } from "hardhat-deploy/dist/types";

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

  const currentNonce: number = await ethers.provider.getTransactionCount(deployer);

  [admin] = await ethers.getSigners();

  const verifierDeployed = await deployments.get("Verifier");

  const constructorArguments = [verifierDeployed.address];

  const verifyCreditScoreDeploymentResult = await deploy("VerifyCreditScore", {
    from: deployer,
    args: constructorArguments,
    log: true,
    nonce: currentNonce + 1 // to solve REPLACEMENT_UNDERPRICED, when needed
  });

  // verify contract with etherscan, if its not a local network
  if (network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: verifyCreditScoreDeploymentResult.address,
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

func.tags = ["VerifyCreditScore"];
func.dependencies = ["Verifier", "ZKPSBTSelfSovereign", "ZKPSBTAuthority"];
export default func;
