# Jane
ScaleReach's very first callbot agent.

# Development
## GET `/chat/new`
Endpoint to request for a new access key, expires after 2 hours of idle time

Returns
```
{
	key: "94b5d19cc2b8e849bb8ddc39f10893d5ab4803de250ed3cf2195d163debbdeff677162f7dd4fe85b6111ab319a0984c5244067d672296329c1cb643a6c0e1d5d"
}
```

## POST `/chat`
Endpoint for LLM interaction

Request body: string
```
Hello!
```

Request headers
```
{
	["x-jane-key"]: "94b5d19cc2b8e849bb8ddc39f10893d5ab4803de250ed3cf2195d163debbdeff677162f7dd4fe85b6111ab319a0984c5244067d672296329c1cb643a6c0e1d5d"
}
```

Returns
```
{
	message: "Hello, I am Jane from OCBC, how may I help you?"
}
```

# Deploy

1. Upload certificates (.pem and .key) into /certs (`./certs/scalereach.team.pem` and `./certs/scalereach.team.key`)
2. `docker build -t jane .`
3. `docker run -p 6732:6732 --env-file ./src/.env jane`