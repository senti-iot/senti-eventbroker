const secureMqttHandler = require('senti-apicore').secureMqttHandler
const { USE_V1 } = process.env
const eventService = require('../lib/event/eventService')
const eventServiceV2 = require('../lib/event/eventServiceV2')

class secureEventMqttHandler extends secureMqttHandler {
	eventService = null

	init() {
		this.topics = []
		if (USE_V1) {
			this.eventService = new eventService()
			this.topics.push('v1/event/#')
		}
		this.eventServiceV2 = new eventServiceV2()
		this.topics.push('v2/event/#')
		this.mqttClient.on('message', (topic, message) => {
			let topics = topic.split('/')
			try {
				let data = JSON.parse(message.toString())
				switch (topics[0]) {
					case 'v1':
						if (USE_V1) {
							this.v1Message(topics, data)
						}
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
				// console.log('v2/event/data', topics[3], topics[4], topics[5])
				this.eventServiceV2.findRulesAndExecute(message, topics[3], topics[4], topics[5])
				break;
		}
	}
}
module.exports = secureEventMqttHandler
