class eventRuleRunningService {
	constructor() {
		this.running = {}
		this.runningCount = {}
	}

	endRunning(uuid) {
		this.running[uuid] = false
		this.runningCount[uuid] -= 1
		console.log('endRunning', uuid, this.runningCount[uuid])
	}

	startRunning(uuid) {
		console.log('startRunning', uuid, this.runningCount[uuid])
		if (this.running[uuid] === undefined) {
			this.running[uuid] = false
			this.runningCount[uuid] = 0
		}
		if (this.running[uuid] === true) {
			console.log('startRunning - already running', uuid, this.runningCount[uuid])
			return false
		}
		this.running[uuid] = true
		this.runningCount[uuid] += 1
		console.log('startRunning - running', uuid, this.runningCount[uuid])
		return true
	}
}
module.exports = eventRuleRunningService