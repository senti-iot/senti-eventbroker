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
router.get('/v2/rule/:uuid', async (req, res) => {
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
        let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.eventRule.read])
        if (access.allowed === false) {
            return res.status(403).json()
        }
        /**
         * Get the eventRule
         */
        let eventRule = await eventService.getEventRuleByUUID(req.params.uuid)
        if (eventRule !== false) {
            succesResponse.result = eventRule
            return res.status(200).json(succesResponse)
        } else {
            /**
             * No rule found return 404
             */
            return res.status(404).json()
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})
/**
 * Create rule
 */
router.post('/v2/rule', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }
        /**
         * 
         */
        let eventRule = new EventRuleV2(req.body)
        /**
         * Find out which parent org the rule is set on, eg. DeviceType, Registry, Device
         */
        let parentUUID = null
        if (eventRule.deviceUUID !== null) {
            let device = await new sentiDeviceService(lease).getDeviceByUUID(eventRule.deviceUUID)
            parentUUID = device.registry.org.uuid
        } else if (eventRule.registryUUID !== null) {
            let registry = await new sentiRegistryService(lease).getRegistryByUUID(eventRule.registryUUID)
            parentUUID = registry.org.uuid
        } else if (eventRule.deviceTypeUUID !== null) {
            let deviceType = await new sentiDeviceTypeService(lease).getDeviceTypeByUUID(eventRule.deviceTypeUUID)
            parentUUID = deviceType.org.uuid
        }
        const coreService = new sentiCoreService(lease)
        let aclOrgResources = await coreService.getAclOrgResourcesOnNameByUUID(parentUUID)
        /**
         * Check if the user has access to the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, aclOrgResources['devices'].uuid, [sentiAclPriviledge.eventRule.create])
        if (access.allowed === false) {
            res.status(403).json()
            return
        }
        /**
         * Create rule
         */
         eventRuleResult = await eventService.createRule(eventRule, parentUUID)
        if (eventRuleResult !== false) {
            await aclClient.registerResource(eventRuleResult.uuid, sentiAclResourceType.eventRule)
            await aclClient.addResourceToParent(eventRuleResult.uuid, aclOrgResources['devices'].uuid)
    
            succesResponse.result = eventRuleResult
            return res.status(200).json(succesResponse)
        } else {
            /**
             * Something went wrong
             */
            console.log('Create rule - error:', eventRule)
            errorResponse.error = "Something went wrong"
            return res.status(500).json(errorResponse)
        }
    }
    catch (error) {
        errorResponse.error = { message: "Create rule - error: " + error.message, stack: error.stack }
        console.log('Create rule - error:', errorResponse)
        res.status(500).json(errorResponse)
    }
})
/**
 * Update rule
 */
 router.put('/v2/rule/:uuid', async (req, res) => {
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
        /**
         * Check if the user has access to modufy the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.eventRule.modify])
        if (access.allowed === false) {
            res.status(403).json()
            return
        }
        let eventRule = new EventRuleV2(req.body)
        /**
         * Find out which parent org the rule is set on, eg. DeviceType, Registry, Device
         */
         let parentUUID = null
         if (eventRule.deviceUUID !== null) {
             let device = await new sentiDeviceService(lease).getDeviceByUUID(eventRule.deviceUUID)
             parentUUID = device.registry.org.uuid
         } else if (eventRule.registryUUID !== null) {
             let registry = await new sentiRegistryService(lease).getRegistryByUUID(eventRule.registryUUID)
             parentUUID = registry.org.uuid
         } else if (eventRule.deviceTypeUUID !== null) {
             let deviceType = await new sentiDeviceTypeService(lease).getDeviceTypeByUUID(eventRule.deviceTypeUUID)
             parentUUID = deviceType.org.uuid
         }
        let existingParentUUID = await eventService.getEventRuleParentByUUID(req.params.uuid)
        /**
         * Check if parent has changed 
         */
         if (parentUUID !== existingParentUUID) {
            const coreService = new sentiCoreService(lease)
			/**
			 * Get the ACL Org resources
			 */
             let newOrgAclResources = await coreService.getAclOrgResourcesOnNameByUUID(parentUUID)
             let oldOrgAclResources = await coreService.getAclOrgResourcesOnNameByUUID(existingParentUUID)
             /**
              * Update ACL with new org resources
              */
             await aclClient.removeResourceFromParent(eventRule.uuid, oldOrgAclResources['devices'].uuid)
             await aclClient.addResourceToParent(eventRule.uuid, newOrgAclResources['devices'].uuid)
        }
        eventRuleResult = await eventService.updateRule(eventRule, parentUUID)
        if (eventRuleResult !== false) {
            succesResponse.result = eventRuleResult
            return res.status(200).json(succesResponse)
        }else {

            /**
             * Something went wrong
             */
            console.log('Update rule - error:', eventRule)
            errorResponse.error = "Something went wrong"
            return res.status(500).json(errorResponse)
        }
    }
    catch (error) {
        errorResponse.error = { message: "Update rule - error: " + error.message, stack: error.stack }
        console.log('Update rule - error:', errorResponse)
        res.status(500).json(errorResponse)
    }

})
/**
 * Delete rule
 */
 router.delete('/v2/rule/:uuid', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            res.status(401).json()
            return
        }
        /**
         * Check if the user has access to the eventRule
         */
        let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.eventRule.delete])
        if (access.allowed === false) {
            res.status(403).json()
            return
        }

        let eventRule = await eventService.getEventRuleByUUID(req.params.uuid)
        if (eventRule === false) {
            /**
             * No rule found return 404
             */
             errorResponse.error = "Rule not found"
            return res.status(404).json()
        }
        eventRuleResult = await eventService.deleteRule(eventRule)
        if (eventRuleResult !== false) {
            succesResponse.result = eventRuleResult
            return res.status(200).json(succesResponse)
        }else {
            /**
             * Something went wrong
             */
            console.log('Create rule - error:', eventRule)
            errorResponse.error = "Something went wrong"
            return res.status(500).json(errorResponse)
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})


router.get('/v2/testcond/:uuid', async (req, res) => {
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
        let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.eventRule.read])
        if (access.allowed === false) {
            return res.status(403).json()
        }
        /**
         * Get the eventRule
         */
         succesResponse.result = []
        let eventRule = await eventService.getEventRuleByUUID(req.params.uuid)
        if (eventRule !== false) {
            if (Array.isArray(eventRule.condition)) {
                // console.log(eventRule.condition)
                let test = eventService.makeConditions({ temperature: 21 }, eventRule.condition)
                succesResponse.result.push(test)
                succesResponse.result.push(eval(test))
            }
            succesResponse.result.push(eventRule)

            return res.status(200).json(succesResponse)
        } else {
            /**
             * No rule found return 404
             */
            return res.status(404).json()
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})
module.exports = router