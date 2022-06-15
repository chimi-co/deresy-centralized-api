const Web3 = require('web3')
const functions = require('firebase-functions')

const PROJECT_ID = '1a67d00c910341e4881bded87af7efdf'
const NETWORK = functions.config().settings.network || 'mainnet'

const provider = `https://${NETWORK}.infura.io/v3/${PROJECT_ID}`
const web3 = new Web3(provider)

module.exports = web3
