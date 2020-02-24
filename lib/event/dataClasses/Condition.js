const sentiData = require('senti-apicore').sentiData

class Condition extends sentiData {
	metric = null
	operation = null
	qualifier = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Condition