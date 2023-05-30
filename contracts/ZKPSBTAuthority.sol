// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@masa-finance/masa-contracts-identity/contracts/tokens/MasaSBTAuthority.sol";

import "./ZKPSBT.sol";

/// @title Test ZKP SBT Authority
/// @author Masa Finance
/// @notice Test Soulbound token
/// @dev Inherits from the SSSBT contract.
contract ZKPSBTAuthority is MasaSBTAuthority, ZKPSBT, ReentrancyGuard {
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

    /// @notice Mints a new SBT
    /// @dev The caller must have the MINTER role
    /// @param to The address to mint the SBT to
    /// @param hashData Hash of ownerAddress+creditScore without encryption, used to verify the data
    /// @param encryptedCreditScore Encrypted credit score
    /// @param encryptedIncome Encrypted income
    /// @param encryptedReportDate Encrypted report date
    /// @return The SBT ID of the newly minted SBT
    function mint(
        address to,
        bytes calldata hashData,
        EncryptedData calldata encryptedCreditScore,
        EncryptedData calldata encryptedIncome,
        EncryptedData calldata encryptedReportDate
    ) external payable virtual returns (uint256) {
        uint256 tokenId = _mintWithCounter(address(0), to);

        sbtData[tokenId] = SBTData({
            hashData: hashData,
            encryptedCreditScore: encryptedCreditScore,
            encryptedIncome: encryptedIncome,
            encryptedReportDate: encryptedReportDate
        });

        emit MintedToAddress(tokenId, to);

        return tokenId;
    }

    event MintedToAddress(uint256 tokenId, address to);
}
