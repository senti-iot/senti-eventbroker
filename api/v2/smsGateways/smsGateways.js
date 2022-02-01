const express = require('express')
const router = express.Router()
const { authClient } = require('../../../server')

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
router.get('/v2/smsgateways', async (req, res) => {
    try {
        /**
         * Check if the user is logged in and his lease is still good
         */
        let lease = await authClient.getLease(req)
        if (lease === false) {
            return res.status(401).json()
        }

        succesResponse.result = [
            {
                key: 'uni-tel',
                value: 'uni-tel'
            },
            {
                key: 'gatewayapi.com',
                value: 'GatewayAPI.com'
            }
    ]
        return res.status(200).json(succesResponse)
    }
    catch (error) {
        errorResponse.error = { message: "smsgateways - error: " + error.message, stack: error.stack }
        console.log(errorResponse)
        res.status(500).json(errorResponse)
    }
})

module.exports = router