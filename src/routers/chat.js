const baseURL = "/chat"

const express = require("express")
const path = require("path")
const config = require(path.join(__dirname, "../config"))
const chatService = require(path.join(__dirname, "../includes/chat"))
const intentService = require(path.join(__dirname, "../includes/intent"))
const sessionService = require(path.join(__dirname, "../includes/session"))
const embedding = require(path.join(__dirname, "../includes/embedding"))
const sqlClient = require(path.join(__dirname, "../includes/database/sqlClient"))

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
	if (headers[config.authKeyHeaderField]) {
		// fetch object
		let id = headers[config.authKeyHeaderField]
		req.session = sessionService.SessionStore.get(id)

		if (req.session == null) {
			// revoke authentication
			return res.status(400).end()
		}

		console.log("VALIDATED")
		return next() // validated
	}

	return res.status(400).end()
}

const chatResponseHandler = async (req, res, chatResponse, depth=0) => {
	/**
	 * passed as the final stage in pipeline to handle responses
	 */
	const addReturnPayload = {} // additional return payload to be specified
	if (depth >= 2) {
		// prevent recursive loop
		// may happen if llm is forced to return type 2 on all calls
		return res.status(400).end()
	}

	if (chatResponse.type === 5) {
		// awaiting input, client to send to endpoint POST @router/supply/:inputId
		let inputId = +new Date() // act as session id

		req.session.awaitingInput = true
		req.session.awaitingInputId = inputId

		// add to return payload
		addReturnPayload.inputId = inputId
	} else if (chatResponse.type === 3) {
		// file intent with intent service
		if (!req.session.userId || !req.session.accounts) {
			// not yet authenticated
			return res.status(400).end()
		}
		if (!chatResponse.intent || chatResponse.intent.description.length === 0) {
			// chat service did not supply right params
			return res.status(400).end()
		}

		// in intent description: substitute $x$ for account numbers
		for (let i = 0; i < req.session.accounts.length; i++) {
			chatResponse.intent.description = chatResponse.intent.description.replaceAll(`$${i}$`, req.session.accounts[i].id)
		}

		// file intent
		let intentId = await intentService.fileIntent(req.session.userId, chatResponse.intent.type, chatResponse.intent.description)
		if (!intentId) {
			// failed to file intent
			console.warn("Failed to file intent with data", req.session.userId, chatResponse)
			return res.status(500).end()
		}
	} else if (chatResponse.type === 2) {
		// knowledge bank
		if (!chatResponse.query) {
			// chat service did not supply right params
			return res.status(400).end()
		}

		// embed query and submit it to knowledge base
		let queryEmbedding = embedding.embedding(chatResponse.query)
		let knowledgeRows;
		try {
			knowledgeRows = getTopThreeRelevantKnowledge(queryEmbedding)
		} catch (err) {
			console.log("server failed to retrieve knowledge", err.message)
			return res.status(400).end()
		}

		// build system prompt
		const details = `Top 3 most relevant knowledge (from most relevant to most irrelevant):\n${knowledgeRows.map((knowledge, i) => `${i +1} ${knowledge.question}\n- ${knowledge.answer}`)}`

		// submit knowledge
		let chatHistory = req.session.data.chatHistory
		let knowledgeChatResponse = await chatService.chat(chatHistory, details, 1) // set actor to 1 (indicate system prompt)

		return chatResponseHandler(req, res, knowledgeChatResponse, ++depth) // recursive chain
	}

	// update session expiry
	req.session.update()

	return res.json(Object.assign(addReturnPayload, {
		type: chatResponse.type,
		spokenResponse: chatResponse.spokenResponse,
	}))
}

router.post("/", verifiedActors, async (req, res) => {
	if (req.headers["content-type"] !== "text/plain") {
		console.log("Invalid content type provided", req.headers["content-type"])
		return res.status(400).end()
	}

	let prompt = req.body
	console.log(prompt, typeof prompt)
	if (typeof prompt != "string" || prompt.length >= 1000) {
		// not a string, or exceeds 1000 characters
		console.log("hello")
		return res.status(400).end()
	}

	let chatHistory = req.session.data.chatHistory
	let response = await chatService.chat(chatHistory, prompt)

	// handle response
	return chatResponseHandler(req, res, response)
})

router.post("/supply/:id", verifiedActors, async (req, res) => {
	/**
	 * supplies user input via dial pad to user lookup service
	 * then passes redacted information to Jane
	 * 
	 * req.body: string, supplied input (format of input: "NRICWithoutAlphabets#BANKNO#" e.g. "1xxx121#2345678#")
	 */
	if (req.headers["content-type"] !== "text/plain") {
		console.log("Invalid content type provided", req.headers["content-type"])
		return res.status(400).end()
	}

	let session = req.session
	let suppliedId = req.params.id
	if (!session || !session.awaitingInput || !suppliedId || suppliedId !== session.awaitingInputId) {
		// not looking for input
		return res.status(400).end()
	}

	let input = req.body // string
	if (!input || input.length === 0 || !/^\d{7}#\d{7}#$/.test(input)) {
		// return 0
		res.status(400).end()
	}

	// obtain nric and account number --> IMPORTANT: never supply this to chat service
	let [nric, accountno, _] = input.toLowerCase().split("#")

	// unset session state (to prevent another duplicated supply action)
	req.session.awaitingInput = false
	req.session.awaitingInputId = 0 // reset to default

	// obtain data from database
	try {
		let userData = sqlClient.getUserDataFromNRICDigits(nric)
		if (!userData) {
			throw new Error("Failed to retrieve user details")
		}

		let accountsData = getAccountData(userData.id)

		// format data for chat service
		let details = `The supplied details for the current caller:

		# Accounts
		idx	account type
		${accountsData.map((account, i) => `${i}	${account.type_name}`).join("\n")}`

		// update session with account identifiers
		req.session.userId = userData.id
		req.session.accounts = accountsData

		// pass data into chat service
		let chatHistory = req.session.data.chatHistory
		let response = await chatService.chat(chatHistory, details, 1) // set actor to 1 (indicate system prompt)

		return chatResponseHandler(req, res, response)
	} catch (err) {
		return res.status(400).end()
	}
})

router.get("/embed", async (req, res) => {
	console.log("embedding", req.body)
	let e = await embedding.embedding(req.body)
	console.log("result", e, typeof e, e.length)

	return res.status(200).end()
})

module.exports = { // export router object and authenticated middleware
	baseURL, router
}