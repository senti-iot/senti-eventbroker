var mysqlConn = require('../../mysql/mysql_handler_v2')
const uuidv4 = require('uuid/v4')

const notificationEmailService = require('./notificationEmailServiceV2')
const Subscription = require('./dataClasses/Subscription')

class sentiSubscriptionService {
	static actionTypes = {
		notificationEmail: 1,
		notificationSMS: 2,
		notificationSlack: 3,
		notificationAppPush: 4,
		notificationWebPush: 5,
		notificationMobileApp: 6,
		notificationSentiAct: 7,
		apiCall: 8,
		deviceDownlink: 9,
		systemFunction: 10,
		notificationSMSUniTel: 11,
		apiSimplePost: 12,
		notificationUser: 13,
		noAction: 14,
		notificationCfEmail: 15,
		mqttPublish: 16,
		deviceLocationUpdate: 17
	}

    async getIdByUuid(uuid) {
        let select = `SELECT s.id
                FROM eventSubscription s
                WHERE s.uuid = ?`
        // console.log(mysqlConn.format(select, [uuid]))
        let rs = await mysqlConn.query(select, [uuid]).catch(err => {
            console.log(err)
        })
        if (rs[0].length === 1) {
            return rs[0][0].id
        }
        return false
    }
    async getSubscriptions(parent = null, active = 1) {
        let select = `SELECT s.id, s.uuid, s.parentUUID, s.active, json_unquote(s.data->'$.cron') as cronTime
                FROM eventSubscription s
                WHERE s.active = ? AND (s.parentUUID = ? OR s.parentUUID IS NULL)`
        let rs = await mysqlConn.query(select, [active, parent]).catch(err => {
            console.log(err)
        })
        if(rs[0].length > 0) {
            let result = []
            rs[0].forEach(row => {
                result.push(new Subscription(row))
            })
            return result
        }
		return []
    }
    async getSubscription(id = false, active = 1) {
        if (id === false) {
            return false
        }
        let select = `SELECT s.id, s.uuid, s.parentUUID, s.active, json_unquote(s.data->'$.cron') as cronTime
                FROM eventSubscription s
                WHERE s.id = ? AND s.active = ?`
        // console.log(mysqlConn.format(select, [id, active]))
        let rs = await mysqlConn.query(select, [id, active]).catch(err => {
            console.log(err)
        })
        if(rs[0].length === 1) {
            return new Subscription(rs[0][0])
        }
        return false
    }
    async getSubscriptionByUuid(uuid = false, active = 1) {
        return await this.getSubscription(await this.getIdByUuid(uuid), active)
    }

	async getSubscriptionRules(subscriptionId = false) {
		if (subscriptionId === false) {
			return false
		}
		let select = `SELECT e.id, e.subscriptionId, e.cloudFunction, e.condition, e.config
			FROM eventSubscriptionRule e
			WHERE subscriptionId = ?`
		// console.log(mysqlConn.format(select, [id, active]))
		let rs = await mysqlConn.query(select, [subscriptionId]).catch(err => {
			console.log(err)
		})
		if(rs[0].length > 0) {
			return rs[0]
		}
		return false
	}
	async getSubscriptionRulesByParent(parentUUID = false) {
		if (parentUUID === false) {
			return false
		}
		let select = `SELECT e.id, e.uuid, e.subscriptionId, e.parentOrg, e.parentUser, e.cloudFunction, e.condition, e.config
			FROM eventSubscriptionRule e
			WHERE e.parentOrg = ? OR e.parentUser = ?`
		// console.log(mysqlConn.format(select, [id, active]))
		let rs = await mysqlConn.query(select, [parentUUID, parentUUID]).catch(err => {
			console.log(err)
		})
		if(rs[0].length > 0) {
			return rs[0]
		}
		return false
	}

	async updateSubscriptionRule(data) {
		if (typeof data.id === 'undefined') {
			return false
		}
		let update = `UPDATE eventSubscriptionRule esr SET esr.subscriptionId = ?, esr.parentOrg = ?, esr.parentUser = ?, esr.cloudFunction = ?, esr.condition = ?, esr.config = ? WHERE esr.id = ?`
		console.log(mysqlConn.format(update, [data.subscriptionId, data.parentOrg, data.parentUser, data.cloudFunction,JSON.stringify(data.condition), JSON.stringify(data.config), data.id]))
		let rs = await mysqlConn.query(update, [data.subscriptionId, data.parentOrg, data.parentUser, data.cloudFunction, JSON.stringify(data.condition), JSON.stringify(data.config), data.id]).catch(err => {
			console.log(err)
		})
		if (rs[0].affectedRows === 1) {
			return true
		}
		return false
	}
	async createSubscriptionRule(data) {
		let insert = `INSERT INTO eventSubscriptionRule (uuid, subscriptionId, parentOrg, parentUser, cloudFunction, \`condition\`, config) VALUES (?, ?, ?, ?, ?, ?, ?)`
		let uuid = uuidv4()
		console.log(mysqlConn.format(insert, [uuid, data.subscriptionId, data.parentOrg, data.parentUser, data.cloudFunction, JSON.stringify(data.condition), JSON.stringify(data.config)]))
		let rs = await mysqlConn.query(insert, [uuid, data.subscriptionId, data.parentOrg, data.parentUser, data.cloudFunction, JSON.stringify(data.condition), JSON.stringify(data.config)]).catch(err => {
			console.log(err)
		})
		if (rs[0].affectedRows === 1) {
			return await this.getSubscriptionRuleById(rs[0].insertId)
		}
		return false
	}
	async getSubscriptionRuleById(id = false) {
		if (id === false) {
			return false
		}
		let select = `SELECT e.id, e.uuid, e.subscriptionId, e.parentOrg, e.parentUser, e.cloudFunction, e.condition, e.config
			FROM eventSubscriptionRule e
			WHERE e.id = ?`
		// console.log(mysqlConn.format(select, [id, active]))
		let rs = await mysqlConn.query(select, [id]).catch(err => {
			console.log(err)
		})
		if(rs[0].length === 1) {
			return rs[0][0]
		}
		return false
	}
}
module.exports = sentiSubscriptionService
