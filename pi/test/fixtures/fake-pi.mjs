// why: a fake pi ExtensionAPI plus a stub herdr subagent tool; records calls, spawns nothing.
export function makeFakePi() {
	const registeredTools = [];
	const registeredCommands = [];
	const userMessages = [];
	const messages = [];
	const spawns = [];
	const tools = new Map();
	const commands = new Map();
	const hooks = new Map();

	const subagent = {
		name: "subagent",
		label: "Subagent",
		description: "fake herdr spawn; records only",
		parameters: { type: "object", properties: {} },
		execute: async (_id, params) => {
			const { agent, task, model, name } = params ?? {};
			const record = { agent, task, model, name };
			spawns.push(record);
			const id = `fake-${spawns.length}`;
			return {
				content: [{ type: "text", text: "started" }],
				details: { id, name: name ?? agent, task, agent, status: "started" },
			};
		},
	};
	tools.set(subagent.name, subagent);

	return {
		registeredTools,
		registeredCommands,
		userMessages,
		messages,
		spawns,
		tools,
		commands,
		hooks,
		registerTool(tool) {
			registeredTools.push(tool);
			tools.set(tool.name, tool);
		},
		registerCommand(name, opts) {
			registeredCommands.push({ name, opts });
			commands.set(name, opts);
		},
		sendUserMessage(text) {
			userMessages.push(text);
		},
		sendMessage(msg, opts) {
			messages.push({ msg, opts });
		},
		on(event, handler) {
			const list = hooks.get(event) || [];
			list.push(handler);
			hooks.set(event, list);
		},
		// why: pi runs every tool_call handler over one mutable input, then calls the tool
		// with what is left; this reproduces that for a test without a real session.
		async callTool(name, input) {
			for (const handler of hooks.get("tool_call") || []) {
				await handler({ toolName: name, toolCallId: "fake", input }, {});
			}
			return tools.get(name).execute("fake", input);
		},
	};
}

export function makeFakeCtx() {
	const notices = [];
	return {
		cwd: "/fake/cwd",
		notices,
		ui: { notify: (msg, level) => notices.push({ msg, level }) },
	};
}
