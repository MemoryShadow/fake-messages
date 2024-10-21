const express = require('express')
const router = express.Router()

router.get('/', function(_req, res) {
  res.end('Fake Message API')
})

router.get('/emails/tags', require('./tags')('Email'))
router.get('/messages/tags', require('./tags')('ShortMessage'))
router.get('/templates/tags', require('./tags')('Template'))

router.use('/emails', require('./emails'))
router.use('/messages', require('./short_messages'))
router.use('/templates', require('./templates'))
router.use('/private_numbers/bindings', require('./private_number_bindings'))
router.use('/private_numbers/calls', require('./private_number_calls'))

module.exports = router
