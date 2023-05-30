// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@masa-finance/masa-contracts-identity/contracts/tokens/MasaSBTSelfSovereign.sol";

import "./ZKPSBT.sol";

/// @title Test ZKP SBT Self-Sovereign
/// @author Masa Finance
/// @notice Test Soulbound token
/// @dev Inherits from the SSSBT contract.
contract ZKPSBTSelfSovereign is MasaSBTSelfSovereign, ZKPSBT, ReentrancyGuard {
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
        MasaSBTSelfSovereign(
            admin,
            name,
            symbol,
            baseTokenURI,
            soulboundIdentity,
            paymentParams
        )
        EIP712("ZKPSBTSelfSovereign", "1.0.0")
    {}

    /// @notice Mints a new SBT
    /// @dev The caller must have the MINTER role
    /// @param to The address to mint the SBT to
    /// @param authorityAddress Address of the authority that signed the message
    /// @param signatureDate Date of the signature
    /// @param hashData Hash of ownerAddress+creditScore without encryption, used to verify the data
    /// @param encryptedCreditScore Encrypted credit score
    /// @param encryptedIncome Encrypted income
    /// @param encryptedReportDate Encrypted report date
    /// @param signature Signature of the message
    /// @return The SBT ID of the newly minted SBT
    function mint(
        address to,
        address authorityAddress,
        uint256 signatureDate,
        bytes calldata hashData,
        EncryptedData calldata encryptedCreditScore,
        EncryptedData calldata encryptedIncome,
        EncryptedData calldata encryptedReportDate,
        bytes calldata signature
    ) external payable virtual returns (uint256) {
        if (to != _msgSender()) revert CallerNotOwner(_msgSender());

        bytes32 hash = _hash(
            to,
            authorityAddress,
            signatureDate,
            hashData,
            encryptedCreditScore.cipherText,
            encryptedIncome.cipherText,
            encryptedReportDate.cipherText
        );

        uint256 tokenId = _mintWithCounter(
            address(0),
            to,
            hash,
            authorityAddress,
            signature
        );

        sbtData[tokenId] = SBTData({
            hashData: hashData,
            encryptedCreditScore: encryptedCreditScore,
            encryptedIncome: encryptedIncome,
            encryptedReportDate: encryptedReportDate
        });

        emit MintedToAddress(
            tokenId,
            to,
            authorityAddress,
            signatureDate,
            address(0),
            mintPrice
        );

        return tokenId;
    }

    function _hash(
        address to,
        address authorityAddress,
        uint256 signatureDate,
        bytes calldata hashData,
        bytes calldata encryptedCreditScore,
        bytes calldata encryptedIncome,
        bytes calldata encryptedReportDate
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "Mint(address to,address authorityAddress,uint256 signatureDate,bytes hashData,bytes encryptedCreditScore,bytes encryptedIncome,bytes encryptedReportDate)"
                        ),
                        to,
                        authorityAddress,
                        signatureDate,
                        keccak256(hashData),
                        keccak256(encryptedCreditScore),
                        keccak256(encryptedIncome),
                        keccak256(encryptedReportDate)
                    )
                )
            );
    }

    event MintedToAddress(
        uint256 tokenId,
        address to,
        address authorityAddress,
        uint256 signatureDate,
        address paymentMethod,
        uint256 mintPrice
    );
}
