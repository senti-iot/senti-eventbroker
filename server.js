#!/usr/bin/env nodejs
process.title = "senti_core"
const dotenv = require('dotenv').config()
if (dotenv.error) {
	console.warn(dotenv.error)
}
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const app = express()

// AUTH CLIENT
const sentiAuthClient = require('senti-apicore').sentiAuthClient
const authClient = new sentiAuthClient(process.env.AUTHCLIENTURL, process.env.PASSWORDSALT)
module.exports.authClient = authClient
// MQTT
const secureEventMqttHandler = require('./mqtt/secureEventMqttHandler')
// EVENT CleanUp
const sentiEventService = require('./lib/event/eventService')
const CronJob = require('cron').CronJob;

// API endpoint imports
// const test = require('./api/index')
const alarms = require('./api/alarms')
const notifications = require('./api/notifications')

const port = process.env.NODE_PORT || 3024

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())

//---API---------------------------------------
// app.use([test])
app.use([alarms, notifications])

//---Start the express server---------------------------------------------------

const startServer = () => {
	app.listen(port, () => {
		console.log('Senti Core Service started on port', port)
	}).on('error', (err) => {
		if (err.errno === 'EADDRINUSE') {
			console.log('Service not started, port ' + port + ' is busy')
		} else {
			console.log(err)
		}
	})
}

startServer()

// MQTT
const secureMqttClient = new secureEventMqttHandler(process.env.MQTT_HOST, process.env.MQTT_USER, process.env.MQTT_PASS, 'eventBroker')
secureMqttClient.connect()

// Clean up events
const eventService = new sentiEventService()
const job = new CronJob('*/10 * * * * *', function() {
	const d = new Date()
	console.log(d)
	eventService.eventCleanup()

});
// job.start()