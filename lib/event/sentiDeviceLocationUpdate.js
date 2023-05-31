const createAPI = require('apisauce').create

class sentiDeviceLocationUpdate {
	db = null
	constructor(db = null) {
		this.db = db
	}
	async execute(data, eventRule, eventAction) {
		try {
			// https://api.dataforsyningen.dk/adgangsadresser/reverse?x=9.867381&y=57.0453223&struktur=mini

			const api = createAPI({
				baseURL: 'https://api.dataforsyningen.dk',
			})
			let rs = await api.get('/adgangsadresser/reverse', {
				x: data.message.lon,
				y: data.message.lat,
				struktur: 'mini'
			})
			console.log(rs.ok, rs.status, rs.data)
			// const api = createAPI({
			// 	baseURL: eventAction.config.baseURL,
			// 	headers: eventAction.config.headers
			// })
			// let rs = await api.post(eventAction.config.url, data, eventAction.config.extconfig)
			// // console.log(rs.ok, rs.status)
			// if (!rs.ok) {
			// 	console.log(eventAction.config.url, data, eventAction.config.extconfig)
			// }
		} catch (e) {
			console.log(e, eventAction)
		}
	}
}
module.exports = sentiDeviceLocationUpdate