const sentiData = require('senti-apicore').sentiData

class Event extends sentiData {
	id = null
    uuid = null
	ruleUUID = null
    deviceUUID = null
    count = null
    state = null
    created = null
    modified = null
    lastAction = null
    nextAction = null
    expires = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Event