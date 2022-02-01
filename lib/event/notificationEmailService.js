
const sentiMail = require('senti-apicore').sentiSmtpMail

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
		this.processStatic(data, eventRule)
		this.sendNotification(eventAction)
	}
	processCondition(data, eventRule) {
		Object.entries(eventRule.condition).map(([key, value]) => {
			if (this.subject !== null) {
				this.subject = this.subject.replaceAll(`@${key.toUpperCase()}@`, value)
				this.subject = this.subject.replaceAll(`@DATA_${key.toUpperCase()}@`, data[value])
			}
			if (this.mailBody !== null) {
				this.mailBody = this.mailBody.replaceAll(`@${key.toUpperCase()}@`, value)
				this.mailBody = this.mailBody.replaceAll(`@DATA_${key.toUpperCase()}@`, data[value])
			}
		})
	}
	async processStatic(data, eventRule) {
		if (this.subject !== null) {
			this.subject = this.subject.replaceAll(`@EVENT_ID@`, eventRule.id + '-' + eventRule.eventId)
			this.subject = this.subject.replaceAll(`@DEVICE_NAME@`, data.sentiEventDeviceName)
		}
		if (this.mailBody !== null) {
			this.mailBody = this.mailBody.replaceAll(`@EVENT_ID@`, eventRule.id + '-' + eventRule.eventId)
			this.mailBody = this.mailBody.replaceAll(`@DEVICE_NAME@`, data.sentiEventDeviceName)
			Object.entries(data).map(([key, value]) => {
				this.mailBody = this.mailBody.replaceAll(`@DATA_${key.toUpperCase()}@`, value)
			})
			this.mailBody = this.mailBody.replaceAll('\n', '<br>')
		}
	}
	async sendNotification(eventAction) {
		const mailService = new sentiMail(this.db, eventAction.host)
		let s = await mailService.smtpConnect()
		eventAction.config.recipients.map(async recipient => {
			let msg = await mailService.getMailMessageFromTemplateType(5, { "@NAME@": recipient.name, "@MESSAGE@": this.mailBody }, eventAction.host)
			if (this.subject !== null) {
				msg.subject = this.subject
			}
			msg.text = this.mailBody
			msg.to = `${recipient.name} <${recipient.email}>`
			mailService.send(msg)
		})
	}
}
module.exports = notificationEmailService