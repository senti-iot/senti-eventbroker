const express = require('express')
const router = express.Router()
const eServiceClass = require('../lib/event/eventService')

let eService = null

router.all('/alarm*', async (req, res, next) => {
	eService = new eServiceClass()
	next()
})

/**
 * Get Alarm
 */
router.get('/alarm/:uuid', async (req, res) => {
	let alarmUUID = req.params.uuid
	if (eService) {
		let alarm = await eService.getEventRuleByUUID(alarmUUID)
		if (alarm)
			return res.status(200).json(alarm)
		else
			return res.status(404).json(null)
	}
	return res.status(500)
})

/**
 * Get all Alarms
 */
router.get('/alarms/:userUUID', async (req, res) => {

	let alarmUUID = req.params.userUUID
	console.log('alarmUUID', alarmUUID)
	if (eService) {
		let alarm = await eService.getEventRulesByUUID(alarmUUID)
		if (alarm)
			return res.status(200).json(alarm)
		else
			return res.status(404).json(null)
	}
	return res.status(500)
})
/**
 * Create Alarm
 */
router.put('/alarm', async (req, res) => {
	let alarm = req.body
	if (alarm) {
		let fAlarm = await eService.createEventRule(alarm)
		if (fAlarm)
			return res.status(200).json(fAlarm)
		else
			return res.status(500).json(null)
	}
	return res.status(500).json(null)
})
/**
 * Update Alarm
 */
router.post('/alarm', async (req, res) => {
	let alarm = req.body
	if (alarm) {
		let fAlarm = await eService.editEventRule(alarm)
		if (fAlarm)
			return res.status(200).json(fAlarm)
		else
			return res.status(500).json(null)
	}
	return res.status(500).json(null)
})
/**
 * Delete Alarm
 */
router.delete('/alarm/:uuid', async (req, res) => {
	let alarmUUID = req.params.uuid
	if (alarmUUID) {
		let del = await eService.deleteEventRule(alarmUUID)
		if (del) {
			return res.status(200).json(true)
		}
		else
			return res.status(500).json(false)
	}
	return res.status(500).json(false)
})
module.exports = router