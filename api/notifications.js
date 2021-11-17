const express = require('express')
const router = express.Router()

const { authClient } = require('../server')

const eServiceClass = require('../lib/event/eventService')

let eService = null

router.all('/usernotification*', async (req, res, next) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
    req.senti = {
        lease: lease
    }
	eService = new eServiceClass()
	next()
})
/**
 * Get User Notifications
 */
 router.get('/usernotifications/:uuid/:from/:to', async (req, res) => {
	let userUUID = req.params.uuid
    let from = req.params.from
    let to = req.params.to

	if (eService) {
		let notifications = await eService.getNotificationsByUserUUID(userUUID, from, to)
		if (notifications)
			return res.status(200).json(notifications)
		else
			return res.status(404).json(null)
	}
	return res.status(500)


})


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