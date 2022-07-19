const { api } = require('./services/ApiService')
const {
  monitorForms,
  monitorRequests,
  monitorReviews,
} = require('./services/MonitorService')

exports.api = api
exports.monitorForms = monitorForms
exports.monitorRequests = monitorRequests
exports.monitorReviews = monitorReviews
