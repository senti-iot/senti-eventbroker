const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const sentiEventService = require('../../../lib/event/eventServiceV2')
const EventRuleV2 = require('../../../lib/event/dataClasses/EventRuleV2')
const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const sentiCoreService = require('../../../lib/coreService/sentiCoreService')
const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const EventActionV2 = require('../../../lib/event/dataClasses/EventActionV2')

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
 * Get rule
 */
router.get('/v2/action/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }
        let eventAction = await eventService.getEventRuleActionByUUID(req.params.uuid)
        console.log(eventAction)
        /**
         * Check if the user has access to the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.read])
        console.log(access)
        if (access.allowed === false) {
            return res.status(403).json()
        }
        if (eventAction === false) {
            return res.status(404).json()
        }
        succesResponse.result = eventAction
        return res.status(200).json(succesResponse)
    }
    catch (error) {
        errorResponse.error = { message: "Get action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
/**
 * Create rule
 */
router.post('/v2/action', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }
        let eventAction = new EventActionV2(req.body)
        /**
         * Check if the user has access to the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.modify])
        if (access.allowed === false) {
            return res.status(403).json()
        }
        /**
        * Create action
        */
        eventActionResult = await eventService.createAction(eventAction)
        if (eventActionResult !== false) {
            succesResponse.result = eventActionResult
            return res.status(200).json(succesResponse)
        } else {
            throw new Error('Something went wrong')
        }
    }
    catch (error) {
        errorResponse.error = { message: "Create action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
/**
 * Update rule
 */
router.put('/v2/action/:uuid', async (req, res) => {
    try {
        console.log(req.params, req.body)
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }
        let eventAction = new EventActionV2(req.body)
        console.log(eventAction)
        if (eventAction.uuid !== req.params.uuid) {
            throw new Error('ID failure: ' + eventAction.uuid + ' ' + req.params.uuid)
        }
        let existingEventAction = await eventService.getEventRuleActionByUUID(eventAction.uuid)
        if (eventAction.ruleUUID !== existingEventAction.ruleUUID) {
            throw new Error('Rule ID failure: ' + eventAction.ruleUUID + ' ' + existingEventAction.ruleUUID)
        }
        /**
         * Check if the user has access to the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.modify])
        if (access.allowed === false) {
            return res.status(403).json()
        }
        /**
        * Update action
        */
        eventActionResult = await eventService.updateAction(eventAction)
        if (eventActionResult !== false) {
            succesResponse.result = eventActionResult
            return res.status(200).json(succesResponse)
        } else {
            throw new Error('Something went wrong')
        }
    }
    catch (error) {
        errorResponse.error = { message: "Update action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
/**
 * Delete rule
 */
router.delete('/v2/action/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }
        let eventAction = await eventService.getEventRuleActionByUUID(req.params.uuid)
        console.log(eventAction)
        /**
         * Check if the user has access to the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, eventAction.ruleUUID, [sentiAclPriviledge.eventRule.modify])
        if (access.allowed === false) {
            return res.status(403).json()
        }
        eventActionResult = await eventService.deleteAction(eventAction)
        if (eventActionResult !== false) {
            succesResponse.result = eventActionResult
            return res.status(200).json(succesResponse)
        } else {
            throw new Error('Something went wrong')
        }
    }
    catch (error) {
        errorResponse.error = { message: "Create action - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})
module.exports = router