import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer } from '$lib/server/mcp/server.js'
import type { RequestHandler } from './$types'

async function handle(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const mcpServer = createServer()
  await mcpServer.connect(transport)
  return transport.handleRequest(request)
}

export const POST: RequestHandler = async ({ request }) => handle(request)
export const GET: RequestHandler = async ({ request }) => handle(request)
export const DELETE: RequestHandler = async ({ request }) => handle(request)
