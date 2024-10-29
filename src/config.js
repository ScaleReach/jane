const config = {
	"development": {
		headerAuthKey: "x-jane-key"
	},
	"production": {
		headerAuthKey: "x-jane-key"
	}
}

module.exports = config[process.env.NODE_ENV === "production" ? "production" : "development"]