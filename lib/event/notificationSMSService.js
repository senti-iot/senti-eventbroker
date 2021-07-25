const createAPI = require('apisauce').create
const { smsGatewayUnitel } = require('../smsGateways')

class notificationSMSService {
	db = null
	message = null

	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		this.message = eventAction.config.message.body

		this.processCondition(data, eventRule)
		this.processStatic(data, eventRule)
		this.sendNotification(eventAction)
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
		}
	}
	async sendNotification(eventAction) {
		let smsGateway = null
		switch (eventAction.config.gateway) {
			case 'uni-tel':
				smsGateway = new smsGatewayUnitel(this.db, eventAction.host)
				break;
		}
		await smsGateway.connect()
		eventAction.config.recipients.map(async recipient => {
			smsGateway.send(recipient.address, this.message)
		})
	}
}
module.exports = notificationSMSService