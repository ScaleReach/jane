/**
 * manages and issue session
 * 
 * redis-store
 */
const redis = require("redis")
const session = require("express-session")
const crypto = require("node:crypto")

const SessionStore = new Map()

class SessionData {
	static skeleton() {
		return {
			"callerName": "",
			"chatHistory": [],
			"awaitingInput": false,
			"awaitingInputId": 0,

			"knowledgeBankQueries": 0,

			"userId": null,
			"accounts": null
		}
	}
}

class SessionClient {
	constructor() {
		let id = crypto.randomBytes(64).toString("hex")
		while (SessionStore.has(id)) {
			id = crypto.randomBytes(64).toString("hex")
		}

		this._id = id
		this.data = SessionData.skeleton()
		this._expiresAt = +new Date() +7.2e+6 // 2 hours expiry from call creation

		SessionStore.set(this._id, this)
	}

	get_id() {
		return this._id
	}

	update() {
		this._expiresAt = +new Date() +7.2e+6 // 2 hours expiry from call creation
		SessionStore.set(this._id, this)
	}
}

module.exports = {
	SessionClient, SessionStore
}