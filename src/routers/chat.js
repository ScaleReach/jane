const baseURL = "/chat"

const express = require("express")
const path = require("path")
const { chat } = require("../includes/chat")
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
	if (depth >= 3) {
		// prevent recursive loop
		// may happen if llm is forced to return type 2 on all calls
		return res.status(400).end()
	}

	if (chatResponse.type === 5) {
		// awaiting input, client to send to endpoint POST @router/supply/:inputId
		let inputId = +new Date() // act as session id

		req.session.data.awaitingInput = true
		req.session.data.awaitingInputId = inputId.toString() // important since strict equality is enforced upon checking supplied i

		// add to return payload
		addReturnPayload.inputId = inputId
	} else if (chatResponse.type === 3) {
		// file intent with intent service
		if (!req.session.data.userId || !req.session.data.accounts) {
			// not yet authenticated
			return res.status(400).end()
		}
		if (!chatResponse.intent || chatResponse.intent.description.length === 0) {
			// chat service did not supply right params
			return res.status(400).end()
		}

		// in intent description: substitute $x$ for account numbers
		console.log("req.session.data.accounts", req.session.data.accounts)
		for (let i = 0; i < req.session.data.accounts.length; i++) {
			chatResponse.intent.description = chatResponse.intent.description.replaceAll(`$${i}$`, req.session.data.accounts[i].account_number)
		}

		// file intent
		let intentId = await intentService.fileIntent(req.session.data.userId, chatResponse.intent.type, chatResponse.intent.description)
		if (!intentId) {
			// failed to file intent
			console.warn("Failed to file intent with data", req.session.data.userId, chatResponse)
			return res.status(500).end()
		}
	} else if (chatResponse.type === 2) {
		// knowledge bank
		console.log("chatResponse")
		if (!chatResponse.query) {
			// chat service did not supply right params
			return res.status(400).end()
		}

		// check threshold limit
		req.session.data.knowledgeBankQueries += 1
		if (req.session.data.knowledgeBankQueries >= 5) {
			// over threshold
			let bl_message = "You have exceeded the threshold for the knolwedge bank, kindly escalate this call to a human provider. Thank you."
			let followUpChatResp = await chatService.chat(req.session.data.chatHistory, bl_message, 1) // set actor to 1 (indicate system prompt)
			return chatResponseHandler(req, res, followUpChatResp, ++depth) // recursive chain
		}

		// embed query and submit it to knowledge base
		let queryEmbedding = await embedding.embedding(chatResponse.query)
		let knowledgeRows;
		try {
			knowledgeRows = await sqlClient.getTopThreeRelevantKnowledge(queryEmbedding)
		} catch (err) {
			console.log("server failed to retrieve knowledge", err.message)
			return res.status(400).end()
		}

		// build system prompt
		let details
		if (knowledgeRows.length >= 1) {
			details = `Top 3 most relevant knowledge (from most relevant to most irrelevant):\n${knowledgeRows.map((knowledge, i) => `${i +1} ${knowledge.question}\n- ${knowledge.answer}`).join("\n")}`
		} else {
			details = "No result returned from knowledge bank, kindly escalate the call to a human provider. Thank you."
		}

		// submit knowledge
		console.log("\n\nKNOWLEDGE!", details)
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
	console.log("suppledId", suppliedId)
	if (!session || !session.data.awaitingInput || !suppliedId || suppliedId !== session.data.awaitingInputId) {
		// not looking for input
		console.log("not looking for input", session)
		return res.status(400).end()
	}

	let input = req.body // string
	console.log("input", input)
	if (!input || input.length === 0 || !/^\d{7}#\d{7}#$/.test(input)) {
		// return 0
		console.log("invalid input")
		res.status(400).end()
	}

	// obtain nric and account number --> IMPORTANT: never supply this to chat service
	let [nric, accountno, _] = input.toLowerCase().split("#")

	// unset session state (to prevent another duplicated supply action)
	req.session.data.awaitingInput = false
	req.session.data.awaitingInputId = 0 // reset to default

	// obtain data from database
	try {
		let userData = await sqlClient.getUserDataFromNRICDigits(nric)
		if (!userData) {
			throw new Error("Failed to retrieve user details")
		}

		let accountsData = await sqlClient.getAccountData(userData.id) // will never be undefined, returns empty array on no match

		// format data for chat service
		let details;
		if (accountsData.length === 0) {
			details = "The supplied user identity has no bank accounts with us."
		} else {
			details = `The supplied details for the current caller:
# Accounts
idx	account type
${accountsData.map((account, i) => `${i}	${account.type_name}`).join("\n")}`
		}

		// update session with account identifiers
		req.session.data.userId = userData.id
		req.session.data.accounts = accountsData

		console.log("\n\ndetails", details)

		// pass data into chat service
		let chatHistory = req.session.data.chatHistory
		let response = await chatService.chat(chatHistory, details, 1) // set actor to 1 (indicate system prompt)

		return chatResponseHandler(req, res, response)
	} catch (err) {
		// failed to retrieve data
		console.log("failed", err.message)
		let response = await chatService.chat(
			req.session.data.chatHistory,
			"Failed to verify caller's identity, please escalate the call to a human provider. Thank you.",
			1 // set actor to 1 (indicate system prompt)
		)

		return chatResponseHandler(req, res, response)
	}
})

router.post("/knowledge/new", async (req, res) => {
	let d = req.body
	console.log(d)

	let question = d.question
	let answer = d.answer

	let questionEmbedding = await embedding.embedding(question)
	let answerEmbedding = await embedding.embedding(answer)

	try {
		knowledgeRows = await sqlClient.insertKnowledge(question, answer, questionEmbedding, answerEmbedding)
	} catch (err) {
		console.log("server failed to insert knowledge", err.message)
		return res.status(400).end()
	}

	return res.status(200).end()
})



module.exports = { // export router object and authenticated middleware
	baseURL, router
}