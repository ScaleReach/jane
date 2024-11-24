/**
 * handles interactions between Jane and intent service
 * 
 * requires process.env.INTENT_SERVICE_SECRET_KEY
 */
const path = require("path")
const config = require(path.join(__dirname, "../config"))

async function fileIntent(userId, intentType, intentDescription) {
	/**
	 * files a new intent with intent service
	 * 
	 * returns id of newly created intent instance if successful
	 * otherwise returns undefined
	 */
	let establishResp = await fetch(`${config.intentService.url}/auth/establish`, {
		method: "POST",
		headers: {
			[config.intentService.authKeyHeaderField]: process.env.INTENT_SERVICE_SECRET_KEY
		}
	})
	if (!establishResp.status !== 200) {
		// failed to establish privileged actor
		return
	}

	// build request body
	let formData = new FormData()
	formData.set("userid", userId)
	formData.set("type", intentType)
	formData.set("description", intentDescription)

	let fileResp = await fetch(`${config.intentService.url}/intent/new`, {
		method: "POST",
		headers: {
			[config.intentService.authKeyHeaderField]: process.env.INTENT_SERVICE_SECRET_KEY
		},
		body: formData
	})
	if (fileResp.status !== 200) {
		// failed to file
		return
	}

	return (await fileResp.json()).id
}

module.exports = {
	fileIntent
}