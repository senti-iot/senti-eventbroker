const secureMqttHandler = require('senti-apicore').secureMqttHandler

class sentiMqttPublish {
	db = null
	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		console.log('sentiMqttPublish', data, eventRule, eventAction)
		try {
			let topic = eventAction.config.topic.replace('{deviceId}', data.device[eventAction.config.deviceId])
			let mqtt = new secureMqttHandler(eventAction.config.mqtthost, eventAction.config.mqttuser, eventAction.config.mqttpass)
			await mqtt.connect()
			await mqtt.sendMessage(topic, data.message)
			await mqtt.mqttClient.end()
		} catch (e) {
			console.log(e, eventAction)
		}
	}
}
module.exports = sentiMqttPublish