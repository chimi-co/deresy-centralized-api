const Web3 = require('web3')
const functions = require('firebase-functions')
const provider = functions.config().settings.infura_provider
const web3 = new Web3(provider)

module.exports = web3
