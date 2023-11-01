const mqtt = require('mqtt')
const EventActionV2 = require('./dataClasses/EventActionV2')

class sentiMqttPublish {
	db = null
	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		try {
			let topic = eventAction.config.topic.replace('{deviceId}', data.device[eventAction.config.deviceId])
			let myMqtt = mqtt.connect(eventAction.config.mqtthost, {
				clientId: 'SentiEvent_' + Math.random().toString(16).substr(2, 8),
				username: eventAction.config.mqttuser,
				password: eventAction.config.mqttpass
			});
			myMqtt.on('connect', () => {
				myMqtt.publish(topic, JSON.stringify(data.message))
				myMqtt.end()
			})

		} catch (e) {
			console.log(e, eventAction)
		}
	}

	async getActionByDeviceId(deviceId) {
		console.log('getActionByDeviceId', deviceId)
		let sql = `SELECT ea.id, ea.uuid, ea.ruleUUID, ea.type, ea.config, ea.state, ea.deleted, ea.host
					FROM eventRule er
					INNER JOIN eventAction ea ON er.uuid = ea.ruleUUID
					WHERE er.deviceUUID = ?
					AND ea.type = 16
					AND ea.deleted = 0`
		let rs = await this.db.query(sql, [deviceId])
		console.log(rs)
		if (rs[0].length === 1) {
			return new EventActionV2(rs[0][0])
		} else {
			return false
		}
	}
}
module.exports = sentiMqttPublish
