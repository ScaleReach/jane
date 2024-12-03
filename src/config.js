let development = {
	authKeyHeaderField: "x-jane-key",

	interface: {
		url: "http://localhost:3001",
	},

	intentService: {
		url: "http://localhost:3003",
		authKeyHeaderField: "x-intent-key"
	},

	PSQL: {
		HOST: "54.169.176.185",
		PORT: 5432,
		UNAME: "postgres",
		INTENT_DB_NAME: "intent",
		KNOWLEDGE_DB_NAME: "knowledge"
	}
}

let production = {
	authKeyHeaderField: "x-jane-key",

	interface: {
		url: "https://scalereach.team"
	},

	intentService: {
		url: "https://scalereach.team:5732",
		authKeyHeaderField: "x-intent-key"
	},

	PSQL: {
		HOST: "54.169.176.185",
		PORT: 5432,
		UNAME: "postgres",
		INTENT_DB_NAME: "intent",
		KNOWLEDGE_DB_NAME: "knowledge"
	}
}

module.exports = process.env.NODE_ENV === "production" ? production : development