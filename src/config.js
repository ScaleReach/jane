let development = {
	headerAuthKey: "x-jane-key",

	interface: {
		url: "http://localhost:3001",
	}
}

let production = {
	headerAuthKey: "x-jane-key",

	interface: {
		url: "http://localhost:3001",
	}
}

module.exports = process.env.NODE_ENV === "production" ? production : development