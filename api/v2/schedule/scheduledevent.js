const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
// const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const sentiSubscriptionService = require('../../../lib/event/sentiSubscriptionsService')
const subscriptionService = new sentiSubscriptionService()

const sentiEventService = require('../../../lib/event/eventServiceV2')
// const EventRuleV2 = require('../../../lib/event/dataClasses/EventRuleV2')
// const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const sentiCoreService = require('../../../lib/coreService/sentiCoreService')
// const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
// const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
// const EventActionV2 = require('../../../lib/event/dataClasses/EventActionV2')

const cron = require('../../../server').sentiCron


const eventService = new sentiEventService()

var errorResponse = {
    status: "error",
    error: ""
}
var succesResponse = {
    status: "ok",
    result: null
}
/**
 *
 */
// router.get('/v2/scheduled/events', async (req, res, next) => {
//     res.status(200).json(await subscriptionService.getSubscriptions())
// })
router.get('/v2/scheduled/events/reload', async (req, res, next) => {
    res.status(200).json(await cron.reload())
})
router.get('/v2/scheduled/event/:uuid/start', async (req, res, next) => {
    res.status(200).json(cron.start(await subscriptionService.getIdByUuid(req.params.uuid)))
})
router.get('/v2/scheduled/event/:uuid/stop', async (req, res, next) => {
    res.status(200).json(cron.stop(await subscriptionService.getIdByUuid(req.params.uuid)))
})
router.get('/v2/scheduled/event/:uuid/status', async (req, res, next) => {
    res.status(200).json(cron.status(await subscriptionService.getIdByUuid(req.params.uuid)))
})

/**
 * Get scheduled rules
 */
