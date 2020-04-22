
const sentiMail = require('senti-apicore').sentiMail

const sentiDeviceService = require('../device/sentiDeviceService')

class notificationEmailService {
	db = null
	subject = null
	mailBody = null

	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		this.subject = eventAction.config.message.subject
		this.mailBody = eventAction.config.message.body

		this.processCondition(data, eventRule)
		await this.processDevice(eventRule)
		this.sendNotificartion(eventAction)
	}
	processCondition(data, eventRule) {
		Object.entries(eventRule.condition).map(([key, value]) => {
			if (this.subject !== null) {
				this.subject = this.subject.replace(`@${key.toUpperCase()}@`, value)
				this.subject = this.subject.replace(`@DATA_${key.toUpperCase()}@`, data[value])
			}
			if (this.mailBody !== null) {
				this.mailBody = this.mailBody.replace(`@${key.toUpperCase()}@`, value)
				this.mailBody = this.mailBody.replace(`@DATA_${key.toUpperCase()}@`, data[value])
			}
		})
	}
	async processDevice(eventRule) {
		const deviceService = new sentiDeviceService(this.db)
		let device = await deviceService.getDeviceById(eventRule.deviceId)
		Object.entries(device).map(([key, value]) => {
			if (this.subject !== null) {
				this.subject = this.subject.replace(`@DEVICE_${key.toUpperCase()}@`, value)
			}
			if (this.mailBody !== null) {
				this.mailBody = this.mailBody.replace(`@DEVICE_${key.toUpperCase()}@`, value)
			}
		})
	}
	async sendNotificartion(eventAction) {
		const mailService = new sentiMail(process.env.SENDGRID_API_KEY, this.db)

		eventAction.config.recipients.map(async recipient => {
			let msg = await mailService.getMailMessageFromTemplateType(5, { "@NAME@": recipient.name, "@MESSAGE@": this.mailBody }, eventAction.host) // JSON.stringify(this.mailBody)
			if (this.subject !== null) {
				msg.subject = this.subject
			}
			msg.to = recipient
			mailService.send(msg)
		})
	}
}
module.exports = notificationEmailService