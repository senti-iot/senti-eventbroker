const sentiSubscriptionEvent = require('./sentiSubscriptionEvent')
const sentiSubscriptionService = require('./sentiSubscriptionsService')
const subscriptionService = new sentiSubscriptionService()

const CronJob = require('cron').CronJob

class sentiSubscriptionCron {
    constructor() {
        this.subscriptions = []
    }
    async init() {
        let subscriptions = await subscriptionService.getSubscriptions()
        subscriptions.forEach(subscription => {
            this.add(subscription.id, subscription.cronTime ,subscription.uuid)
            this.start(subscription.id)
			this.status(subscription.id)
        })
		// console.log(`Initialized ${subscriptions.length} subscriptions`, this.subscriptions)
        return subscriptions
    }
    async reload() {
        Object.keys(this.subscriptions).forEach(key => {
            this.subscriptions[key].stop()
        })
        this.subscriptions = []
        return await this.init()
    }
    add(id, cronTime, uuid) {
        this.subscriptions['id'+id] = new CronJob(cronTime, function() {
            let mySentiSubscription = new sentiSubscriptionEvent()
            mySentiSubscription.init(id, uuid, console.log)
            mySentiSubscription.execute()
        })
    }
    start(id) {
        if(typeof this.subscriptions['id'+id] !== 'undefined') {
            this.subscriptions['id'+id].start()
            return this.subscriptions['id'+id].running
        }
        return false
    }
    stop(id) {
        if(typeof this.subscriptions['id'+id] !== 'undefined') {
            this.subscriptions['id'+id].stop()
            return !this.subscriptions['id'+id].running
        }
        return false
    }
    status(id) {
        if(typeof this.subscriptions['id'+id] !== 'undefined') {
            let result = {
                "running": this.subscriptions['id'+id].running ? this.subscriptions['id'+id].running : false,
                "next": this.subscriptions['id'+id].nextDates(),
                "last": this.subscriptions['id'+id].lastDate(),
            }
            return result
        }
        return false
    }
    run(subscription) {
		console.log(`Manually running subscription ID: ${subscription.id}, UUID: ${subscription.uuid}`, subscription)
        // let mySentiSubscription = new sentiSubscriptionEvent()
        // mySentiSubscription.init(subscription.id, subscription.uuid, console.log)
        // mySentiSubscription.execute()
        return subscription
    }
}

module.exports = sentiSubscriptionCron
