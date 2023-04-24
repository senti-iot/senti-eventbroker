const uuidv4 = require('uuid/v4')
var moment = require('moment')
var mysqlConnV1 = require('../../mysql/mysql_handler')
var mysqlConn = require('../../mysql/mysql_handler_v2')
const engineAPI = require('../../api/engine/engine')

const sentiDeviceDownlinkService = require('./sentiDeviceDownlinkService')
const sentiApiSimplePost = require('./sentiApiSimplePost')
const notificationEmailService = require('./notificationEmailServiceV2')
const notificationSMSService = require('./notificationSMSServiceV2')
const notificationUserService = require('./notifikationUserService')
const sentiMqttPublish = require('./sentiMqttPublish')

const EventRule = require('./dataClasses/EventRule')
const EventAction = require('./dataClasses/EventAction')
const Condition = require('./dataClasses/Condition')
const EventNotifikation = require('./dataClasses/EventNotifikation')
const EventRuleV2 = require('./dataClasses/EventRuleV2')
const Event = require('./dataClasses/Event')
const EventActionV2 = require('./dataClasses/EventActionV2')
const eventService = require('./eventService')

const format = 'YYYY-MM-DD HH:mm:ss'

class eventServiceV2 {
	constructor() {
		this.db = mysqlConn
	}
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
		mqttPublish: 16
	}
	static notificationStrategy = {
		once: 1,
		until_ack: 2,
		until_ok: 3,
		always: 4
	}
	static ttlTypes = {
		fromNow: 1,
		fromFirstEvent: 2,
		always: 3
	}
	//#region Alarm Test & Notification generator
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
		let select = `SELECT ER.id,
						ER.uuid,
						ER.\`name\`,
						ER.\`condition\`,
						ER.cloudFunction,
						ER.config,
						IFNULL(ER.deviceTypeUUID, ?) as deviceTypeUUID,
						IFNULL(ER.registryUUID, ?) as registryUUID,
						IFNULL(ER.deviceUUID, ?) as deviceUUID
					FROM (
						SELECT id
						FROM eventRule
						WHERE deleted = 0 AND deviceTypeUUID = ?
						UNION
						SELECT id
						FROM eventRule
						WHERE deleted = 0 AND registryUUID = ?
						UNION SELECT id
						FROM eventRule
						WHERE deleted = 0 AND deviceUUID = ?
					) t
					INNER JOIN eventRule ER ON t.id=ER.id`
		// console.log(await mysqlConn.format(select, [deviceTypeId, registryId, deviceId, deviceTypeId, registryId, deviceId]))
		let rs = await mysqlConn.query(select, [deviceTypeId, registryId, deviceId, deviceTypeId, registryId, deviceId])

		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				let eventRule = new EventRuleV2(row)
				let conditionState = await this.testRule(data, eventRule)
				let event = await this.shouldExecute(data, eventRule, conditionState)
				// console.log(data, eventRule, event, conditionState)
				if (conditionState !== null && event.shouldExecute !== false) {
					//console.log('execute', event)
					await this.findActionsAndExecute(data, eventRule, event.state)
				} else {
					//console.log('no execute', conditionState)
				}
			})
		}
	}
	/**
	 * 
	 * @param {Object} data 
	 * @param {EventRuleV2} eventRule 
	 * @param {boolean} conditionState 
	 * @returns Event
	 */
	async shouldExecute(data, eventRule, conditionState) {
		let event = new Event()
		//  console.log(data, eventRule, conditionState)
		
		let select = `SELECT * FROM event WHERE ruleUUID = ? AND deviceUUID = ? AND state != 10`
		// console.log(await mysqlConn.format(select, [eventRule.uuid, eventRule.deviceUUID]))
		let rs = await mysqlConn.query(select, [eventRule.uuid, eventRule.deviceUUID])
		if (rs[0].length === 1) {
			event = new Event(rs[0][0])
			event.count++
			if (conditionState === true) {
				switch (eventRule.config.notificationStrategy) {
					case eventServiceV2.notificationStrategy.once:
						if (event.lastAction !== null) {
							event.nextAction = null
						}
						break
					case eventServiceV2.notificationStrategy.until_ok:
						if (event.nextAction === null) {
							event.nextAction = moment().format(format)
						}
						break
					case eventServiceV2.notificationStrategy.until_ack:
						if (event.state === Event.states.acknowledged) {
							event.nextAction = null
						}
						break
					case eventServiceV2.notificationStrategy.always:
						event.nextAction = moment().format(format)
						break
				}
			} else {
				event.state = Event.states.closed
				event.nextAction = moment().format(format)
			}
		} else {
			if (conditionState === true) {
				event = new Event({ uuid: uuidv4(), ruleUUID: eventRule.uuid, deviceUUID: eventRule.deviceUUID, state: Event.states.active, count: 1, created: data.messageMeta.cleanTime, modified: data.messageMeta.cleanTime })
				if (eventRule.config.when.first) {
					event.nextAction = moment(this.getMomentFromTtl(event.created, eventRule.config.when.first)).format(format)
				} else {
					event.nextAction = moment().format(format)
				}
			} else {
				//console.log('No event')
				return event
			}
		}
		if (moment(event.nextAction).isSameOrBefore(moment())) {
			if (eventRule.config.when.every) {
				event.nextAction = moment(this.getMomentFromTtl(moment().format(format), eventRule.config.when.every)).format(format)
			} else {
				event.nextAction = null
			}
			event.lastAction = moment().format(format)
			event.shouldExecute = true
		}
		await this.saveEvent(event)
		return event
	}
	async saveEvent(event) {
		event.modified = moment().format(format)
		// console.log(event)
		if (event.id !== null) {
			let update = `UPDATE event SET uuid = ?, ruleUUID = ?, deviceUUID = ?, count = ?, state = ?, created = ?, modified = ?, lastAction = ?, nextAction = ?, expires = ? WHERE id = ?`
			// console.log(await mysqlConn.format(update, [event.uuid, event.ruleUUID, event.deviceUUID, event.count, event.state, event.created, event.modified, event.lastAction, event.nextAction, event.expires, event.id]))
			await mysqlConn.query(update, [event.uuid, event.ruleUUID, event.deviceUUID, event.count, event.state, event.created, event.modified, event.lastAction, event.nextAction, event.expires, event.id])
		} else {
			let insert = `INSERT INTO event (uuid, ruleUUID, deviceUUID, count, state, created, modified, lastAction, nextAction) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			// console.log(await mysqlConn.format(insert, [event.uuid, event.ruleUUID, event.deviceUUID, event.count, event.state, event.created, event.modified, event.lastAction, event.nextAction]))
			await mysqlConn.query(insert, [event.uuid, event.ruleUUID, event.deviceUUID, event.count, event.state, event.created, event.modified, event.lastAction, event.nextAction])
		}
	}

	async saveEventData(eventId, dataId) {
		let insert = `INSERT INTO eventData (eventId, dataId) VALUES (?, ?)`
		// console.log(await mysqlConn.format(insert, [eventId, dataId]))
		let rsInsert = await mysqlConn.query(insert, [eventId, dataId])
	}
	/**
	 *
	 * @param {Object} data
	 * @param {EventRuleV2} eventRule
	 */
	async findActionsAndExecute(data, eventRule, state) {
		let select = `SELECT id, uuid, ruleUUID, type, config, state, deleted, host FROM eventAction WHERE ruleUUID = ? AND state = ? AND deleted = 0`
		//console.log(await mysqlConn.format(select, [eventRule.uuid, state]))
		let rs = await mysqlConn.query(select, [eventRule.uuid, state])
		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				let eventAction = new EventActionV2(row)
				// console.log(eventAction)
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
			case eventServiceV2.actionTypes.notificationEmail:
				const notificationService = new notificationEmailService(mysqlConnV1)
				notificationService.execute(data, eventRule, eventAction)
				break
			case eventServiceV2.actionTypes.notificationSMS:
				const notificationSMS = new notificationSMSService(mysqlConnV1)
				notificationSMS.execute(data, eventRule, eventAction)
				break
			// case eventServiceV2.actionTypes.deviceDownlink:
			// 	const deviceDownlinkService = new sentiDeviceDownlinkService(mysqlConnV1)
			// 	deviceDownlinkService.execute(data, eventRule, eventAction)
			// 	break
			case eventServiceV2.actionTypes.apiSimplePost:
				const apiSimplePost = new sentiApiSimplePost(mysqlConn)
				apiSimplePost.execute(data, eventRule, eventAction)
				break
			// case eventServiceV2.actionTypes.notificationUser:
			// 	const notificationUser = new notificationUserService(mysqlConnV1)
			// 	notificationUser.execute(data, eventRule, eventAction)
			// 	break
			case eventServiceV2.actionTypes.mqttPublish:
				const mqttPublish = new sentiMqttPublish(mysqlConn)
				mqttPublish.execute(data, eventRule, eventAction)
				break
			case eventServiceV2.actionTypes.noAction:
				//console.log('No Action', data, eventRule, eventAction)
				break
		}
	}
	testCondition(data, condition) {
		// console.log(data, condition)
		let result = false
		if (data[condition.metric] === undefined) {
			return null
		}
		switch (condition.operation) {
			case '=':
				result = (data[condition.metric] == condition.qualifier)
				break
			case 'NOT':
				result = (data[condition.metric] != condition.qualifier)
				break
			case '>':
				result = (data[condition.metric] > condition.qualifier)
				break
			case '>=':
				result = (data[condition.metric] >= condition.qualifier)
				break
			case '<=':
				result = (data[condition.metric] <= condition.qualifier)
				break
			case '<':
				result = (data[condition.metric] < condition.qualifier)
				break
			case 'IN':
				result = Array.isArray(condition.qualifier) ? condition.qualifier.includes(data[condition.metric]) : false
				break
		}
		// console.log(result)
		return result
	}

	testConditions(data, conditions) {
		let result = false
		try {
			let condition = this.makeConditions(data, conditions)
			if (condition === null) {
				return null
			}
			result = eval(condition)
		} catch (e) {
			console.log(e)
			return null
		}
		return result
	}
	makeConditions(data, conditions) {
		let c1 = []
		conditions.map(condition => {
			c1.push(this.makeCondition(data, condition))
		})
		return c1.join(' ')
	}
	makeCondition(data, condition) {
		let c1 = []
		if (condition.logical) {
			return condition.logical
		}
		if (Array.isArray(condition)) {
			c1.push('(' + this.makeConditions(data, condition) + ')')
		} else {
			c1.push(data[condition.metric] + ' ' + condition.operation + ' ' + condition.qualifier)
		}
		return c1.join(' ')
	}
	// makeCondition(data, condition) {
	// 	let c1 = []
	// 	console.log('makeCondition', data, condition)
	// 	if (condition.logical) {
	// 		return condition.logical
	// 	}
	// 	if (Array.isArray(condition.condition)) {
	// 		c1.push('(' + this.makeConditions(data, condition.condition) + ')')
	// 	} else {
	// 		c1.push(data[condition.condition.metric] + ' ' + condition.condition.operation + ' ' + condition.condition.qualifier)
	// 	}
	// 	return c1.join(' ')
	// }

	async testCloudFunction(data, eventRule) {
		let decodedTest = await engineAPI.post('/', { nIds: [eventRule.cloudFunction], data: { ...data } })
		return (decodedTest.data === true) ? true : false
	}
	/**
	 *
	 * @param {Object} data
	 * @param {Condition} condition
	 */
	async testRule(data, eventRule) {
		if (eventRule.cloudFunction !== null) {
			return await this.testCloudFunction(data, eventRule)
		}
		if (eventRule.condition === null) {
			return false
		}
		// V2 logical test
		if (Array.isArray(eventRule.condition)) {
			return this.testConditions(data.message, eventRule.condition)
		}
		// V1 logical test
		return this.testCondition(data.message, eventRule.condition)
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
	 * @param {Object} ttn
	 */
	getMomentFromTtl(dateTime, ttl) {
		let expires
		if (this.validTTL(Object.keys(ttl)[0])) {
			let ttlKey = Object.keys(ttl)[0]
			let ttlValue = ttl[ttlKey]
			if (ttlKey === "date") {
				expires = moment(ttlValue).format()
			} else {
				expires = moment(dateTime).add(ttlValue, ttlKey).format()
			}
		} else {
			expires = moment(dateTime).format()
		}
		return expires
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
	//#endregion

	//#region CRUD V2
	async getEventRulesByUUID(uuids = false) {
		if (uuids === false) {
			return false
		}
		let result = []
		let clause = (uuids.length > 0) ? ' AND er.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT
					er.id,
					er.uuid,
					er.name,
					er.condition,
					er.cloudFunction,
					er.config,
					er.deviceTypeUUID,
					er.registryUUID,
					er.deviceUUID,
					er.host
                FROM
                    eventRule er
			WHERE er.deleted = 0 ${clause}
			;`
		// let sql = this.db.format(select, uuids)
		// console.log(sql)
		let rs = await this.db.query(select, uuids)
		if (rs[0].length === 0) {
			return result
		}
		rs[0].forEach(async rsEvent => {
			let eventRule = new EventRuleV2(rsEvent)
			result.push(eventRule)
		})
		return result
	}
	/**
	 * 
	 * @param {*} uuid 
	 * @param {*} deleted 
	 * @returns EventRuleV2
	 */
	async getEventRuleByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT
					er.id,
					er.uuid,
					er.name,
					er.condition,
					er.cloudFunction,
					er.config,
					er.deviceTypeUUID,
					er.registryUUID,
					er.deviceUUID,
					er.host
                FROM
                    eventRule er
			WHERE er.uuid = ? AND er.deleted = ?;`
		// let sql = this.db.format(select, [uuid, deleted])
		// console.log(sql)
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length === 1) {
			let eventRule = new EventRuleV2(rs[0][0])
			return eventRule
		}
		return false
	}
	async getEventRuleParentByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT er.parentUUID FROM eventRule er WHERE er.uuid = ? AND er.deleted = ?`
		// let sql = this.db.format(select, [uuid, deleted])
		// console.log(sql)
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length === 1) {
			return rs[0][0].parentUUID
		}
		return false
	}
	/**
	 * 
	 * @param {EventRuleV2} eventRule 
	 * @param {uuid} parentUUID
	 * @returns EventRuleV2
	 */
	async createRule(eventRule = false, parentUUID = null) {
		if (eventRule === false) {
			return false
		}
		// if (dbO.name === false || dbO.orgId === false) {
		// 	return false
		// }
		eventRule.uuid = uuidv4()

		let insert = `INSERT INTO eventRule(uuid, \`name\`, parentUUID, \`condition\`, cloudFunction, config, deviceTypeUUID, registryUUID, deviceUUID, deleted, host)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
		// let sql = this.db.format(insert, [eventRule.uuid,
		// eventRule.name,
		// 	parentUUID,
		// (eventRule.condition !== null) ? JSON.stringify(eventRule.condition) : eventRule.condition,
		// eventRule.cloudFunction,
		// (eventRule.config !== null) ? JSON.stringify(eventRule.config) : eventRule.config,
		// eventRule.deviceTypeUUID,
		// eventRule.registryUUID,
		// eventRule.deviceUUID,
		// 	0,
		// eventRule.host])
		// console.log(sql)
		let rs = await this.db.query(insert, [eventRule.uuid,
		eventRule.name,
			parentUUID,
		(eventRule.condition !== null) ? JSON.stringify(eventRule.condition) : eventRule.condition,
		eventRule.cloudFunction,
		(eventRule.config !== null) ? JSON.stringify(eventRule.config) : eventRule.config,
		eventRule.deviceTypeUUID,
		eventRule.registryUUID,
		eventRule.deviceUUID,
			0,
		eventRule.host])
		if (rs[0].affectedRows === 1) {
			return await this.getEventRuleByUUID(eventRule.uuid)
		}
		return false
	}
	/**
	 * 
	 * @param {EventRuleV2} eventRule 
	 * @param {uuid} parentUUID
	 * @returns EventRuleV2
	 */
	async updateRule(eventRule = false, parentUUID = null) {
		if (eventRule === false) {
			return false
		}
		let update = `UPDATE eventRule er SET er.name = ?, er.parentUUID = ?, er.condition = ?, 
						er.cloudFunction = ?, er.config = ?, er.deviceTypeUUID = ?, er.registryUUID = ?, 
						er.deviceUUID = ?, er.host = ?
					WHERE er.uuid = ?`
		// let sql = this.db.format(update, [eventRule.name,
		// 	parentUUID,
		// (eventRule.condition !== null) ? JSON.stringify(eventRule.condition) : eventRule.condition,
		// eventRule.cloudFunction,
		// (eventRule.config !== null) ? JSON.stringify(eventRule.config) : eventRule.config,
		// eventRule.deviceTypeUUID,
		// eventRule.registryUUID,
		// eventRule.deviceUUID,
		// eventRule.host,
		// eventRule.uuid])
		// console.log(sql)
		let rs = await this.db.query(update, [eventRule.name,
			parentUUID,
		(eventRule.condition !== null) ? JSON.stringify(eventRule.condition) : eventRule.condition,
		eventRule.cloudFunction,
		(eventRule.config !== null) ? JSON.stringify(eventRule.config) : eventRule.config,
		eventRule.deviceTypeUUID,
		eventRule.registryUUID,
		eventRule.deviceUUID,
		eventRule.host,
		eventRule.uuid])
		if (rs[0].affectedRows === 1) {
			return await this.getEventRuleByUUID(eventRule.uuid)
		}
		return false
	}
	/**
* 
* @param {EventRuleV2} eventRule 
* @param {uuid} parentUUID
* @returns EventRuleV2
*/
	async deleteRule(eventRule = false) {
		if (eventRule === false) {
			return false
		}
		let update = `UPDATE eventRule er SET er.deleted = 1 WHERE er.uuid = ?`
		let rs = await this.db.query(update, [eventRule.uuid])
		if (rs[0].affectedRows === 1) {
			return true
		}
		return false
	}
	async getEventRuleActionsByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let result = []
		let select = `SELECT
					ea.id,
					ea.uuid,
					ea.ruleUUID,
					ea.type,
					ea.config,
					ea.state,
					ea.deleted,
					ea.host
                FROM
                    eventAction ea
			WHERE ea.ruleUUID = ? AND ea.deleted = ?`
		// let sql = this.db.format(select, [uuid, deleted])
		// console.log(sql)
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length === 0) {
			return result
		}
		rs[0].forEach(async rsAction => {
			let eventAction = new EventActionV2(rsAction)
			result.push(eventAction)
		})
		return result
	}
	async getEventRuleActionByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			throw new Error('No uuid')
		}
		let select = `SELECT
					ea.id,
					ea.uuid,
					ea.ruleUUID,
					ea.type,
					ea.config,
					ea.state,
					ea.deleted,
					ea.host
                FROM
                    eventAction ea
			WHERE ea.uuid = ? AND ea.deleted = ?`
		// let sql = this.db.format(select, [uuid, deleted])
		// console.log(sql)
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length === 1) {
			return new EventActionV2(rs[0][0])
		}
		return false
	}
	/**
	 * 
	 * @param {EventActionV2} eventAction
	 * @returns EventActionV2
	 */
	async createAction(eventAction = false) {
		if (eventAction === false) {
			throw new Error('No action object')
		}
		eventAction.uuid = uuidv4()

		let insert = `INSERT INTO eventAction(uuid, ruleUUID, type, config, state, deleted, host)
			VALUES(?, ?, ?, ?, ?, ?, ?)`
		// let sql = this.db.format(insert, [eventAction.uuid,
		// 	eventAction.ruleUUID,
		// 	eventAction.type,
		// 	(eventAction.config !== null) ? JSON.stringify(eventAction.config) : eventAction.config,
		// 	eventAction.state,
		// 		0,
		// 	eventAction.host])
		// console.log(sql)
		let rs = await this.db.query(insert, [eventAction.uuid,
			eventAction.ruleUUID,
			eventAction.type,
			(eventAction.config !== null) ? JSON.stringify(eventAction.config) : eventAction.config,
			eventAction.state,
				0,
			eventAction.host])
		if (rs[0].affectedRows === 1) {
			return await this.getEventRuleActionByUUID(eventAction.uuid)
		}
		return false
	}
	/**
	 * 
	 * @param {EventActionV2} eventAction
	 * @returns EventActionV2
	 */
	async updateAction(eventAction = false) {
		if (eventAction === false) {
			throw new Error('No action object')
		}
		let update = `UPDATE eventAction ea SET ea.ruleUUID = ?, ea.type = ?, 
						ea.config = ?, ea.state = ?, ea.host = ?
					WHERE ea.uuid = ?`
		// let sql = this.db.format(update, [eventAction.ruleUUID,
		// 	eventAction.type,
		// 	(eventAction.config !== null) ? JSON.stringify(eventAction.config) : eventAction.config,
		// 	eventAction.state,
		// 	eventAction.host,
		// 	eventAction.uuid])
		// console.log(sql)
		let rs = await this.db.query(update, [eventAction.ruleUUID,
			eventAction.type,
			(eventAction.config !== null) ? JSON.stringify(eventAction.config) : eventAction.config,
			eventAction.state,
			eventAction.host,
			eventAction.uuid])
		if (rs[0].affectedRows === 1) {
			return await this.getEventRuleActionByUUID(eventAction.uuid)
		}
		return false
	}
	/**
	 * 
	 * @param {EventActionV2} eventAction
	 * @returns EventActionV2
	 */
	 async deleteAction(eventAction = false) {
		if (eventAction === false) {
			return false
		}
		let update = `UPDATE eventAction ea SET ea.deleted = 1 WHERE ea.uuid = ?`
		let rs = await this.db.query(update, [eventAction.uuid])
		if (rs[0].affectedRows === 1) {
			return true
		}
		return false
	}
	//#endregion
}
module.exports = eventServiceV2
