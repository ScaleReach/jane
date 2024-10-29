const express = require("express");
const path = require("path")
const bparser = require("body-parser")

const app = express();
const PORT = 3000;

const chat_router = require(path.join(__dirname, "./routers/chat.js"));

app.use(bparser.text())
app.use(chat_router.baseURL, chat_router.router)

app.listen(PORT, (error) =>{
	if(!error)
		console.log("Server is Successfully Running, and App is listening on port "+ PORT)
	else 
		console.log("Error occurred, server can't start", error);
	}
);