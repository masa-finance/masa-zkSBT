pragma circom 2.0.0;

include "lib/verifyZKSBT.circom";

// length = length of the data array
// index = index of the data array

component main {public [root,owner,threshold,operator]} = verifyZKSBT(4, 1);