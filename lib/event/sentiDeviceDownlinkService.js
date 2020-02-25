const createAPI = require('apisauce').create
const sentiDeviceService = require('../device/sentiDeviceService')

class sentiDeviceDownlinkService {
	db = null
	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		const api = createAPI({
			baseURL: eventAction.config.baseURL,
			headers: eventAction.config.headers
		})
		let rs = await api.post(eventAction.config.url, eventAction.config.body, eventAction.config.params)
		console.log(rs.ok, rs.status)
	}
}
module.exports = sentiDeviceDownlinkService