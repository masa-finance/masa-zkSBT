// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@masa-finance/masa-contracts-identity/contracts/tokens/MasaSBTAuthority.sol";

import "./ZKSBT.sol";

/// @title Test ZKP SBT Authority
/// @author Masa Finance
/// @notice Test Soulbound token
/// @dev Inherits from the SSSBT contract.
contract ZKSBTAuthority is MasaSBTAuthority, ZKSBT, ReentrancyGuard {
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
        MasaSBTAuthority(
            admin,
            name,
            symbol,
            baseTokenURI,
            soulboundIdentity,
            paymentParams,
            maxSBTToMint
        )
    {
        _verifier = verifier;
    }

    /// @notice Mints a new SBT
    /// @dev The caller must have the MINTER role
    /// @param to The address to mint the SBT to
    /// @param root Root of the Merkle Tree's data without encryption, used to verify the data
    /// @param encryptedData Encrypted data
    /// @return The SBT ID of the newly minted SBT
    function mint(
        address to,
        bytes calldata root,
        bytes[] memory encryptedData
    ) external payable virtual override returns (uint256) {
        uint256 tokenId = _mintWithCounter(address(0), to);

        sbtData[tokenId] = SBTData({root: root, encryptedData: encryptedData});

        emit MintedToAddress(tokenId, to);

        return tokenId;
    }

    function _mintWithCounter(
        address paymentMethod,
        address to
    ) internal virtual override(MasaSBT, MasaSBTAuthority) returns (uint256) {
        return MasaSBTAuthority._mintWithCounter(paymentMethod, to);
    }
}
