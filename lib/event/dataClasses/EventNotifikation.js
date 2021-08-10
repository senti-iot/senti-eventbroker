const sentiData = require('senti-apicore').sentiData

class EventNotification extends sentiData {
	id = null
    uuid = null
    notificationState = null
    dataTime = null
    message = null
    eventState = null
    ruleName = null
    deviceUUNAME = null
    deviceName = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = EventNotification