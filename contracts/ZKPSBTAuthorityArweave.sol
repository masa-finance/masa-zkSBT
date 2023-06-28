// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@masa-finance/masa-contracts-identity/contracts/tokens/MasaSBTAuthority.sol";

/// @title ZKP SBT Authority Arweave
/// @author Masa Finance
/// @notice Soulbound token implementing ZKP storing data on Arweave
contract ZKPSBTAuthorityArweave is MasaSBTAuthority, ReentrancyGuard {
    struct EncryptedData {
        bytes iv; // IV
        bytes ephemPublicKey; // ephemPublicKey
        bytes cipherText; // ciphertext
        bytes mac; // mac
    }

    // Struct to store the encrypted data with the public key of the owner of the SBT
    struct SBTData {
        bytes hashData; // hash of ownerAddress+creditScore without encryption, used to verify the data
        // encrypted data with the public key of the owner of the SBT
        EncryptedData encryptedArweaveUrl; // encrypted Arweave URL
    }

    // tokenId => SBTData
    mapping(uint256 => SBTData) public sbtData;

    /// @notice Creates a new Test ZKP SBT
    /// @dev Creates a new Test ZKP SBT, inheriting from the Masa SSSBT contract.
    /// @param admin Administrator of the smart contract
    /// @param name Name of the token
    /// @param symbol Symbol of the token
    /// @param baseTokenURI Base URI of the token
    /// @param soulboundIdentity Address of the SoulboundIdentity contract
    /// @param paymentParams Payment gateway params
    constructor(
        address admin,
        string memory name,
        string memory symbol,
        string memory baseTokenURI,
        address soulboundIdentity,
        PaymentParams memory paymentParams
    )
        MasaSBTAuthority(
            admin,
            name,
            symbol,
            baseTokenURI,
            soulboundIdentity,
            paymentParams
        )
    {}

    function getHashData(uint256 tokenId) external view returns (bytes memory) {
        return sbtData[tokenId].hashData;
    }

    function getEncryptedArweaveUrl(
        uint256 tokenId
    ) external view returns (EncryptedData memory) {
        return sbtData[tokenId].encryptedArweaveUrl;
    }
}
