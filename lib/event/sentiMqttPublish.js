const mqtt = require('mqtt')


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
}
module.exports = sentiMqttPublish