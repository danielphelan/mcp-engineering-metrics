/**
 * MCP Tool Types
 *
 * Defines the interface for MCP tools following SOLID principles.
 * Each tool is a self-contained unit with its own schema, description, and handler.
 */

import { z } from 'zod';

/**
 * Result type for MCP tool execution
 *
 * Matches the MCP SDK CallToolResult type
 */
export interface MCPToolResult {
  [x: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Base interface for all MCP tools
 *
 * Following Single Responsibility Principle:
 * - Each tool has ONE responsibility
 * - Tool defines its own schema
 * - Tool implements its own handler logic
 *
 * Following Open/Closed Principle:
 * - New tools can be added without modifying existing code
 * - Tool interface is stable/closed for modification
 */
export interface MCPTool<TSchema extends z.ZodType = z.ZodType> {
  /**
   * Unique tool name (e.g., "get_story_points")
   */
  readonly name: string;

  /**
   * Human-readable description of what the tool does
   */
  readonly description: string;

  /**
   * Zod schema defining the tool's input parameters
   */
  readonly schema: TSchema;

  /**
   * Execute the tool with validated parameters
   *
   * @param args - Parameters validated against schema
   * @returns Tool execution result
   */
  handler(args: z.infer<TSchema>): Promise<MCPToolResult>;
}

/**
 * Helper to create a text-only tool result
 */
export function createTextResult(text: string): MCPToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Helper to create an error tool result
 */
export function createErrorResult(errorMessage: string): MCPToolResult {
  return {
    content: [{ type: 'text', text: errorMessage }],
    isError: true,
  };
}
