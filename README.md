# Masa SBT ZKP

A template for creating new SBTs inheriting from the Masa SBT smart contracts, using ZKP.

We use [eth-crypto](https://www.npmjs.com/package/eth-crypto) package to encrypt and decrypt the data.

## Deployment

### Preparations

* Set `DEPLOYER_PRIVATE_KEY` to the deployers private key in `.env.{network}.secret`
* Set `INFURA_API_KEY` to the Infura API key in `.env`
* Set `COINMARKETCAP_API_KEY` to the CoinMarketCap API key in `.env`, if needed
* Set `ETHERSCAN_API_KEY` to the Etherscan API key in `.env`, if needed
* Set the environment variables in every `.env.{network}` file. These variables are used to deploy the smart contracts to the network.

### Deploy

Run: `yarn deploy --network {network}` to deploy.

## Contract Deployments

### Deployment addresses

You can see the deployment address of the smart contracts in the [deployments/goerli](deployments/goerli) and [deployments/mainnet](deployments/mainnet) folders. For every deployed smart contract you will find a `<smart_contract>.json` JSON file with the address in the `"address"` field.
