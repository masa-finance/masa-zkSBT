pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";

template creditScoreConstraint() {
    // private
    signal input creditScore; 
    
    // public
    signal input threshold;


    // true/false
    signal output out;

    // considering max creditScore 127
    component greaterEqThan = GreaterEqThan(8); 
    greaterEqThan.in[0] <== creditScore;
    greaterEqThan.in[1] <== threshold;

    out <-- greaterEqThan.out;
    out === 1;
}

component main {public [threshold]} = creditScoreConstraint();
 