// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@masa-finance/masa-contracts-identity/contracts/tokens/MasaSBTSelfSovereign.sol";

import "./ZKSBT.sol";

/// @title Test ZKP SBT Self-Sovereign
/// @author Masa Finance
/// @notice Test Soulbound token
/// @dev Inherits from the SSSBT contract.
contract ZKSBTSelfSovereign is MasaSBTSelfSovereign, ZKSBT, ReentrancyGuard {
    /// @notice Creates a new Test ZKP SBT
    /// @dev Creates a new Test ZKP SBT, inheriting from the Masa SSSBT contract.
    /// @param admin Administrator of the smart contract
    /// @param name Name of the token
    /// @param symbol Symbol of the token
    /// @param verifier Verifier smart contract
    /// @param baseTokenURI Base URI of the token
    /// @param soulboundIdentity Address of the SoulboundIdentity contract
    /// @param paymentParams Payment gateway params
    /// @param maxSBTToMint Maximum number of SBT that can be minted
    constructor(
        address admin,
        string memory name,
        string memory symbol,
        IVerifier verifier,
        string memory baseTokenURI,
        address soulboundIdentity,
        PaymentParams memory paymentParams,
        uint256 maxSBTToMint
    )
        MasaSBTSelfSovereign(
            admin,
            name,
            symbol,
            baseTokenURI,
            soulboundIdentity,
            paymentParams,
            maxSBTToMint
        )
        EIP712("ZKSBTSelfSovereign", "1.0.0")
    {
        _verifier = verifier;
    }

    function mint(
        address,
        bytes calldata,
        bytes[] memory
    ) external payable virtual override returns (uint256) {
        revert("Function not implemented");
    }

    /// @notice Mints a new SBT
    /// @dev The caller must have the MINTER role
    /// @param to The address to mint the SBT to
    /// @param authorityAddress Address of the authority that signed the message
    /// @param signatureDate Date of the signature
    /// @param root Root of the Merkle Tree's data without encryption, used to verify the data
    /// @param encryptedData Encrypted data
    /// @param signature Signature of the message
    /// @return The SBT ID of the newly minted SBT
    function mint(
        address to,
        address authorityAddress,
        uint256 signatureDate,
        bytes calldata root,
        bytes[] memory encryptedData,
        bytes calldata signature
    ) external payable virtual returns (uint256) {
        if (to != _msgSender()) revert CallerNotOwner(_msgSender());

        bytes32 hash = _hash(
            to,
            authorityAddress,
            signatureDate,
            root,
            encryptedData
        );

        uint256 tokenId = _mintWithCounter(
            address(0),
            to,
            hash,
            authorityAddress,
            signatureDate,
            signature
        );

        sbtData[tokenId] = SBTData({root: root, encryptedData: encryptedData});

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
        bytes calldata root,
        bytes[] memory encryptedData
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "Mint(address to,address authorityAddress,uint256 signatureDate,bytes root,bytes encryptedCreditScore,bytes encryptedIncome,bytes encryptedReportDate)"
                        ),
                        to,
                        authorityAddress,
                        signatureDate,
                        keccak256(root),
                        keccak256(encryptedData[0]),
                        keccak256(encryptedData[1]),
                        keccak256(encryptedData[2])
                    )
                )
            );
    }
}
