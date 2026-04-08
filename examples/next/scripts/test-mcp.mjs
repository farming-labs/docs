const endpoint =
  process.env.DOCS_MCP_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/docs/mcp`;

const expectedTools = ["list_pages", "get_navigation", "search_docs", "read_page"];

function parseMcpResponse(text, contentType) {
  if (contentType?.includes("application/json")) {
    return JSON.parse(text);
  }

  if (contentType?.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6));

    if (dataLines.length === 0) {
      throw new Error(`Missing MCP event payload.\n\n${text}`);
    }

    return JSON.parse(dataLines.join("\n"));
  }

  throw new Error(`Unsupported MCP response type: ${contentType ?? "unknown"}\n\n${text}`);
}

async function post(sessionId, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = parseMcpResponse(text, response.headers.get("content-type"));

  if (!response.ok) {
    throw new Error(
      `MCP request failed with ${response.status} ${response.statusText}\n${JSON.stringify(payload, null, 2)}`,
    );
  }

  return { response, payload };
}

function getToolText(result) {
  const textItem = result?.content?.find?.((item) => item.type === "text");
  if (!textItem?.text) {
    throw new Error(`Expected MCP tool result text payload.\n${JSON.stringify(result, null, 2)}`);
  }

  return textItem.text;
}

async function main() {
  console.log(`Testing MCP endpoint: ${endpoint}`);

  const initialize = await post(null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "example-next-mcp-test", version: "1.0.0" },
    },
  });

  const sessionId = initialize.response.headers.get("mcp-session-id");

  if (!sessionId) {
    throw new Error("Missing MCP session id from initialize response.");
  }

  console.log(`Session established: ${sessionId}`);

  try {
    const tools = await post(sessionId, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    const toolNames = tools.payload.result.tools.map((tool) => tool.name);
    for (const toolName of expectedTools) {
      if (!toolNames.includes(toolName)) {
        throw new Error(
          `Expected tool "${toolName}" to be present.\nAvailable tools: ${toolNames.join(", ")}`,
        );
      }
    }

    console.log(`Tools available: ${toolNames.join(", ")}`);

    const listPages = await post(sessionId, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "list_pages",
        arguments: {},
      },
    });

    const listPagesText = getToolText(listPages.payload.result);
    if (!listPagesText.includes("/docs/installation")) {
      throw new Error(`Expected /docs/installation in list_pages output.\n${listPagesText}`);
    }
    console.log("list_pages returned docs entries.");

    const navigation = await post(sessionId, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_navigation",
        arguments: {},
      },
    });

    const navigationText = getToolText(navigation.payload.result);
    if (!navigationText.includes("Installation")) {
      throw new Error(`Expected Installation in navigation output.\n${navigationText}`);
    }
    console.log("get_navigation returned the docs tree.");

    const searchDocs = await post(sessionId, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "search_docs",
        arguments: {
          query: process.env.MCP_SEARCH_QUERY ?? "quickstart",
        },
      },
    });

    const searchText = getToolText(searchDocs.payload.result);
    if (!searchText.includes("/docs")) {
      throw new Error(`Expected docs search results.\n${searchText}`);
    }
    console.log("search_docs returned matching docs pages.");

    const readPage = await post(sessionId, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "read_page",
        arguments: {
          path: process.env.MCP_READ_PATH ?? "installation",
        },
      },
    });

    const pageText = getToolText(readPage.payload.result);
    if (!pageText.includes("# Installation")) {
      throw new Error(`Expected Installation page content.\n${pageText}`);
    }
    console.log("read_page returned the requested document.");

    console.log("\nMCP smoke test passed.");
  } finally {
    const cleanup = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-11-25",
      },
    });

    console.log(`Session closed: ${cleanup.status}`);
  }
}

main().catch((error) => {
  console.error("\nMCP smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
