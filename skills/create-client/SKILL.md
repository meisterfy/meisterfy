---
name: create-client
description: Creates a new client/tenant structure in the marketing workspace. Use this when a user asks to onboard, add, or create a new client.
---
# Create Client Workflow

When the user asks to create a new client, follow these exact steps:

1. Determine a `client_id` (a short slug, e.g., `nova-construtora`).
2. If the user hasn't provided details, ask them for the Client's Name, Niche, Location, Persona, and Tone.
3. Create the directory structure using the `run_shell_command` tool from the workspace root:
   `mkdir -p clients/<client_id>/{posts,ads/google,ads/meta,social-media}`
4. Create the `clients/<client_id>/brand.json` file using the `write_file` tool:
   ```json
   {
     "name": "[Name]",
     "language": "pt_BR",
     "niche": "[Niche]",
     "location": "[Location]",
     "primary_persona": "[Persona]",
     "tone": "[Tone]",
     "hashtags": [],
     "google_ads_id": "",
     "instructions": ""
   }
   ```
5. Confirm to the user that the client was created and is available at `/[tenant]` in the local UI (`http://localhost:5173/<client_id>`).