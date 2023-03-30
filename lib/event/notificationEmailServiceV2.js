
const engineAPI = require('../../api/engine/engine')
const sentiMail = require('senti-apicore').sentiSmtpMail

const sentiDeviceService = require('../device/sentiDeviceService')

class notificationEmailServiceV2 {
	db = null
	subject = null
	mailBody = null

	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		try {
			this.subject = eventAction.config.message.subject
			this.mailBody = eventAction.config.message.body

			let process = await this.processEvent(data, eventRule, eventAction);
			if (process) {
				this.sendNotification(eventAction);
			}
		} catch (e) {
			console.log(e, data, eventRule, eventAction)
		}
	}

	async processEvent(data, eventRule, eventAction) {
		if (Number.isInteger(parseInt(eventAction.config.processFunction))) {
			let _data = {
				data: data,
				rule: eventRule,
				action: eventAction
			}
			try {
				let rs = await engineAPI.post('/', { nIds: [eventAction.config.processFunction], data: { ..._data } })
				if (!rs.ok) {
					console.log("cf error", eventAction.config)
					return false
				}
				this.subject = rs.data.subject
				this.mailBody = rs.data.message
				this.processStatic(data, eventRule)
				return true
			} catch (e) {
				console.log(e, data, eventRule, eventAction)
				return false
			}
		} else {
			this.processCondition(data, eventRule)
			this.processStatic(data, eventRule)
			return true
		}
	}

	processCondition(data, eventRule) {
		Object.entries(eventRule.condition).map(([key, value]) => {
			if (this.subject !== null) {
				this.subject = this.subject.replaceAll(`@${key.toUpperCase()}@`, value)
				this.subject = this.subject.replaceAll(`@DATA_${key.toUpperCase()}@`, data.message[value])
			}
			if (this.mailBody !== null) {
				this.mailBody = this.mailBody.replaceAll(`@${key.toUpperCase()}@`, value)
				this.mailBody = this.mailBody.replaceAll(`@DATA_${key.toUpperCase()}@`, data.message[value])
			}
		})
	}
	async processStatic(data, eventRule) {
		if (this.subject !== null) {
			this.subject = this.subject.replaceAll(`@EVENT_ID@`, eventRule.id + '-' + eventRule.eventId)
			this.subject = this.subject.replaceAll(`@DEVICE_NAME@`, data.device.name)
		}
		if (this.mailBody !== null) {
			this.mailBody = this.mailBody.replaceAll(`@EVENT_ID@`, eventRule.id + '-' + eventRule.eventId)
			this.mailBody = this.mailBody.replaceAll(`@DEVICE_NAME@`, data.device.name)
			Object.entries(data.message).map(([key, value]) => {
				this.mailBody = this.mailBody.replaceAll(`@DATA_${key.toUpperCase()}@`, value)
			})
			this.mailBody = this.mailBody.replaceAll('\n', '<br>')
		}
	}
	async sendNotification(eventAction) {
		const mailService = new sentiMail(this.db, eventAction.host)
		let s = await mailService.smtpConnect()
		eventAction.config.recipients?.map(async recipient => {
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
module.exports = notificationEmailServiceV2