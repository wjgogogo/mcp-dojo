const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  SSEServerTransport,
} = require("@modelcontextprotocol/sdk/server/sse.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");

const { z } = require("zod");
const express = require("express");

const server = new McpServer({
  name: "mcp-server",
  version: "1.0.0",
  description: "MCP Server",
});

server.tool(
  "add2numbers",
  "Add two numbers",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  })
);

server.tool(
  "add3numbers",
  "Add three numbers",
  { a: z.number(), b: z.number(), c: z.number() },
  async ({ a, b, c }) => ({
    content: [{ type: "text", text: String(a + b + c) }],
  })
);

server.tool("get_current_time", "Get the current time", {}, async () => ({
  content: [{ type: "text", text: new Date().toISOString() }],
}));

// stdio transport
const stdio = new StdioServerTransport();
server.connect(stdio);

// sse transport and http streamable transport

let sse = null;
let streamable = null;

const app = express();
app.use(express.json());

app.get("/sse", async (req, res) => {
  sse = new SSEServerTransport("/messages", res);
  await server.connect(sse);
});

app.post("/messages", async (req, res) => {
  if (sse) {
    await sse.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No transport found");
  }
});

app.post("/mcp", async (req, res) => {
  if (isInitializeRequest(req.body)) {
    streamable = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(streamable);
  }
  await streamable.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (req, res) => {
  if (streamable) {
    await streamable.handleRequest(req, res);
  }
};

app.get("/mcp", handleSessionRequest);

app.delete("/mcp", handleSessionRequest);

app.listen(3001, () => {
  console.log("SSE server running at http://localhost:3001");
});
