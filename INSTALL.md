# Installing Explainimals (instructions for an AI agent)

## Rules for you, the agent

- Before you change anything, tell the user exactly what you are about to do (the commands or the copy). Wait for a clear yes.
- Change only the user's own plugin list or skills folder. Do not edit config files by hand. The `claude plugin` commands update Claude Code's own settings themselves; that is expected.
- Use no sudo and no admin rights.
- Download nothing except from github.com/darwiniquina/Explainimals.
- If a step fails, stop and report the exact error text. Do not improvise a fix.
- Do not run anything from this repo, except the one optional check in Step 3.
- You may delete a temporary folder that you created yourself without asking. Ask before deleting anything else.

## Step 1: work out where you are running

Pick the first line that is true:

- You can run the `claude` CLI (Claude Code): go to A.
- You are Codex: go to B.
- You are a chat with no shell (Claude.ai, the Claude desktop chat, or any agent that cannot run commands): go to C.
- Another agent that reads `SKILL.md` folders: go to D.

## Step 2: check requirements

Run `node --version`. It must print 18 or higher.

- Node.js is needed to USE the skill, not to install it. The install steps below do not need it.
- If Node is missing or older than 18, tell the user and ask whether to continue anyway. Continue only on a yes.

## A. Claude Code

1. Run `claude plugin list`. Then pick ONE path:
   - **Path 1, old name present:** the output contains `pixel-explainer@pixel-explainer`. That is the old name. Remove it, then go on to path 3:
     - `claude plugin uninstall pixel-explainer@pixel-explainer`
     - `claude plugin marketplace remove pixel-explainer`
   - **Path 2, already installed:** the output contains `explainimals@explainimals`. Update it:
     - `claude plugin marketplace update explainimals`
     - `claude plugin update explainimals@explainimals`
     - If the marketplace was added from a local clone, run `git pull` in that clone first, because the update does not pull it.
   - **Path 3, not installed:**
     - `claude plugin marketplace add darwiniquina/Explainimals`
     - `claude plugin install explainimals@explainimals`
     - If you are working from a local clone, pass its path with forward slashes, not backslashes. Example: `claude plugin marketplace add C:/path/to/Explainimals`. Backslashes are stripped in bash and the command fails with `Invalid marketplace source format`.

   Tell the user which path you chose and the exact commands, and wait for a yes before you run them.
2. Run `claude plugin list` again. Expect `explainimals@explainimals`, enabled, with the version in `plugin/.claude-plugin/plugin.json` (0.2.0 at the time of writing). If it is not there, stop and report the output.
3. Tell the user to restart Claude Code. The skill loads at startup, so a session that is already running will not see it.

## B. Codex

1. Ask the user: this project only, or all projects? The default is all projects, which is `~/.agents/skills`. This project only is `<project>/.agents/skills`.
2. Get the files:
   - If the current folder is already a clone of this repo (it contains `plugin/skills/explainimals/SKILL.md`), use it.
   - Otherwise run `git clone --depth 1 https://github.com/darwiniquina/Explainimals` inside a new temp folder that you create. You may delete that temp folder yourself when you are done.
3. If `<skills folder>/explainimals` already exists, tell the user and ask before replacing it. On a yes, delete that old folder first, so files removed in newer versions do not stay behind.
4. Tell the user the source and target paths and wait for a yes. Then copy the contents of `plugin/skills/explainimals` into `<skills folder>/explainimals`, so the result is `<skills folder>/explainimals/SKILL.md`. Do not nest it twice.

   PowerShell (`<clone>` is the clone path):
   ```powershell
   New-Item -ItemType Directory -Force "$HOME\.agents\skills\explainimals" | Out-Null
   Copy-Item -Recurse -Force "<clone>\plugin\skills\explainimals\*" "$HOME\.agents\skills\explainimals\"
   ```

   bash (`<clone>` is the clone path, forward slashes):
   ```bash
   mkdir -p ~/.agents/skills/explainimals && cp -r <clone>/plugin/skills/explainimals/. ~/.agents/skills/explainimals/
   ```

5. Verify that `<skills folder>/explainimals/SKILL.md` exists directly inside it, and that the folder holds 34 files. If not, stop and report.
6. Delete the temp clone if you made one.
7. Tell the user to restart Codex, then run `/skills` and check that `explainimals` is listed. Run it with `$explainimals`.
8. If it is not listed after a restart, stop and report. The skill locations are described in the OpenAI Codex skills docs (https://developers.openai.com/codex/skills). Offer to read them, and do not guess other folders.

Unverified alternative: Codex ships a `skill-installer` skill that can install from a GitHub repo path. Its exact syntax was not checked. Use it only if the user asks, and verify the result as in step 5.

## C. No shell (Claude.ai, Claude desktop chat)

You cannot install the skill from here. Do not pretend that you did. Tell the user to do this:

1. Make the zip from the repo's `plugin/skills` folder, writing it outside the repo (for example to the Desktop). Use a clone or the GitHub download of `darwiniquina/Explainimals`.
   - Windows, PowerShell: `cd plugin\skills` then `tar.exe -a -c -f $HOME\Desktop\explainimals.zip explainimals`
   - macOS or Linux: `cd plugin/skills && zip -r ~/Desktop/explainimals.zip explainimals`
   - Do not use `Compress-Archive`. It writes backslash paths that break the upload.
2. Open the Skills section of their settings and upload `explainimals.zip`. The menu wording was not verified and may differ.
3. Continue at Step 3 once they confirm the upload.

The README section for this is "Claude.ai and the Claude desktop app".

## D. Other agents

Do the same copy as in B, into that agent's skills folder, so that `explainimals/SKILL.md` ends up inside it. Ask the user where that folder is. Do not guess the path.

## Step 3: confirm

When the install is done, tell the user:

- What was installed: the `explainimals` skill, its version (from `plugin/.claude-plugin/plugin.json`), and where. That is the Claude Code plugin, the folder path for Codex or another agent, or the uploaded zip for Claude.ai.
- That a restart is needed for Claude Code, and for Codex if `explainimals` is not listed.
- How to try it:
  - Claude Code: `/explainimals:explainimals make an explainer about DNS`
  - Codex: `$explainimals make an explainer about DNS`
  - Or in plain language: "make a short explainer about washing your hands"
- The output is written to `explainimals-output/<topic>.html`. Open it and press **Play**. Sound is off until Play.

Optional check (the only thing you may run from the installed copy; offer it, do not insist): with Node 18+, run `node <installed skill folder>/scripts/validate.js <installed skill folder>/references/examples/sky-blue.js`. It should print `0 errors, 0 warnings`.

## Remove it

Ask the user before you delete anything.

- Claude Code:
  ```
  claude plugin uninstall explainimals@explainimals
  claude plugin marketplace remove explainimals
  ```
  Claude Code may keep an inert cached copy of the plugin folder for a while. That is normal.
- Codex or another agent, PowerShell: `Remove-Item -Recurse -Force "$HOME\.agents\skills\explainimals"`
- Codex or another agent, bash: `rm -r ~/.agents/skills/explainimals`
- Claude.ai: delete the skill in the Skills section of settings.

## What this installs

- Only the `plugin/` folder of the repo: about 35 files, about 400 KB (34 files in the skill folder that Codex and other agents get). That is the skill (`SKILL.md`, `references/`, `runtime/`, `scripts/`, `assets/`) and, for Claude Code, its plugin manifest.
- Not installed: the studio, the dashboard and the source art.
- Nothing runs in the background. The skill runs only when the user asks for an explainer.
- No network calls. The skill's scripts and the pages it builds send nothing anywhere.
