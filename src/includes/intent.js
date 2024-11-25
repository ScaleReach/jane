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
		},
		credentials: "include"
	})
	console.log("establishResp", establishResp.status)
	if (establishResp.status !== 200) {
		// failed to establish privileged actor
		return
	}

	// get cookie (holds session of privileged actor)
	const setCookieHeader = establishResp.headers.get("set-cookie")
	if (!setCookieHeader) {
		// will not be able to authenticate POST /intent/new creation of new intent
		console.log("cookies missing in establish connection", establishResp.headers)
		return
	}

	// build request body
	let formData = new FormData()
	formData.set("userid", userId)
	formData.set("type", intentType)
	formData.set("description", intentDescription)
	console.log(userId, intentType, intentDescription)
	console.log("formData", formData)

	let fileResp = await fetch(`${config.intentService.url}/intent/new`, {
		method: "POST",
		headers: {
			[config.intentService.authKeyHeaderField]: process.env.INTENT_SERVICE_SECRET_KEY,
			"Cookie": setCookieHeader
		},
		body: formData
	})
	console.log("fileResp", fileResp.status)
	if (fileResp.status !== 200) {
		// failed to file
		return
	}

	return (await fileResp.json()).id
}

module.exports = {
	fileIntent
}