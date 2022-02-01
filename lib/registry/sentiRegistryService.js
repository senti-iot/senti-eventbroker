const DbRegistry = require('./dataClasses/DbRegistry')
const Registry = require('./dataClasses/Registry')
const uuidv4 = require('uuid/v4')

var mysqlConn = require('../../mysql/mysql_handler')

class sentiRegistryService {
	db = null
	lease = null

	constructor(lease = false) {
		this.db = mysqlConn
		this.lease = lease
	}
	//#region GET
	async getRegistriesByUUID(uuids = false) {
		console.log('uuids', uuids)
		if (uuids === false) {
			return false
		}
		let clause = (uuids.length > 0) ? ' AND r.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT r.id, r.uuid, r.name, r.uuname, r.region, r.protocol, r.ca_certificate, r.orgId, r.created, r.description, r.deleted, r.config, o.uuid as orgUUID, o.name as orgName
			FROM registry r
			INNER JOIN organisation o on o.id = r.orgId
		WHERE r.deleted = 0 ${clause};`
		console.log(select)

		let rs = await this.db.query(select, uuids)

		// console.log(rs[0])
		if (rs[0].length === 0) {
			return false
		}
		let result = []
		rs[0].forEach(async rsDev => {
			let fReg = Object.assign({}, rsDev, { org: { uuid: rsDev.orgUUID, name: rsDev.orgName } })
			delete fReg.orgUUID
			delete fReg.orgName
			let registry = new Registry(fReg)
			// registry = Object.assign({}, registry, { org: { uuid: registry.orgUUID, name: registry.orgName } })
			result.push(registry)
		})
		console.log('result', result)
		return result
	}
	//#endregion
	/**
	 * @TODO Refactor / Remove this function
	 */
	async getOrganisationById(id) {
		let select = `SELECT o.name, o.uuid, o.aux, o.uuname from organisation o where o.id = ?`
		console.log(id)
		let rs = await this.db.query(select, [id])

		// console.log('Organisation', rs)
		if (rs[0].length !== 1) {
			return false
		}
		/**
		 * @TODO Needs some classes from Senti Core
		 */
		return rs[0][0]
	}
	async getRegistryByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getRegistryById(id, deleted)
	}
	async getRegistryById(id, deleted = 0) {
		let select = `SELECT r.id, r.uuid, r.name, r.uuname, r.region, r.protocol, r.ca_certificate, r.orgId, r.created, r.description, r.deleted, r.config
				FROM registry r
				WHERE r.id = ? AND r.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		let registry = new Registry(rs[0][0])
		registry.org = await this.getOrganisationById(registry.orgId)
		return registry
	}
	async getDbRegistryById(id, deleted = 0) {
		let select = `SELECT r.id, r.uuid, r.name, r.uuname, r.region, r.protocol, r.ca_certificate, r.orgId, r.customer_id, r.created, r.description, r.deleted, r.config
				FROM registry r
				WHERE r.id = ? AND r.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbRegistry(rs[0][0])
	}
	async getDbRegistryByUUID(uuid, deleted = 0) {
		let select = `SELECT r.id, r.uuid, r.name, r.uuname, r.region, r.protocol, r.ca_certificate, r.orgId, r.customer_id, r.created,
					    r.description, r.deleted, r.config
				FROM registry r
				WHERE r.uuid = ? AND r.deleted = ?;`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbRegistry(rs[0][0])
	}
	async getRegistryDevices(registry = false) {
		if (registry === false) {
			return false
		}
		let dbReg = new DbRegistry(registry)
		let findDevices = `SELECT d.uuid, d.name, d.reg_id from device d
			INNER JOIN registry r on r.id = d.reg_id
			WHERE r.uuid = ? and d.deleted = 0
		`
		let rs = await this.db.query(findDevices, [dbReg.uuid])
		return rs[0][0]
	}

	async getIdByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM registry r WHERE r.uuid = ? AND r.deleted = ?`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].id
	}
	shortHashGen(source) {
		var i = 0, j = 0, bitshift = 0, mask = 0x3f, mask0 = 0
		var block = []
		//              0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
		var dictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$"
		var result = ""
		let binsrc = []
		while (source.length >= 2) {
			binsrc.push(parseInt(source.substring(0, 2), 16))
			source = source.substring(2, source.length)
		}
		// init block of 8 bytes plus one guard byte
		for (i = 0; i < 9; i++) {
			block[i] = 0
		}
		// fold input
		for (i = 0; i < binsrc.length; i++) {
			block[i % 8] = block[i % 8] ^ binsrc[i]
		}
		i = 0
		while (i < 64) {
			j = i >> 3 // byte index
			bitshift = i % 8 // bit index
			mask0 = mask << bitshift
			result = result + dictionary[(block[j] & mask0 & 0xff | block[j + 1] << 8 & mask0 & 0xff00) >> bitshift]
			i += 6
		}
		return result
	}
}
module.exports = sentiRegistryService