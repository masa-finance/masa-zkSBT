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

    // @notice verifies the validity of the proof, and make further verifications on the public
    // input of the circuit, if verified add the address to the list of eligible addresses
    function loanEligible(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[73] memory publicValues,
        uint256 threshold
    ) public view {
        require(
            publicValues[0] ==
                0x0000000000000000000000000000000000000000000000000000000000000001,
            "The claim doesn't satisfy the query condition"
        );
        require(
            publicValues[2] == threshold,
            "Invalid threshold value used to generate the proof"
        );

        require(
            verifier.verifyProof(a, b, c, publicValues),
            "Proof verification failed"
        );

        // isElegibleForAirdrop[msg.sender] = true;
    }
}
