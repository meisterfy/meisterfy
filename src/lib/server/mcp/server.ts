import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function createServer(): McpServer {
  return new McpServer({
    name: 'marketing-cms',
    version: '1.0.0'
  })
}