router.get('/v2/scheduled/rules/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }

		let subscriptionRules = await subscriptionService.getSubscriptionRulesByParent(req.params.uuid)
		console.log(subscriptionRules)

        succesResponse.result = subscriptionRules
        return res.status(200).json(succesResponse)
    }
    catch (error) {
        errorResponse.error = { message: "Get action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
router.get('/v2/scheduled/rule/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }

		let subscriptionRule = await subscriptionService.getSubscriptionRuleByUuid(req.params.uuid)
		console.log(subscriptionRule)

        succesResponse.result = subscriptionRule
        return res.status(200).json(succesResponse)
    }
    catch (error) {
        errorResponse.error = { message: "Get action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
router.delete('/v2/scheduled/rule/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }

		let subscriptionRule = await subscriptionService.getSubscriptionRuleByUuid(req.params.uuid)
		if (subscriptionRule === false) {
			throw new Error('Rule not found')
		}
		// console.log(subscriptionRule, lease, subscriptionRule.parentUser, lease.uuid, subscriptionRule.parentUser !== lease.uuid)
		if (subscriptionRule.parentUser !== lease.uuid) {
			// console.log('No access to delete this rule')
			return res.status(403).json()
		}
		subscriptionRule = await subscriptionService.deleteSubscriptionRule(subscriptionRule.id)


        succesResponse.result = subscriptionRule
        return res.status(200).json(succesResponse)
    }
    catch (error) {
        errorResponse.error = { message: "Get action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
/**
 * Create scheduled rule
 */
router.post('/v2/scheduled/rule', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }

		console.log(req.body)
		let subscriptionRule = await subscriptionService.createSubscriptionRule(req.body)
		if (subscriptionRule !== false) {
			console.log('Created scheduled rule:', subscriptionRule)
			succesResponse.result = subscriptionRule
			return res.status(200).json(succesResponse)
		} else {
			throw new Error('Something went wrong')
		}
    }
    catch (error) {
        errorResponse.error = { message: "Create scheduled rule - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
router.put('/v2/scheduled/rule', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }

		console.log(req.body)
		let subscriptionRule = await subscriptionService.updateSubscriptionRule(req.body)
		if (subscriptionRule !== false) {
			console.log('Created scheduled rule:', subscriptionRule)
			succesResponse.result = subscriptionRule
			return res.status(200).json(succesResponse)
		} else {
			throw new Error('Something went wrong')
		}
    }
    catch (error) {
        errorResponse.error = { message: "Create scheduled rule - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})


/**
 * Get scheduled event
 */
// router.get('/v2/scheduled/event/:uuid', async (req, res) => {
//     try {
//         /**
//          * Check if the user is logged in and his lease is still good
//          */
//         let lease = await authClient.getLease(req)
//         if (lease === false) {
//             return res.status(401).json()
//         }
//         let eventAction = await eventService.getEventRuleActionByUUID(req.params.uuid)
//         console.log(eventAction)
//         /**
//          * Check if the user has access to the eventRule
//          */
//         let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.read])
//         console.log(access)
//         if (access.allowed === false) {
//             return res.status(403).json()
//         }
//         if (eventAction === false) {
//             return res.status(404).json()
//         }
//         succesResponse.result = eventAction
//         return res.status(200).json(succesResponse)
//     }
//     catch (error) {
//         errorResponse.error = { message: "Get action - error: " + error.message, stack: error.stack }
//         console.log(errorResponse)
//         res.status(500).json(errorResponse)
//     }
// })
/**
 * Create rule
 */
// router.post('/v2/action', async (req, res) => {
//     try {
//         /**
//          * Check if the user is logged in and his lease is still good
//          */
//         let lease = await authClient.getLease(req)
//         if (lease === false) {
//             res.status(401).json()
//             return
//         }
//         let eventAction = new EventActionV2(req.body)
//         /**
//          * Check if the user has access to the eventRule
//          */
//         let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.modify])
//         if (access.allowed === false) {
//             return res.status(403).json()
//         }
//         /**
//         * Create action
//         */
//         eventActionResult = await eventService.createAction(eventAction)
//         if (eventActionResult !== false) {
//             succesResponse.result = eventActionResult
//             return res.status(200).json(succesResponse)
//         } else {
//             throw new Error('Something went wrong')
//         }
//     }
//     catch (error) {
//         errorResponse.error = { message: "Create action - error: " + error.message, stack: error.stack }
//         console.log(errorResponse)
//         res.status(500).json(errorResponse)
//     }
// })
// /**
//  * Update rule
//  */
// router.put('/v2/action/:uuid', async (req, res) => {
//     try {
//         console.log(req.params, req.body)
//         /**
//          * Check if the user is logged in and his lease is still good
//          */
//         let lease = await authClient.getLease(req)
//         if (lease === false) {
//             res.status(401).json()
//             return
//         }
//         let eventAction = new EventActionV2(req.body)
//         console.log(eventAction)
//         if (eventAction.uuid !== req.params.uuid) {
//             throw new Error('ID failure: ' + eventAction.uuid + ' ' + req.params.uuid)
//         }
//         let existingEventAction = await eventService.getEventRuleActionByUUID(eventAction.uuid)
//         if (eventAction.ruleUUID !== existingEventAction.ruleUUID) {
//             throw new Error('Rule ID failure: ' + eventAction.ruleUUID + ' ' + existingEventAction.ruleUUID)
//         }
//         /**
//          * Check if the user has access to the eventRule
//          */
//         let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.modify])
//         if (access.allowed === false) {
//             return res.status(403).json()
//         }
//         /**
//         * Update action
//         */
//         eventActionResult = await eventService.updateAction(eventAction)
//         if (eventActionResult !== false) {
//             succesResponse.result = eventActionResult
//             return res.status(200).json(succesResponse)
//         } else {
//             throw new Error('Something went wrong')
//         }
//     }
//     catch (error) {
//         errorResponse.error = { message: "Update action - error: " + error.message, stack: error.stack }
//         console.log(errorResponse)
//         res.status(500).json(errorResponse)
//     }
// })
// /**
//  * Delete rule
//  */
// router.delete('/v2/action/:uuid', async (req, res) => {
//     try {
//         /**
//          * Check if the user is logged in and his lease is still good
//          */
//         let lease = await authClient.getLease(req)
//         if (lease === false) {
//             res.status(401).json()
//             return
//         }
//         let eventAction = await eventService.getEventRuleActionByUUID(req.params.uuid)
//         console.log(eventAction)
//         /**
//          * Check if the user has access to the eventRule
//          */
//         let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.modify])
//         if (access.allowed === false) {
//             return res.status(403).json()
//         }
//         eventActionResult = await eventService.deleteAction(eventAction)
//         if (eventActionResult !== false) {
//             succesResponse.result = eventActionResult
//             return res.status(200).json(succesResponse)
//         } else {
//             throw new Error('Something went wrong')
//         }
//     }
//     catch (error) {
//         errorResponse.error = { message: "Create action - error: " + error.message, stack: error.stack }
//         console.log(errorResponse)
//         res.status(500).json(errorResponse)
//     }
// })
module.exports = router
