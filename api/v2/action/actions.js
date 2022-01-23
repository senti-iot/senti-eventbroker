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

router.get('/v2/actions/:uuid', async (req, res) => {
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
        /**
         * Check if the user has access to modify the eventRule and its actions
         */
        let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.eventRule.read, sentiAclPriviledge.eventRule.modify])
        if (access.allowed === false) {
            return res.status(403).json()
        }
        let eventActions = await eventService.getEventRuleActionsByUUID(req.params.uuid)
        if (eventActions === false) {
            throw new Error('Booom!')
        }
        succesResponse.result = eventActions
        // if (eventActions.length === 0) {
        //     return res.status(404).json(succesResponse)
        // }
        return res.status(200).json(succesResponse)
    }
    catch (error) {
        errorResponse.error = { message: "Get actions - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})

module.exports = router