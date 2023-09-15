pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/mux3.circom";

// length = length of the data array
// index = index of the data array
template verifyZKSBT(length, index) {
    // public
    signal input root; // root of the merkle tree
    signal input owner; // address of the owner of the soulbound token
    signal input threshold;
    signal input operator;
    // 0 = IsEqual
    // 1 = LessThan
    // 2 = LessEqThan
    // 3 = GreaterThan
    // 4 = GreaterEqThan

    // private
    signal input value;
    signal input data[length];

    // true/false
    signal output out;

    // check that the owner is equal to the owner in the data
    owner === data[0];
    // check that the value is equal to the data at the index
    value === data[index];

    // check merckle tree root of data to be equal to root public input
    component merkleTree = Poseidon(length);
    for (var i = 0; i < length; i++) {
        merkleTree.inputs[i] <== data[i];
    }
    root === merkleTree.out;

    // Solution from
    // https://github.com/enricobottazzi/ZK-SBT/blob/b158f1a6ddcd098ee24b5674e0505f99586ad742/iden3-circuits/lib/query/query.circom

    component isEqual = IsEqual();
    isEqual.in[0] <== value;
    isEqual.in[1] <== threshold;

    component lessThan = LessThan(252);
    lessThan.in[0] <== value;
    lessThan.in[1] <== threshold;

    component lessEqThan = LessEqThan(252);
    lessEqThan.in[0] <== value;
    lessEqThan.in[1] <== threshold;

    component greaterThan = GreaterThan(252);
    greaterThan.in[0] <== value;
    greaterThan.in[1] <== threshold;

    component greaterEqThan = GreaterEqThan(252);
    greaterEqThan.in[0] <== value;
    greaterEqThan.in[1] <== threshold;

    component mux = Mux3();
    component n2b = Num2Bits(3);
    n2b.in <== operator;

    mux.s[0] <== n2b.out[0];
    mux.s[1] <== n2b.out[1];
    mux.s[2] <== n2b.out[2];

    mux.c[0] <== isEqual.out;
    mux.c[1] <== lessThan.out;
    mux.c[2] <== lessEqThan.out;
    mux.c[3] <== greaterThan.out;
    mux.c[4] <== greaterEqThan.out;
    mux.c[5] <== 0; // not in use
    mux.c[6] <== 0; // not in use
    mux.c[7] <== 0; // not in use

    // output
    out <== mux.out;
}
