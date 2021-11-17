const createAPI = require('apisauce').create

class smsGatewayUnitel {
	db = null
	wlHost = null
	api = null
	username = null
	password = null
	from = null

	constructor(db = null, wlHost = null) {
		this.db = db
		this.wlHost = wlHost
	}
	async connect() {
		this.api = createAPI({
            baseURL: 'https://www.uni-tel.dk',
            headers: { 
                'Accept': 'application/json', 
                'Content-Type': 'application/json'
            }
		})
		let select = `SELECT id, uuid, config->'$.username' as username, config->'$.password' as password, config->'$.from' as fromaddress FROM smsGatewaySetting WHERE type = 1 AND deleted = 0 AND host = ?`
		// let sql = await this.db.format(select, [this.wlHost])
		// console.log(sql)
		let rs = await this.db.query(select, [this.wlHost])
		if (rs[0].length !== 1) {
			return false
		}
		this.username = rs[0][0].username
		this.password = rs[0][0].password
		this.from = rs[0][0].fromaddress
	}
	async send(to, message) {
		let msgStatus = await this.api.get('/selvbetjening/sms/sms.php', {
			username: this.username,
			password: this.password,
			content: message,
			from: this.from,
			to: to
		}).then(rs => {
			return { to: to, ok: rs.ok, status: rs.status, data: rs.data}
		}).catch(err => {
			console.log(err)
		})
		// console.log(msgStatus)
		return msgStatus
	}
}
module.exports = smsGatewayUnitel