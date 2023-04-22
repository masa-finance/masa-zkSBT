// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@masa-finance/masa-contracts-identity/contracts/tokens/MasaSBTSelfSovereign.sol";

/// @title Test ZKP SBT
/// @author Masa Finance
/// @notice Test Soulbound token
/// @dev Inherits from the SSSBT contract.
contract ZKPSBT is MasaSBTSelfSovereign, ReentrancyGuard {
    struct EncryptedData {
        bytes iv; // IV
        bytes ephemPublicKey; // ephemPublicKey
        bytes cipherText; // ciphertext
        bytes mac; // mac
    }

    // Struct to store the encrypted data with the public key of the owner of the SBT
    struct SBTData {
        bytes hashData; // hash of ownerAddress+creditScore without encryption, used to verify the data
        EncryptedData encryptedData; // encrypted data with the public key of the owner of the SBT
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
        ISoulboundIdentity soulboundIdentity,
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
        EIP712("ZKPSBT", "1.0.0")
    {}

    function getHashData(uint256 tokenId) external view returns (bytes memory) {
        return sbtData[tokenId].hashData;
    }

    function getEncryptedData(
        uint256 tokenId
    ) external view returns (EncryptedData memory) {
        return sbtData[tokenId].encryptedData;
    }

    /// @notice Mints a new SBT
    /// @dev The caller must have the MINTER role
    /// @param to The address to mint the SBT to
    /// @param authorityAddress Address of the authority that signed the message
    /// @param signatureDate Date of the signature
    /// @param hashData Hash of ownerAddress+creditScore without encryption, used to verify the data
    /// @param encryptedData Encrypted data with the public key of the owner of the SBT
    /// @param signature Signature of the message
    /// @return The SBT ID of the newly minted SBT
    function mint(
        address to,
        address authorityAddress,
        uint256 signatureDate,
        bytes calldata hashData,
        EncryptedData calldata encryptedData,
        bytes calldata signature
    ) external payable virtual returns (uint256) {
        if (to != _msgSender()) revert CallerNotOwner(_msgSender());

        uint256 tokenId = _verifyAndMint(
            address(0),
            to,
            _hash(
                to,
                authorityAddress,
                signatureDate,
                hashData,
                encryptedData.cipherText
            ),
            authorityAddress,
            signature
        );

        sbtData[tokenId] = SBTData({
            hashData: hashData,
            encryptedData: encryptedData
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
        bytes calldata cipherData
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "Mint(address to,address authorityAddress,uint256 signatureDate,bytes hashData,bytes cipherData)"
                        ),
                        to,
                        authorityAddress,
                        signatureDate,
                        keccak256(hashData),
                        keccak256(cipherData)
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
