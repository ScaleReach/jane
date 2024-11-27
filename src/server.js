const express = require("express");
const path = require("path")
const fs = require("fs")
const https  = require("https")
const bparser = require("body-parser")
const dotenv = require("dotenv").config({ path: __dirname + "/.env" })

const config = require("./config")
const header = require("./header")

const options = {
	key: fs.readFileSync(process.env.SSL_KEY),
	cert: fs.readFileSync(process.env.SSL_CERT),
}

const app = express();
const server = https.createServer(options, app);
const PORT = process.env.PORT;

const chat_router = require(path.join(__dirname, "./routers/chat.js"));

// cors allow interface to request
app.use((req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", config.interface.url) // allow interface
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	res.setHeader("Access-Control-Allow-Headers", `Content-Type, Authorization, ${config.authKeyHeaderField}`)
	next();
})

app.use(bparser.text())
app.use(bparser.json())
app.use(chat_router.baseURL, chat_router.router)

console.log("Allowing CORS", config.interface.url)

server.listen(PORT, (error) => {
	if (!error) {
		console.log("Server is Successfully Running, and App is listening on port "+ PORT)
		console.log(header("Jane", PORT))
	} else {
		console.log("Error occurred, server can't start", error);
	}
});