/**
 * MCP Prompts for common workflows
 * Prompts are reusable templates that guide LLM interactions
 */

import type {
	Prompt,
	PromptArgument,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Prompt argument definitions
 */
const PROJECT_ID_ARG: PromptArgument = {
	name: "project_id",
	description: "Project identifier for scoping memories",
	required: false,
};

const QUERY_ARG: PromptArgument = {
	name: "query",
	description: "Search query or topic",
	required: true,
};

/**
 * Available prompts
 */
export const PROMPTS: Prompt[] = [
	{
		name: "remember_context",
		description:
			"Store important context about the current conversation or task for future reference",
		arguments: [
			{
				name: "content",
				description: "The information to remember",
				required: true,
			},
			{
				name: "importance",
				description: "Importance level: high, medium, or low",
				required: false,
			},
			PROJECT_ID_ARG,
		],
	},
	{
		name: "recall_context",
		description: "Retrieve relevant memories for the current context or task",
		arguments: [QUERY_ARG, PROJECT_ID_ARG],
	},
	{
		name: "build_project_knowledge",
		description:
			"Build comprehensive context about a project from stored memories",
		arguments: [
			{
				name: "project_id",
				description: "Project identifier",
				required: true,
			},
			{
				name: "focus_area",
				description: "Specific area to focus on (optional)",
				required: false,
			},
		],
	},
	{
		name: "learn_pattern",
		description: "Store a learned pattern or best practice for future use",
		arguments: [
			{
				name: "pattern_name",
				description: "Name of the pattern",
				required: true,
			},
			{
				name: "description",
				description: "Description of the pattern",
				required: true,
			},
			{
				name: "code_example",
				description: "Optional code example",
				required: false,
			},
			{
				name: "tier",
				description: "Memory tier: 1 (project), 2 (general), or 3 (global)",
				required: false,
			},
		],
	},
	{
		name: "troubleshoot",
		description: "Search for relevant error solutions and debugging knowledge",
		arguments: [
			{
				name: "error_description",
				description: "Description of the error or issue",
				required: true,
			},
			{
				name: "error_type",
				description: "Type of error (e.g., runtime, compile, logic)",
				required: false,
			},
		],
	},
	{
		name: "code_review_context",
		description: "Gather context for reviewing code in a specific area",
		arguments: [
			{
				name: "code_area",
				description: "Area of code being reviewed",
				required: true,
			},
			PROJECT_ID_ARG,
		],
	},
	{
		name: "session_summary",
		description:
			"Create a summary of the current session and store it for future reference",
		arguments: [
			{
				name: "summary",
				description: "Summary of what was accomplished",
				required: true,
			},
			{
				name: "decisions",
				description: "Key decisions made",
				required: false,
			},
			{
				name: "next_steps",
				description: "Next steps or todos",
				required: false,
			},
			PROJECT_ID_ARG,
		],
	},
	{
		name: "entity_context",
		description: "Get context about entities related to a topic",
		arguments: [
			{
				name: "entity_name",
				description: "Name of the entity to explore",
				required: true,
			},
			{
				name: "depth",
				description: "How many relationship hops to explore (1-3)",
				required: false,
			},
		],
	},
];

/**
 * Prompt message templates
 */
export const PROMPT_TEMPLATES: Record<
	string,
	(args: Record<string, string>) => string
> = {
	remember_context: (args) => `Please store the following information in memory:

Content: ${args.content}
${args.importance ? `Importance: ${args.importance}` : ""}
${args.project_id ? `Project: ${args.project_id}` : ""}

Use the add_memory tool to store this. Choose an appropriate memory type and tier based on the content.`,

	recall_context: (args) => `Search for memories relevant to: "${args.query}"
${args.project_id ? `Scope: Project ${args.project_id}` : ""}

Use the search_memory tool to find relevant information, then summarize what you found.`,

	build_project_knowledge: (
		args,
	) => `Build comprehensive context for project: ${args.project_id}
${args.focus_area ? `Focus area: ${args.focus_area}` : ""}

Steps:
1. Use search_memory to find memories related to this project
2. Use query_graph to explore related entities
3. Synthesize the information into a coherent overview

Provide a structured summary of what you know about this project.`,

	learn_pattern: (args) => `Store this pattern for future reference:

Pattern: ${args.pattern_name}
Description: ${args.description}
${args.code_example ? `Example:\n\`\`\`\n${args.code_example}\n\`\`\`` : ""}

Use add_memory with memory_type="code" and the appropriate tier (${args.tier || "2"}).`,

	troubleshoot: (args) => `Search for solutions related to this error:

Error: ${args.error_description}
${args.error_type ? `Type: ${args.error_type}` : ""}

Steps:
1. Use search_memory with relevant keywords
2. Look for memories with memory_type="error_solution"
3. Provide any found solutions or suggest storing the solution once resolved`,

	code_review_context: (
		args,
	) => `Gather context for reviewing code in: ${args.code_area}
${args.project_id ? `Project: ${args.project_id}` : ""}

Steps:
1. Search for existing patterns and conventions
2. Look for related decisions and trade-offs
3. Check for known issues or gotchas
4. Summarize the context for the review`,

	session_summary: (args) => `Create and store a session summary:

Summary: ${args.summary}
${args.decisions ? `Decisions: ${args.decisions}` : ""}
${args.next_steps ? `Next Steps: ${args.next_steps}` : ""}
${args.project_id ? `Project: ${args.project_id}` : ""}

Use add_memory with memory_type="conversation" to store this summary.`,

	entity_context: (
		args,
	) => `Explore the knowledge graph for: ${args.entity_name}
${args.depth ? `Depth: ${args.depth}` : ""}

Steps:
1. Use query_graph to find the entity and its relationships
2. Search for memories mentioning this entity
3. Provide a comprehensive overview of what's known about this entity`,
};

/**
 * Get prompt template by name
 */
export function getPromptTemplate(
	name: string,
): ((args: Record<string, string>) => string) | undefined {
	return PROMPT_TEMPLATES[name];
}

/**
 * Render a prompt with arguments
 */
export function renderPrompt(
	name: string,
	args: Record<string, string>,
): string | undefined {
	const template = getPromptTemplate(name);
	if (!template) {
		return undefined;
	}
	return template(args);
}
