const OpenAI = require("openai")

// const openai = new OpenAI({
// 	apiKey: '$API_KEY_REQUIRED_IF_EXECUTING_OUTSIDE_NGC',
// 	baseURL: 'https://integrate.api.nvidia.com/v1',
// })

// async function main() {
// 	const completion = await openai.chat.completions.create({
// 		model: "meta/llama3-70b-instruct",
// 		messages: [{"role":"user","content":"Write a limerick about the wonders of GPU computing."}],
// 		temperature: 0.5,
// 		top_p: 1,
// 		max_tokens: 1024,
// 		stream: true,
// 	})
	 
// 	for await (const chunk of completion) {
// 		process.stdout.write(chunk.choices[0]?.delta?.content || '')
// 	}
	
// }

async function chat(chatHistory) {
	/**
	 * chatHistory: chatEntry[], an array whose elements are the chat history
	 * chatEntry: [speakerId: 0|1, content: string], speakerId 0 for USER, 1 for SYSTEM; content stores the message of the chat
	 */
	return {
		"type": 0,
		"content": "Hello, I am Jane from OCBC, how may I help you today?"
	}
}

module.exports = {
	chat
}