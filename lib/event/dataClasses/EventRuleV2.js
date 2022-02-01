const sentiData = require('senti-apicore').sentiData
const Condition = require('./Condition')

class EventRuleV2 extends sentiData {
	id = null
	uuid = null
	name = null
	condition = null
	cloudFunction = null
	config = null
	deviceTypeUUID = null
	registryUUID = null
	deviceUUID = null
	host = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
		if (this.condition !== null) {
			this.condition = new Condition(this.condition)
		}
	}
}
module.exports = EventRuleV2