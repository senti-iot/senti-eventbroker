const uuidv4 = require('uuid/v4');
var moment = require('moment');
var mysqlConn = require('../../mysql/mysql_handler')

const sentiDeviceDownlinkService = require('./sentiDeviceDownlinkService')
const sentiApiSimplePost = require('./sentiApiSimplePost')
const notificationEmailService = require('./notificationEmailService')
const notificationSMSService = require('./notificationSMSService')

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
		systemFunction: 10,
		notificationSMSUniTel: 11,
		apiSimplePost: 12
	}
	static ttlTypes = {
		fromNow: 1,
		fromFirstEvent: 2
	}
	/**
	 * 
	 * @param {Object} data 
	 * @param {*} deviceTypeId 
	 * @param {*} registryId 
	 * @param {*} deviceId 
	 */
	async findRulesAndExecute(data, deviceTypeId = null, registryId = null, deviceId = null) {
		if (data.sentiNoEvent === true) {
			return
		}
		// let select = `SELECT id, uuid, \`name\`, dataSource, \`condition\`, cloudFunction, config,
		// 				IFNULL(deviceTypeId, ?) as deviceTypeId,
		// 				IFNULL(registryId, ?) as registryId,
		// 				IFNULL(deviceId, ?) as deviceId
		// 				FROM eventRule WHERE deleted = 0 AND (deviceTypeId = ? OR registryId = ? OR deviceId = ?)`
		let select = `SELECT ER.id, 
						ER.uuid, 
						ER.\`name\`, 
						ER.dataSource, 
						ER.\`condition\`, 
						ER.cloudFunction, 
						ER.config, 
						IFNULL(ER.deviceTypeId, ?) as deviceTypeId, 
						IFNULL(ER.registryId, ?) as registryId,
						IFNULL(ER.deviceId, ?) as deviceId
					FROM (
						SELECT id 
						FROM eventRule 
						WHERE deleted = 0 AND deviceTypeId = ?
						UNION    
						SELECT id 
						FROM eventRule 
						WHERE deleted = 0 AND registryId = ?
						UNION SELECT id 
						FROM eventRule 
						WHERE deleted = 0 AND deviceId = ?
					) t
					INNER JOIN eventRule ER ON t.id=ER.id`
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
		let expires = this.expiresFromTtl(eventRule.config.ttl)
		let select = `SELECT id, expires FROM event WHERE ruleId = ? AND deviceId = ? AND state = 0 AND expires >= NOW() ORDER BY expires DESC LIMIT 1`
		let rs = await mysqlConn.query(select, [eventRule.id, eventRule.deviceId])
		if (rs[0].length === 1) {
			if (eventRule.config.ttlType === eventService.ttlTypes.fromFirstEvent) {
				expires = rs[0][0].expires
			}
			let update = `UPDATE event SET count = count + 1, expires = ? WHERE id = ?`
			let rsUpdate = await mysqlConn.query(update, [expires, rs[0][0].id])
			eventRule.eventId = rs[0][0].id
			// Can return true if a count rule is made on eventRule
			return false
		} else {
			let insert = `INSERT INTO event (ruleId, deviceId, count, state, expires) VALUES (?, ?, ?, ?, ?)`
			let rsInsert = await mysqlConn.query(insert, [eventRule.id, eventRule.deviceId, 1, 0, expires])
			eventRule.eventId = rsInsert[0].insertId
			// Can return false if a count rule is made on eventRule
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
		let select = `SELECT id, ruleId, type, config, deleted, host FROM eventAction WHERE ruleID = ? AND deleted = 0`
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
			case eventService.actionTypes.notificationSMS:
					const notificationSMS = new notificationSMSService(mysqlConn)
					notificationSMS.execute(data, eventRule, eventAction)
					break;
			case eventService.actionTypes.deviceDownlink:
				const deviceDownlinkService = new sentiDeviceDownlinkService(mysqlConn)
				deviceDownlinkService.execute(data, eventRule, eventAction)
				break
			case eventService.actionTypes.apiSimplePost:
				const apiSimplePost = new sentiApiSimplePost(mysqlConn)
				apiSimplePost.execute(data, eventRule, eventAction)
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
		// console.log('testRule', data, condition)
		if (!data[condition.metric]) {
			return result
		}
		switch (condition.operation) {
			case '=':
				result = (data[condition.metric] === condition.qualifier)
				break;
			case 'NOT':
				result = (data[condition.metric] !== condition.qualifier)
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
			case 'IN':
				result = Array.isArray(condition.qualifier) ? condition.qualifier.includes(data[condition.metric]) : false
				break;
		}
		// console.log('testRule', result)
		return result
	}

	async sendEventOK(ruleId) {

	}

	async eventCleanup() {
		let select = `SELECT id, ruleId FROM event WHERE state = 0 AND expires < NOW()`
		let rs = await mysqlConn.query(select)
		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				// console.log(row)
				let update = `UPDATE event SET state = 1 WHERE id = ?`
				// await mysqlConn.query(update, [rs[0][0].id])
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