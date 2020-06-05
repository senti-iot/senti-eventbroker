const sentiData = require('senti-apicore').sentiData
const Condition = require('./Condition')

class EventRule extends sentiData {
	id = null
	uuid = null
	name = null
	dataSource = null
	condition = null
	cloudFunction = null
	ttl = null
	config = null
	deviceTypeId = null
	registryId = null
	deviceId = null
	host = null
	eventId = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
		if (this.condition !== null) {
			this.condition = new Condition(this.condition)
		}
	}
}
module.exports = EventRule