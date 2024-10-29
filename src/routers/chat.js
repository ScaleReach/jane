const baseURL = "/chat"

const express = require("express")
const path = require("path")
const config = require(path.join(__dirname, "../config"))
const chatService = require(path.join(__dirname, "../includes/chat"))
const sessionService = require(path.join(__dirname, "../includes/session"))

// router object
const router = express.Router()

router.get("/new", (req, res) => {
	let session = new sessionService.SessionClient()

	return res.json({
		"key": session.get_id()
	})
})

const verifiedActors = (req, res, next) => {
	let headers = req.headers
	console.log(headers)
	if (headers[config.headerAuthKey]) {
		// fetch object
		let id = headers[config.headerAuthKey]
		req.session = sessionService.SessionStore.get(id)

		if (req.session == null) {
			// revoke authentication
			return res.status(400).end()
		}

		console.log("VALIDATED")
		next() // validated
	}

	return res.status(400).end()
}

router.post("/", verifiedActors, async (req, res) => {
	let prompt = req.body
	console.log(prompt, typeof prompt)
	if (typeof prompt != "string" || prompt.length >= 1000) {
		// not a string, or exceeds 1000 characters
		return res.status(400).end()
	}

	let chatHistory = req.session.data.chatHistory
	console.log("rchatHistory", req.session.data.chatHistory)
	let response = await chatService.chat(chatHistory)

	// build new entry in chathistory
	if (response.content) {
		req.session.data.chatHistory.push([1, response.content])
		console.log("chatHistory", req.session.data.chatHistory)
		req.session.update()
	}

	return res.json({"message": response.content})
})

module.exports = { // export router object and authenticated middleware
	baseURL, router
}