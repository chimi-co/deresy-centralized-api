const functions = require('firebase-functions')
const express = require('express')
const cors = require('cors')({ origin: true })
const { https, logger } = functions

const app = express()

app.get('/health_check', (request, response) => {
  return cors(request, response, async () => {
    try {
      response.send({ status: 'ok' })
    } catch (error) {
      logger.error('[ !!! ] Error: ', error)
      throw new https.HttpsError(error.code, error.message)
    }
  })
})

const api = functions.https.onRequest(app)

module.exports = {
  api,
}
