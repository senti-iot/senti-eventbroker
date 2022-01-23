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
    shouldExecute = false

    static states = {
        void: 0,
        active: 1,
        acknowledged: 2,
        closed: 10
    }

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Event