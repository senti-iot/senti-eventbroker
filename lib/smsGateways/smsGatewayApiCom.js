const createAPI = require('apisauce').create

class smsGatewayApiCom {
	db = null
	wlHost = null
	api = null
	from = null

	constructor(db = null, wlHost = null) {
		this.db = db
		this.wlHost = wlHost
	}
	async connect() {
		let select = `SELECT id, uuid, config FROM smsGatewaySetting WHERE type = 2 AND deleted = 0 AND host = ?`
		// let sql = await this.db.format(select, [this.wlHost])
		// console.log(sql)
		let rs = await this.db.query(select, [this.wlHost])
		if (rs[0].length !== 1) {
			return false
		}
        const encodedAuth = Buffer.from(`${rs[0][0].config.apiToken}:`).toString("base64");
		this.api = createAPI({
            baseURL: 'https://gatewayapi.com/rest',
            headers: { 
                'Accept': 'application/json', 
                'Content-Type': 'application/json',
                'Authorization': `Basic ${encodedAuth}`,
            }
		})
		this.from = rs[0][0].config.from
	}
	async send(to, message) {
        let payload = {
            sender: this.from,
            message: message,
            recipients: [
              { msisdn: to },
            ],
          };
		let msgStatus = await this.api.post('/mtsms', payload).then(rs => {
			return { to: to, ok: rs.ok, status: rs.status, data: rs.data}
		}).catch(err => {
			console.log(err)
		})
		// console.log(msgStatus)
		return msgStatus
	}
}
module.exports = smsGatewayApiCom