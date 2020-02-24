const sentiData = require('senti-apicore').sentiData

class EventAction extends sentiData {
	id = null
	ruleId = null
	type = null
	config = null
	deleted = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = EventAction