const express = require('express')
const router = express.router()
const eServiceClass = require('../lib/event/eventService')

let eService = null

/**
 * Get Notification
 */
router.get('/notification', async (req, res) => {

})

/**
 * Get all Notifications
 */
router.get('/notifications', async (req, res) => {

})
/**
 * Create Notification
 */
router.put('/notifications', async (req, res) => {

})
/**
 * Update Notification
 */
router.post('/notifications', async (req, res) => {

})
/**
 * Delete Notification
 */
router.delete('/notifications', async (req, res) => {

})

module.exports = router