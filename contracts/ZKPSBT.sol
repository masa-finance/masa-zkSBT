// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/// @title ZKP SBT
/// @author Masa Finance
/// @notice Soulbound token implementing ZKP
abstract contract ZKPSBT {
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
        EncryptedData encryptedCreditScore;
        EncryptedData encryptedIncome;
        EncryptedData encryptedReportDate;
    }

    // tokenId => SBTData
    mapping(uint256 => SBTData) public sbtData;

    function getHashData(uint256 tokenId) external view returns (bytes memory) {
        return sbtData[tokenId].hashData;
    }

    function getEncryptedData(
        uint256 tokenId
    )
        external
        view
        returns (
            EncryptedData memory,
            EncryptedData memory,
            EncryptedData memory
        )
    {
        return (
            sbtData[tokenId].encryptedCreditScore,
            sbtData[tokenId].encryptedIncome,
            sbtData[tokenId].encryptedReportDate
        );
    }
}
