// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "hardhat/console.sol";

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[5] memory input
    ) external view returns (bool);
}

interface IZKPSBT is IERC721 {
    function getRoot(uint256 tokenId) external view returns (bytes memory);
}

/// @title Verify if user is eligible for a loan
/// @author Masa Finance
/// @notice Tests if the user is eligible for a loan based on the credit score
contract VerifyCreditScore {
    IVerifier verifier;

    mapping(address => uint256) public isElegibleForLoan;

    constructor(IVerifier _verifier) {
        verifier = _verifier;
    }

    // @notice verifies the validity of the proof, and make further verifications on the public
    // input of the circuit, if verified add the address to the list of eligible addresses
    function loanEligible(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[5] memory publicValues,
        IZKPSBT zkpSBT,
        uint256 sbtTokenId
    ) public {
        address owner = address(uint160(publicValues[2]));
        uint256 threshold = publicValues[3];
        uint256 operator = publicValues[4];
        string memory operatorStr;

        if (operator == 0) {
            operatorStr = "is elegible for a loan with a credit score =";
        } else if (operator == 1) {
            operatorStr = "is elegible for a loan with a credit score !=";
        } else if (operator == 2) {
            operatorStr = "is elegible for a loan with a credit score >";
        } else if (operator == 3) {
            operatorStr = "is elegible for a loan with a credit score >=";
        } else if (operator == 4) {
            operatorStr = "is elegible for a loan with a credit score <";
        } else if (operator == 5) {
            operatorStr = "is elegible for a loan with a credit score <=";
        }

        require(
            publicValues[0] ==
                0x0000000000000000000000000000000000000000000000000000000000000001,
            "The claim doesn't satisfy the query condition"
        );

        require(
            zkpSBT.ownerOf(sbtTokenId) == owner,
            "The SBT doesn't belong to the address that is trying to claim the loan"
        );

        bytes memory root = zkpSBT.getRoot(sbtTokenId);
        require(
            keccak256(abi.encodePacked(root)) ==
                keccak256(abi.encodePacked(publicValues[1])),
            "The root of the Merkle Tree's data doesn't match the root stored in the SBT"
        );

        require(
            verifier.verifyProof(a, b, c, publicValues),
            "Proof verification failed"
        );

        console.log("Address", owner, operatorStr, threshold);

        isElegibleForLoan[owner] = threshold;
    }
}
