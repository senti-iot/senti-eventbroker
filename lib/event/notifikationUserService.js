const uuidv4 = require('uuid/v4')
const createAPI = require('apisauce').create

class notificationUserService {
	db = null
	subject = null
	message = null

	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		try {
			this.message = eventAction.config.message.body

			this.processCondition(data, eventRule)
			this.processStatic(data, eventRule)
			let userUUID = false
			if (eventAction.config.userType === "local") {
				userUUID = eventAction.config.local.userUUID
			} else {
				userUUID = await this.getExternalUser(data, eventRule, eventAction)
			}
			if (userUUID !== false) {
				this.saveNotification(userUUID, data.sentiEventDevice.uuid, eventRule.eventId, data.sentiEventDeviceDataCleanTime, data.sentiEventDeviceDataCleanId)
			}

		} catch (e) {
			console.log(e, data, eventRule, eventAction)
		}
	}

	processCondition(data, eventRule) {
		Object.entries(eventRule.condition).map(([key, value]) => {
			if (this.message !== null) {
				this.message = this.message.replace(`@${key.toUpperCase()}@`, value)
				this.message = this.message.replace(`@DATA_${key.toUpperCase()}@`, data[value])
			}
		})
	}
	async processStatic(data, eventRule) {
		if (this.message !== null) {
			this.message = this.message.replace(`@EVENT_ID@`, eventRule.id + '-' + eventRule.eventId)
			this.message = this.message.replace(`@DEVICE_NAME@`, data.sentiEventDeviceName)
			Object.entries(data).map(([key, value]) => {
				this.message = this.message.replace(`@DATA_${key.toUpperCase()}@`, value)
			})
		}
	}
	async saveNotification(userUUID, deviceUUID, eventId, dataTime, dataId) {
		let insert = `INSERT INTO eventNotification (uuid, userUUID, deviceUUID, eventId, created, dataTime, dataId, message) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`
		// console.log(await this.db.format(insert, [uuidv4(), userUUID, deviceUUID, eventId, dataTime, dataId, this.message]))
		let rsInsert = await this.db.query(insert, [uuidv4(), userUUID, deviceUUID, eventId, dataTime, dataId, this.message])
	}
	async getExternalUser(data, eventRule, eventAction) {
		try {
			const api = createAPI({
				baseURL: eventAction.config.external.baseURL,
				headers: eventAction.config.external.headers
			})
			let rs = await api.get(data.sentiEventDevice.uuid, eventAction.config.external.extconfig)
			// console.log(rs.ok, rs.status, rs.data)
			if (!rs.ok) {
				console.log(eventAction.config.external.baseURL + data.sentiEventDevice.uuid, data, eventAction.config.external.extconfig)
				return false
			}
			return rs.data.userUUID
		} catch (e) {
			console.log(e, data, eventRule, eventAction)
			return false
		}
	}
}
module.exports = notificationUserService