// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/// @title ZKP SBT
/// @author Masa Finance
/// @notice Soulbound token implementing ZKP
abstract contract ZKSBT {
    struct EncryptedData {
        bytes iv; // IV
        bytes ephemPublicKey; // ephemPublicKey
        bytes ciphertext; // ciphertext
        bytes mac; // mac
    }

    // Struct to store the encrypted data with the public key of the owner of the SBT
    struct SBTData {
        bytes root; // root of the Merkle Tree's data without encryption, used to verify the data
        // encrypted data with the public key of the owner of the SBT
        EncryptedData encryptedCreditScore;
        EncryptedData encryptedIncome;
        EncryptedData encryptedReportDate;
    }

    // tokenId => SBTData
    mapping(uint256 => SBTData) public sbtData;

    function getRoot(uint256 tokenId) external view returns (bytes memory) {
        return sbtData[tokenId].root;
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
