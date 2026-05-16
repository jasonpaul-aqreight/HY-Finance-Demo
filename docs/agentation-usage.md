# Agentation Usage

Agentation is installed in `apps/dashboard` as a development dependency. It adds a small visual annotation toolbar to the dashboard in local development only.

## Start the Dashboard

```bash
cd apps/dashboard
npm run dev
```

Open the local dashboard URL from the terminal output, usually `http://localhost:3000`.

## Use Without Agent Sync

1. Open the dashboard in a desktop browser.
2. Use the Agentation toolbar shown on the page.
3. Click a dashboard area and write a short comment.
4. Copy or send the generated annotation text to your coding agent.

This mode stores annotations locally in the browser and does not send data to a remote service.

## Optional: Use With Local Agent Sync

Run the Agentation MCP server in another terminal:

```bash
npx agentation-mcp server
```

Then start the dashboard with the local endpoint:

```bash
cd apps/dashboard
NEXT_PUBLIC_AGENTATION_ENDPOINT=http://localhost:4747 npm run dev
```

Agentation will create a local session and sync annotations to the MCP server on your machine.

## Optional: Configure MCP For Coding Agents

To auto-configure supported coding agents, run:

```bash
npx add-mcp "npx -y agentation-mcp server"
```

To check the setup:

```bash
npx agentation-mcp doctor
```

The default Agentation server port is `4747`.
