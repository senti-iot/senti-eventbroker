#!/usr/bin/env nodejs
// eslint-disable-next-line no-unused-vars
const dotenv = require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const app = express()
const webpush = require('web-push');

//eslint-disable-next-line
webpush.setVapidDetails('mailto:at@webhouse.dk', process.env.PUBLIC_VAPID_KEY, process.env.PRIVATE_VAPID_KEY)
// API endpoint imports

// eslint-disable-next-line no-undef
const port = process.env.NODE_PORT || 3007

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())

app.post('/subscribe', (req, res) => {
	const subscription = req.body;
	res.status(201).json({});
	const payload = JSON.stringify({ title: 'test' });

	console.log(subscription);

	webpush.sendNotification(subscription, payload).catch(error => {
		console.error(error.stack);
	});
});

//---Start the express server---------------------------------------------------

const startServer = () => {
	app.listen(port, () => {
		console.log('Senti Service started on port', port)
	}).on('error', (err) => {
		if (err.errno === 'EADDRINUSE') {
			console.log('Service not started, port ' + port + ' is busy')
		} else {
			console.log(err)
		}
	})
}

startServer()
