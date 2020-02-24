const secureMqttHandler = require('senti-apicore').secureMqttHandler
const eventService = require('../lib/event/eventService')

class secureEventMqttHandler extends secureMqttHandler {
	eventService = null

	init() {
		this.eventService = new eventService()
		this.topics = ['v1/event/#']
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			let data = JSON.parse(message.toString())
			switch (arr[2]) {
				case 'data':
					this.eventService.findRulesAndExecute(data, arr[3], arr[4], arr[5])
					break;
			}
		})
	}


}
module.exports = secureEventMqttHandler