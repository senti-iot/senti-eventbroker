const uuidv4 = require('uuid/v4');
var moment = require('moment');
var mysqlConn = require('../../mysql/mysql_handler')

const sentiDeviceDownlinkService = require('./sentiDeviceDownlinkService')
const notificationEmailService = require('./notificationEmailService')

const EventRule = require('./dataClasses/EventRule')
const EventAction = require('./dataClasses/EventAction')
const Condition = require('./dataClasses/Condition')

class eventService {
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
		systemFunction: 10
	}
	/**
	 * 
	 * @param {Object} data 
	 * @param {*} deviceTypeId 
	 * @param {*} registryId 
	 * @param {*} deviceId 
	 */
	async findRulesAndExecute(data, deviceTypeId = null, registryId = null, deviceId = null) {
		let select = `SELECT id, uuid, \`name\`, dataSource, \`condition\`, cloudFunction, ttl, host, 
						IFNULL(deviceTypeId, ?) as deviceTypeId,
						IFNULL(registryId, ?) as registryId,
						IFNULL(deviceId, ?) as deviceId
						FROM eventRule WHERE deleted = 0 AND (deviceTypeId = ? OR registryId = ? OR deviceId = ?)`
		let rs = await mysqlConn.query(select, [deviceTypeId, registryId, deviceId, deviceTypeId, registryId, deviceId])
		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				let eventRule = new EventRule(row)
				if (await this.testRule(data, eventRule.condition)) {
					await this.findActionsAndExecute(data, eventRule)
				}
			})
		}
	}
	/**
	 * 
	 * @param {EventRule} eventRule 
	 */
	async shouldExecute(eventRule) {
		let expires = this.expiresFromTtl(eventRule.ttl)
		let select = `SELECT id FROM event WHERE ruleId = ? AND deviceId = ? AND state = 0 AND expires > NOW() ORDER BY expires DESC LIMIT 1`
		let rs = await mysqlConn.query(select, [eventRule.id, eventRule.deviceId])
		if (rs[0].length === 1) {
			let update = `UPDATE event SET count = count + 1, expires = ? WHERE id = ?`
			let rsUpdate = await mysqlConn.query(update, [expires, rs[0][0].id])
			return false
		} else {
			let insert = `INSERT INTO event (ruleId, deviceId, count, state, expires) VALUES (?, ?, ?, ?, ?)`
			let rsInsert = await mysqlConn.query(insert, [eventRule.id, eventRule.deviceId, 1, 0, expires])
			return true
		}
	}
	/**
	 * 
	 * @param {Object} data 
	 * @param {EventRule} eventRule 
	 */
	async findActionsAndExecute(data, eventRule) {
		if (await this.shouldExecute(eventRule) === false) {
			return
		}
		let select = `SELECT id, ruleId, type, config, deleted FROM eventAction WHERE ruleID = ? AND deleted = 0`
		let rs = await mysqlConn.query(select, [eventRule.id])
		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				let eventAction = new EventAction(row)
				await this.executeAction(data, eventRule, eventAction)
			})
		}
	}
	/**
	 * 
	 * @param {Object} data 
	 * @param {EventRule} eventRule 
	 * @param {EventAction} eventAction 
	 */
	async executeAction(data, eventRule, eventAction) {
		switch (eventAction.type) {
			case eventService.actionTypes.notificationEmail:
				const notificationService = new notificationEmailService(mysqlConn)
				notificationService.execute(data, eventRule, eventAction)
				break;
			case eventService.actionTypes.deviceDownlink:
				const deviceDownlinkService = new sentiDeviceDownlinkService(mysqlConn)
				deviceDownlinkService.execute(data, eventRule, eventAction)
				break
		}
	}
	/**
	 * 
	 * @param {Object} data 
	 * @param {Condition} condition 
	 */
	async testRule(data, condition) {
		if (condition === null) {
			return false
		}
		let result = false
		switch (condition.operation) {
			case '=':
				result = (data[condition.metric] = condition.qualifier)
				break;
			case '>':
				result = (data[condition.metric] > condition.qualifier)
				break;
			case '>=':
				result = (data[condition.metric] >= condition.qualifier)
				break;
			case '<=':
				result = (data[condition.metric] <= condition.qualifier)
				break;
			case '<':
				result = (data[condition.metric] < condition.qualifier)
				break;
		}
		return result
	}

	async sendEventOK(ruleId) {

	}

	async eventCleanup() {
		let select = `SELECT id FROM event WHERE state = 0 AND expires < NOW()`
		let rs = await mysqlConn.query(select)
		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				let update = `UPDATE event SET state 1 WHERE id = ?`
				await mysqlConn.query(update, [rs[0][0].id])
			})
		}
	}
	/**
	 * 
	 * @param {Object} ttl 
	 */
	expiresFromTtl(ttl) {
		let expires
		if (this.validTTL(Object.keys(ttl)[0])) {
			let ttlKey = Object.keys(ttl)[0]
			let ttlValue = ttl[ttlKey]
			if (ttlKey === "date") {
				expires = moment(ttlValue).format()
			} else {
				expires = moment().add(ttlValue, ttlKey).format()
			}
		} else {
			expires = moment().format()
		}
		return expires
	}
	/**
	 * 
	 * @param {string} key 
	 */
	validTTL(key) {
		let approvedKeys = ["years", "y", "quarters", "Q", "months", "M", "weeks", "w", "days", "d", "hours", "h", "minutes", "m", "seconds", "s", "milliseconds", "ms", "date"]
		return (approvedKeys.filter(item => { return item === key })[0] !== undefined) ? true : false
	}
}
module.exports = eventService