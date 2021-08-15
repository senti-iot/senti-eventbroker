const uuidv4 = require('uuid/v4')
var moment = require('moment')
var mysqlConn = require('../../mysql/mysql_handler')
const engineAPI = require('../../api/engine/engine')

const sentiDeviceDownlinkService = require('./sentiDeviceDownlinkService')
const sentiApiSimplePost = require('./sentiApiSimplePost')
const notificationEmailService = require('./notificationEmailService')
const notificationSMSService = require('./notificationSMSService')
const notificationUserService = require('./notifikationUserService')

const EventRule = require('./dataClasses/EventRule')
const EventAction = require('./dataClasses/EventAction')
const Condition = require('./dataClasses/Condition')
const EventNotifikation = require('./dataClasses/EventNotifikation')


class eventService {
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
		notificationUser: 13
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
		// console.log(await mysqlConn.format(select, [deviceTypeId, registryId, deviceId, deviceTypeId, registryId, deviceId]))
		let rs = await mysqlConn.query(select, [deviceTypeId, registryId, deviceId, deviceTypeId, registryId, deviceId])

		if (rs[0].length > 0) {
			rs[0].forEach(async (row) => {
				let eventRule = new EventRule(row)
				let fulfillsRule = await this.testRule(data, eventRule)
				console.log('Testing Rule', fulfillsRule)
				if (fulfillsRule === true) {
					await this.findActionsAndExecute(data, eventRule)
				}
			})
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
	 * @param {EventRule} eventRule
	 */
	async shouldExecute(data, eventRule) {
		if (eventRule.config.ttlType === eventService.ttlTypes.always) {
			let insert = `INSERT INTO event (ruleId, deviceId, count, state, expires) VALUES (?, ?, ?, ?, NOW())`
			let rsInsert = await mysqlConn.query(insert, [eventRule.id, eventRule.deviceId, 1, 0])
			eventRule.eventId = rsInsert[0].insertId
			this.saveEventData(eventRule.eventId, data.sentiEventDeviceDataCleanId)
			return true
		}
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
			this.saveEventData(eventRule.eventId, data.sentiEventDeviceDataCleanId)
			// Can return true if a count rule is made on eventRule
			return false
		} else {
			let insert = `INSERT INTO event (ruleId, deviceId, count, state, expires) VALUES (?, ?, ?, ?, ?)`
			let rsInsert = await mysqlConn.query(insert, [eventRule.id, eventRule.deviceId, 1, 0, expires])
			eventRule.eventId = rsInsert[0].insertId
			this.saveEventData(eventRule.eventId, data.sentiEventDeviceDataCleanId)
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
		if (await this.shouldExecute(data, eventRule) === false) {
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
				break
			case eventService.actionTypes.notificationSMS:
				const notificationSMS = new notificationSMSService(mysqlConn)
				notificationSMS.execute(data, eventRule, eventAction)
				break
			case eventService.actionTypes.deviceDownlink:
				const deviceDownlinkService = new sentiDeviceDownlinkService(mysqlConn)
				deviceDownlinkService.execute(data, eventRule, eventAction)
				break
			case eventService.actionTypes.apiSimplePost:
				const apiSimplePost = new sentiApiSimplePost(mysqlConn)
				apiSimplePost.execute(data, eventRule, eventAction)
				break
			case eventService.actionTypes.notificationUser:
				const notificationUser = new notificationUserService(mysqlConn)
				notificationUser.execute(data, eventRule, eventAction)
				break
		}
	}
	testConditions(data, conditions) {
		let result = false
		try {
			result = eval(this.makeConditions(data, conditions))
		} catch (e) {
			console.log(e)
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
		if (Array.isArray(condition.condition)) {
			c1.push('(' + this.makeConditions(data, condition.condition) + ')')
		} else {
			c1.push(data[condition.condition.metric] + ' ' + condition.condition.operation + ' ' + condition.condition.qualifier)
		}
		return c1.join(' ')
	}
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
			return this.testConditions(data, eventRule.condition)
		}
		// V1 logical test
		let result = false
		if (!data[eventRule.condition.metric]) {
			return result
		}
		switch (eventRule.condition.operation) {
			case '=':
				result = (data[eventRule.condition.metric] === eventRule.condition.qualifier)
				break
			case 'NOT':
				result = (data[eventRule.condition.metric] !== eventRule.condition.qualifier)
				break
			case '>':
				result = (data[eventRule.condition.metric] > eventRule.condition.qualifier)
				break
			case '>=':
				result = (data[eventRule.condition.metric] >= eventRule.condition.qualifier)
				break
			case '<=':
				result = (data[eventRule.condition.metric] <= eventRule.condition.qualifier)
				break
			case '<':
				result = (data[eventRule.condition.metric] < eventRule.condition.qualifier)
				break
			case 'IN':
				result = Array.isArray(eventRule.condition.qualifier) ? eventRule.condition.qualifier.includes(data[eventRule.condition.metric]) : false
				break
		}
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
	//#endregion

	//#region CRUD
	async createEventAction(ea, alarmId, alarmHost) {
		if (ea) {
			let insActionSQL = `INSERT INTO eventAction
										(ruleId, \`type\`, config, deleted, host)
										VALUES(?, ?, ?, 0, ?);`
			let insActionQuery = await this.db.query(insActionSQL, [alarmId, ea.type, JSON.stringify(ea.config), alarmHost])
		}
	}
	/**
	  * Create Alarm
	  */
	async createEventRule(a) {
		if (a) {
			let insertSQL = `INSERT INTO eventRule
							(uuid, name, dataSource, \`condition\`, cloudFunction, ttl, config, deviceTypeId, registryId, deviceId, deleted, host)
							 VALUES(?,?,?,?,?,?,?,?,?,?,0,?);`
			let uuid = uuidv4()
			let insertFormat = await this.db.format(insertSQL, [uuid, a.name, a.dataSource, JSON.stringify(a.condition), a.cloudFunction, a.ttl, JSON.stringify(a.config), a.deviceTypeId, a.registryId, a.deviceId, a.host])
			console.log(insertFormat)
			let insertQuery = await this.db.query(insertSQL, [uuid, a.name, a.dataSource, JSON.stringify(a.condition), a.cloudFunction, a.ttl, JSON.stringify(a.config), a.deviceTypeId, a.registryId, a.deviceId, a.host])
			console.log(insertQuery)
			if (insertQuery[0].insertId) {
				let fAlarm = await this.getEventRuleById(insertQuery[0].insertId)
				if (fAlarm) {
					/**
					 * Create EventActions
					 */
					let actions = a.actions
					await actions.forEach(async ea => await this.createEventAction(ea, fAlarm.id, a.host))
					/**
					 * Create User connection
					 */
					let insSQL = `INSERT INTO eventUser
						(userUUID, eventUUID)
						VALUES(?, ?);`
					let insQuery = await this.db.query(insSQL, [a.userUUID, fAlarm.uuid])
					if (insQuery) {
						console.log(fAlarm)
						return fAlarm

					}
					else {
						return null
					}

				}
				else {
					return null
				}
			}
			else {
				return null
			}
		}
		return null
	}
	/**
	 * Get All Alarms
	 */
	async getAllEventRules(userUUID) {
		if (userUUID) {
			let selectSQL = `SELECT * from eventRule er
							INNER JOIN eventUser eu on eu.eventUUID = er.uuid
							where eu.userUUID = ? and er.deleted=0`
			let selectQuery = await this.db.query(selectSQL, [userUUID])
			if (selectQuery[0].length > 0) {
				let fAlarms = selectQuery[0].map(i => new EventRule(i))
				return fAlarms
			}
			return []
		}
		return null
	}
	/**
	 * Get Alarm by id
	 */
	async getEventRuleById(id) {
		if (id) {
			let selectSQL = `SELECT * from eventRule where id=? and deleted=0`
			let selectQuery = await this.db.query(selectSQL, [id])
			if (selectQuery[0][0]) {
				return new EventRule(selectQuery[0][0])
			}
			return null
		}
		return null
	}
	/**
	 * Get Alarms by uuid
	 */
	async getEventRulesByUUID(uuid) {
		if (uuid) {
			let selectSQL = `SELECT eR.*
							from eventRule eR
							INNER JOIN eventUser eU on eU.eventUUID = eR.uuid
							where eU.userUUID=? and eR.deleted=0`
			let selectQuery = await this.db.query(selectSQL, [uuid])
			if (selectQuery[0].length > 0) {
				return selectQuery[0].map(er => new EventRule(er))
			}
			return null
		}
		return null
	}
	/**
	 * Get Alarm by uuid
	 */
	async getEventRuleByUUID(uuid) {
		if (uuid) {
			let getEvents = async () => {
				let selectSQL = `SELECT e.*, ddc.data from event e
								inner join eventRule eR on eR.id = e.ruleId
								inner join eventData ed on ed.eventId = e.id
								inner join deviceDataClean ddc on ddc.id  = ed.dataId
								where eR.uuid = ?`
				let selectQuery = await this.db.query(selectSQL, [uuid])
				return selectQuery[0]
			}
			let getActions = async () => {
				let selectSQL = `SELECT eA.* from eventAction eA
									INNER JOIN eventRule eR on eR.id = eA.ruleId
									where eR.uuid = ?`
				let selectQuery = await this.db.query(selectSQL, [uuid])
				return selectQuery[0]
			}
			let selectSQL = `SELECT eR.*,
							JSON_OBJECT('id', eR.cloudFunction, 'code', cf.js) as cloudFunction
							from eventRule eR
							INNER JOIN eventUser eU on eU.eventUUID = eR.uuid
							LEFT JOIN cloudFunction cf on cf.id = eR.cloudFunction
							where eR.uuid=? and eR.deleted=0`
			let selectQuery = await this.db.query(selectSQL, [uuid])
			if (selectQuery[0][0]) {
				let actions = await getActions()
				let events = await getEvents()
				let alarm = {
					...selectQuery[0][0],
					actions: actions,
					count: events.reduce((total, current, i) => {
						return total = current.count + total
					}, 0),
					events: events
				}
				return new EventRule(alarm)
			}
			return null
		}
		return null
	}
	/**
	 * Edit Alarm
	 */
	async editEventRule(a) {
		if (a.uuid) {
			let updateSQL = `UPDATE eventRule
							 SET
								    name=?,
								    dataSource=?,
								    condition=?,
								    cloudFunction=?,
								    ttl=?,
								    config=?,
								    deviceId=?,
								    deleted=0,
								    host=?
							 WHERE  uuid=?;`
			let updateQuery = await this.db.query(updateSQL, [a.name, a.dataSource, a.condition, a.cloudFunction, a.ttl, a.config, a.deviceId, a.host, a.uuid])
			if (updateQuery[0].affectedRows === 1) {
				let fAlarm = await this.getEventRuleByUUID(i.uuid)
				console.log(fAlarm)
				return fAlarm
			}
			return null
		}
		return null
	}

	async deleteEventRule(uuid) {
		if (uuid) {
			let deleteSQL = `UPDATE eventRule
							 SET
								 deleted=1
							 WHERE uuid=?;`
			let deleteQuery = await this.db.query(deleteSQL, [uuid])
			if (deleteQuery[0].affectedRows === 1) {
				return true
			}
			else {
				return false
			}
		}
		return false
	}


	/**
	 * Get user notifications
	 */
	async getNotificationsByUserUUID(userUUID, from = '1999-01-01 00:00:00', to = null) {
		if (to === null) {
			to = moment.now()
		}
		if (userUUID) {
			let selectSQL = `SELECT en.id, en.uuid,
									en.state as notificationState, en.dataTime,
									en.message, e.state as eventState,
									er.name as ruleName, d.uuname as deviceUUNAME,
									d.name as deviceName
								FROM eventNotification en
									INNER JOIN event e ON en.eventId = e.id
									INNER JOIN eventRule er ON e.ruleId = er.id
									INNER JOIN device d ON e.deviceId = d.id
								WHERE en.userUUID = ?
									AND en.dataTime > ?
									AND en.dataTime <= ?
								ORDER BY en.dataTime DESC`
			console.log(await this.db.format(selectSQL, [userUUID, from, to]))
			let selectQuery = await this.db.query(selectSQL, [userUUID, from, to])
			if (selectQuery[0].length > 0) {
				let fNotifications = selectQuery[0].map(i => new EventNotifikation(i))
				return fNotifications
			}
			return []
		}
		return null
	}
	//#endregion
}
module.exports = eventService