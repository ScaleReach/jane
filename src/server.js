const express = require("express");
const path = require("path")
const bparser = require("body-parser")
const dotenv = require("dotenv").config({ path: __dirname + "/.env" })

const config = require("./config")
const header = require("./header")

console.log(process.env.OPENAI_API_KEY)

const app = express();
const PORT = 3000;

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

app.listen(PORT, (error) => {
	if (!error) {
		console.log("Server is Successfully Running, and App is listening on port "+ PORT)
		console.log(header("Jane", PORT))
	} else {
		console.log("Error occurred, server can't start", error);
	}
});