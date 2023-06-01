const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const sentiEventService = require('../../../lib/event/eventServiceV2')
const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const EventRuleV2 = require('../../../lib/event/dataClasses/EventRuleV2')
const EventActionV2 = require('../../../lib/event/dataClasses/EventActionV2')
const sentiMqttPublish = require('../../../lib/event/sentiMqttPublish')

const eventService = new sentiEventService()
const mqttPublish = new sentiMqttPublish(eventService.db)

var errorResponse = {
    status: "error",
    error: ""
}
var succesResponse = {
    status: "ok",
    result: null
}
router.get('/v2/mqtt/device/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }
        /**
         * Check if the user has access to the eventRule
         */
        // let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.modify, sentiAclPriviledge.device.read])
        // if (access.allowed === false) {
        //     return res.status(403).json()
        // }
        /**
         * Get the eventRule
         */
        let eventAction = await mqttPublish.getActionByDeviceId(req.params.uuid)
        if (eventAction !== false) {
            succesResponse.result = eventAction
            return res.status(200).json(succesResponse)
        } else {
            /**
             * No action found return 404
             */
            return res.status(404).json()
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})
/**
 * Create mqtt rule/action
 */
router.post('/v2/mqtt/device/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }
        /**
         * Check if the user has access to the eventRule
         */
        // let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.modify, sentiAclPriviledge.device.read])
        // if (access.allowed === false) {
        //     return res.status(403).json()
        // }
		let device = await new sentiDeviceService(lease).getDeviceByUUID(req.params.uuid)
		if (device === false) {
			return res.status(404).json()
		}
		let eventRule = new EventRuleV2()
		let parentUUID = device.registry.org.uuid
		eventRule.name = 'MQTT forward: ' + device.name
		eventRule.deviceUUID = device.uuid
		eventRule.cloudFunction = 209
		eventRule.config = {
			"when": {
				"every": {
					"m": 0
				},
				"first": {
					"m": 0
				}
			},
			"notificationStrategy": 4
		}
		let eventRuleRes = await eventService.createRule(eventRule, parentUUID)
		if (eventRuleRes !== false) {
			let eventAction = new EventActionV2()
			eventAction.ruleUUID = eventRuleRes.uuid
			eventAction.config = req.body.config
			eventAction.type = 16
			eventAction.state = 1
			eventAction.host = req.body.host

			let eventActionRes = await eventService.createAction(eventAction)
			if (eventActionRes !== false) {
				succesResponse.result = eventActionRes
				return res.status(200).json(succesResponse)
			} else {
				return res.status(404).json({ message: 'Could not create action' })
			}
		} else {
			return res.status(404).json({ message: 'Could not create action' })
		}
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})
router.put('/v2/mqtt/device/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }
        /**
         * Check if the user has access to the eventRule
         */
        // let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.modify, sentiAclPriviledge.device.read])
        // if (access.allowed === false) {
        //     return res.status(403).json()
        // }

		let eventAction = await mqttPublish.getActionByDeviceId(req.params.uuid)
		eventAction.config = req.body.config
		eventAction.host = req.body.host
		// return res.status(200).json(eventAction)	
		let eventActionRes = await eventService.updateAction(eventAction)
		if (eventActionRes !== false) {
			succesResponse.result = eventActionRes
			return res.status(200).json(succesResponse)
		} else {
			return res.status(404).json({ message: 'Could not create action' })
		}
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})

router.delete('/v2/mqtt/device/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }
        /**
         * Check if the user has access to the eventRule
         */
        // let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.modify, sentiAclPriviledge.device.read])
        // if (access.allowed === false) {
        //     return res.status(403).json()
        // }
        /**
         * Get the eventRule
         */
        let eventAction = await mqttPublish.getActionByDeviceId(req.params.uuid)

        if (eventAction !== false) {
            succesResponse.result = eventAction
            return res.status(200).json(succesResponse)
        } else {
            /**
             * No action found return 404
             */
            return res.status(404).json()
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})
module.exports = router