const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const sentiEventService = require('../../../lib/event/eventServiceV2')
const eventService = new sentiEventService()

var errorResponse = {
    status: "error",
    error: ""
}
var succesResponse = {
    status: "ok",
    result: null
}

router.get('/v2/rules', async (req, res) => {
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
         * Get all eventRule the user has access to
         */
        let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.eventRule, sentiAclPriviledge.eventRule.read)
        if (resources.length === 0) {
            res.status(404).json([])
            return
        }
        // console.log(resources)
        let queryUUIDs = resources.map(item => { return item.uuid })
        succesResponse.result = await eventService.getEventRulesByUUID(queryUUIDs)
        res.status(200).json(succesResponse)
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})

router.get('/v2/rules/:uuid', async (req, res) => {
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
         * Get all eventRule the user has access to
         */
        let resources = await aclClient.findResources(lease.uuid, req.params.uuid, sentiAclResourceType.eventRule, sentiAclPriviledge.eventRule.read)
        if (resources.length === 0) {
            res.status(404).json([])
            return
        }
        // console.log(resources)
        let queryUUIDs = resources.map(item => { return item.uuid })
        let result = {
            status: "ok",
            result: await eventService.getEventRulesByUUID(queryUUIDs)
        }
        res.status(200).json(result)
    }
    catch (error) {
        res.status(500).json({ message: error.message, stack: error.stack })
    }
})

module.exports = router