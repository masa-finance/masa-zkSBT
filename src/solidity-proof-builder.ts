// Utils massively borrowed from https://github.com/vplasencia/zkSudoku/blob/5cec0250a23778c873012db06dfa360fef3045d1/contracts/test/utils/utils.js#L3

const snarkjs = require("snarkjs");

const wasm_path = "circuits/verify4_js/verify4.wasm";
const zkey_path = "circuits/verify4.zkey";

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

  const Proof = argv.slice(0, 8);
  const PubSignals = argv.slice(8);

  return { Proof, PubSignals };
};

module.exports = {
  genProof
};
