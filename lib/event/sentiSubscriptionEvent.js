

const mysqlConn = require('../../mysql/mysql_handler_v2')
const engineAPI = require('../../api/engine/engine')
const EventActionV2 = require('./dataClasses/EventActionV2')
const eventServiceV2 = require('./eventServiceV2')

const sentiSubscriptionService = require('./sentiSubscriptionsService')
const subscriptionService = new sentiSubscriptionService()

const sentiEventService = new eventServiceV2()

class sentiSubscriptionEvent {
	constructor() {
		this.id = null
		this.uuid = null
		this.logFunction = console.log
	}
	init(id, uuid, logFunction) {
		this.id = id
		this.uuid = uuid
		this.logFunction = logFunction
		console.log(`Initialized subscription event for ID: ${this.id}, UUID: ${this.uuid}`)
	}
	async execute() {
		let subscriptionRules = await subscriptionService.getSubscriptionRules(this.id)
		if(subscriptionRules !== false) {
			await subscriptionRules.reduce(async (promise, subscriptionRule) => {
				await promise;
				this.logFunction(`Executing rule ${subscriptionRule.cloudFunction} for subscription UUID: ${this.uuid}`)
				try {
					let testResult = await this.testCloudFunction(subscriptionRule.cloudFunction, { condition: subscriptionRule.condition, config: subscriptionRule.config })
					this.logFunction(`Test result for cloud function ${subscriptionRule.cloudFunction} for subscription UUID: ${this.uuid}: ${JSON.stringify(testResult)}`)
					if(testResult.state === true) {
						this.logFunction(`Condition met for cloud function ${subscriptionRule.cloudFunction} for subscription UUID: ${this.uuid}. Executing action. Rule: ${JSON.stringify(subscriptionRule)}`)
						let action = new EventActionV2({ type: subscriptionRule.config.actionType, config: subscriptionRule.config.actionConfig, host: subscriptionRule.config.actionHost, state: 1 })
						await sentiEventService.executeAction({  }, { condition: {} }, action)
					} else {
						this.logFunction(`Condition not met for cloud function ${subscriptionRule.cloudFunction} for subscription UUID: ${this.uuid}. No action taken.`)
					}
				} catch (err) {
					this.logFunction(`Error testing cloud function ${subscriptionRule.cloudFunction} for subscription UUID: ${this.uuid}`)
					this.logFunction(err)
				}
			}, Promise.resolve());
		} else {
			this.logFunction(`No subscription rules found for subscription UUID: ${this.uuid}`)
		}
		return false
	}

	async testCloudFunction(cloudFunction, data) {
		let decodedTest = await engineAPI.post('/', { nIds: [cloudFunction], data: { ...data } })
		let result = (typeof decodedTest.data === "boolean") ? { state: decodedTest.data } : (decodedTest.data !== null && typeof decodedTest.data === "object" && typeof decodedTest.data.state === "boolean") ? decodedTest.data : { state: null }
		return result
	}

}

module.exports = sentiSubscriptionEvent
