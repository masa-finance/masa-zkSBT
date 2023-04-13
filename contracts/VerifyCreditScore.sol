// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[73] memory input
    ) external view returns (bool);
}

/// @title Verify if user is eligible for a loan
/// @author Masa Finance
/// @notice Tests if the user is eligible for a loan based on the credit score
contract VerifyCreditScore {
    IVerifier verifier;

    constructor(IVerifier _verifier) {
        verifier = _verifier;
    }
}
