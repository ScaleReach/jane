const path = require("path")
const pg = require("pg")
const pgvector = require("pgvector/pg")
const config = require(path.join(__dirname, "../../config"))

class SQLError extends Error {
	constructor(msg) {
		super(msg)
	}
}

const intent_pool = new pg.Pool({
	host: config.PSQL.HOST,
	port: config.PSQL.PORT,
	user: config.PSQL.UNAME,
	password: process.env.PSQL_PASSWORD,
	database: config.PSQL.INTENT_DB_NAME,
})

const knowledge_pool = new pg.Pool({
	host: config.PSQL.HOST,
	port: config.PSQL.PORT,
	user: config.PSQL.UNAME,
	password: process.env.PSQL_PASSWORD,
	database: config.PSQL.KNOWLEDGE_DB_NAME,
})
knowledge_pool.on("connect", async client => {
	await pgvector.registerTypes(client)
})

async function getUserDataFromNRICDigits(nric) {
	/**
	 * queries for user data by nric (to obtain userId)
	 * 
	 * returns the userData
	 * returns undefined if no userData returned from query
	 * throws an error if client failed to run query
	 */
	try {
		let userDataRow = await intent_pool.query(`SELECT * FROM "user" WHERE nric LIKE $1`, [nric])
		if (userDataRow.rows.length !== 1) {
			// no results or more than one result
			return
		}

		return userDataRow.rows[0]
	} catch (err) {
		throw new SQLError(`Failed to query from "user": ${err.message}`)
	}
}

async function getAccountData(userId) {
	/**
	 * queries for the accounts held by user
	 * 
	 * returns accounts[], can be empty if no accounts found
	 * throws an error if client failed to run query
	 */
	try {
		let userDataRow = await intent_pool.query(`SELECT *, at.name AS type_name FROM "account" a JOIN "accounttype" at ON a.type = at.id WHERE userid = $1`, [userId])
		console.log("account queried", userDataRow.rows)
		return userDataRow.rows
	} catch (err) {
		throw new SQLError(`Failed to query from "account": ${err.message}`)
	}
}

async function getTopThreeRelevantKnowledge(queryEmbedding) {
	/**
	 * queryEmbedding: number[], embedding of query
	 * 
	 * returns top 3 most relevant question-answer knowledge rows (in order, with index 0 being most relevant)
	 */
	try {
		let knowledgeRow = await knowledge_pool.query(`SELECT question, answer FROM "faq" ORDER BY embedding <-> $1 LIMIT 3`, [pgvector.toSql(queryEmbedding)])
		return knowledgeRow.rows
	} catch (err) {
		throw new SQLError(`Failed to query from "faq": ${err.message}`)
	}
}

module.exports = {
	getUserDataFromNRICDigits, getAccountData, getTopThreeRelevantKnowledge
}