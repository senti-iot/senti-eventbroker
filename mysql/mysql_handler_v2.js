#!/usr/bin/env nodejs
const mysql = require('mysql2');

const { V2_DB_HOST, V2_DB_USER, V2_DATABASE, V2_PASSWORD } = process.env

let connection = mysql.createPool({
	host: V2_DB_HOST,
	user: V2_DB_USER,
	password: V2_PASSWORD,
	database: V2_DATABASE,
	multipleStatements: true,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
})
connection = connection.promise()

module.exports = connection