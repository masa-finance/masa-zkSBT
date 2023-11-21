const ecies = require("ecies-geth");
const ethUtil = require("ethereumjs-util");

const toBuffer = (value: any) => {
  if (typeof value === "string") {
    return Buffer.from(value);
  } else {
    return Buffer.from(value.toString());
  }
};

const encryptWithPublicKey = async (publicKey: string, value: any) => {
  // Convert the public key to a buffer
  const publicKeyBuffer = ethUtil.toBuffer(publicKey);
  // Convert the value to a buffer
  const valueBuffer = toBuffer(value);

  // Encrypt the message
  const encryptedMessage = await ecies.encrypt(publicKeyBuffer, valueBuffer);

  return "0x" + encryptedMessage.toString("hex");
};

const decryptWithPrivateKey = async (privateKey: string, valueHex: string) => {
  // Convert the private key to a buffer
  const privateKeyBuffer = ethUtil.toBuffer(privateKey);
  // Convert the value in hex to a buffer
  const valueBuffer = Buffer.from(valueHex.slice(2), "hex");

  // Decrypt the message
  const decryptedMessage = await ecies.decrypt(privateKeyBuffer, valueBuffer);
  return decryptedMessage.toString();
};

module.exports = {
  encryptWithPublicKey,
  decryptWithPrivateKey
};
