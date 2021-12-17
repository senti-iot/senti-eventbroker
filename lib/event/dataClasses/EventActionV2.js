const sentiData = require('senti-apicore').sentiData

class EventActionV2 extends sentiData {
	id = null
	uuid = null
	ruleUUID = null
	type = null
	config = null
	conditionState = null
	deleted = null
	host = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = EventActionV2