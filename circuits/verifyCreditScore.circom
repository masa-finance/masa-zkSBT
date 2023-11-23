pragma circom 2.0.0;

include "lib/verifyZKSBT.circom";

// index: index of the value in the data array
// root: root of the merkle tree
// owner: address of the owner of the soulbound token
// theshold: threshold to compare with the value
// operator: operator to compare the value with the threshold
component main {public [index,root,owner,threshold,operator]} = verifyZKSBT(4);