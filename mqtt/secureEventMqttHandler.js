const secureMqttHandler = require('senti-apicore').secureMqttHandler
const eventService = require('../lib/event/eventService')
const eventServiceV2 = require('../lib/event/eventServiceV2')

class secureEventMqttHandler extends secureMqttHandler {
	eventService = null

	init() {
		this.eventService = new eventService()
		this.eventServiceV2 = new eventServiceV2()
		this.topics = ['v1/event/#', 'v2/event/#']
		this.mqttClient.on('message', (topic, message) => {
			let topics = topic.split('/')
			try {
				let data = JSON.parse(message.toString())
				switch (topics[0]) {
					case 'v1':
						// this.v1Message(topics, data)
						break;
					case 'v2':
						this.v2Message(topics, data)
						break;
				}
			}
			catch(error) {
				console.log('event json parse error', error, message.toString())
			}
		})
	}
	v1Message(topics, message) {
		switch (topics[2]) {
			case 'data':
				this.eventService.findRulesAndExecute(message, parseInt(topics[3]), parseInt(topics[4]), parseInt(topics[5]))
				break;
		}
	}
	v2Message(topics, message) {
		switch (topics[2]) {
			case 'data':
				// console.log(message)
				this.eventServiceV2.findRulesAndExecute(message, topics[3], topics[4], topics[5])
				break;
		}
	}
}
module.exports = secureEventMqttHandler