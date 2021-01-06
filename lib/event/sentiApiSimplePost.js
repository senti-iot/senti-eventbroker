const createAPI = require('apisauce').create

class sentiApiSimplePost {
	db = null
	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		try {
			const api = createAPI({
				baseURL: eventAction.config.baseURL,
				headers: eventAction.config.headers
			})
			let rs = await api.post(eventAction.config.url, data, eventAction.config.extconfig)
			console.log(rs.ok, rs.status)
		} catch (e) {
			console.log(e, eventAction)
		}
	}
}
module.exports = sentiApiSimplePost