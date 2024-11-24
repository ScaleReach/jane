const OpenAI = require("openai")

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});

async function embedding(text) {
	/**
	 * text: string, raw, unprocessed string to be embedded
	 * 
	 * takes in the raw string and returns the embedding in vector space
	 * openai embedding model will handle tokenisation and preprocessing automatically
	 * 
	 * return the word embedding in vector form
	 */
	const embedding = await client.embeddings.create({
		model: "text-embedding-3-small",
		input: text,
		encoding_format: "float",
	});

	return embedding.data[0].embedding
}

module.exports = {
	embedding
}