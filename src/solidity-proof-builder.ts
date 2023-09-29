// Utils massively borrowed from https://github.com/vplasencia/zkSudoku/blob/5cec0250a23778c873012db06dfa360fef3045d1/contracts/test/utils/utils.js#L3

const snarkjs = require("snarkjs");

const wasm_path = "circuits/verifyCreditScore_js/verifyCreditScore.wasm";
const zkey_path = "circuits/verifyCreditScore_0001.zkey";

const genProof = async (input) => {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasm_path,
    zkey_path
  );

  const solidityCallData = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals
  );

  const argv = solidityCallData.replace(/["[\]\s]/g, "").split(",");

  const a = [argv[0], argv[1]];
  const b = [
    [argv[2], argv[3]],
    [argv[4], argv[5]]
  ];
  const c = [argv[6], argv[7]];
  const PubSignals: any[] = [];

  for (let i = 8; i < argv.length; i++) {
    PubSignals.push(argv[i]);
  }

  return { a, b, c, PubSignals };
};

module.exports = {
  genProof
};
