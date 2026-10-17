# Installing Explainimals (instructions for an AI agent)

## Rules for you, the agent

- Before you change anything, tell the user exactly what you are about to do (the commands or the copy) in ONE message, and ask once. Wait for a clear yes. Do not ask again for each step. Ask again only before replacing or deleting something that already exists.
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
- If Node is missing or older than 18, do not stop and do not ask a separate question. Add one line to your single plan message (see the Rules): the user will need Node 18 or newer to make explainers.

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
2. Run `claude plugin list` again. Expect `explainimals@explainimals`, enabled, with the version in `plugin/.claude-plugin/plugin.json` (0.2.1 at the time of writing). If it is not there, stop and report the output.
3. Tell the user to restart Claude Code. The skill loads at startup, so a session that is already running will not see it.

## B. Codex

Codex ships a built-in `skill-installer` skill. It downloads this repo's archive from GitHub to a temporary folder and installs only the skill folder into `~/.codex/skills/explainimals` (or `$CODEX_HOME/skills/explainimals` if `CODEX_HOME` is set). If the download fails it falls back to a git sparse checkout. It aborts if the destination folder already exists.

1. Tell the user the whole plan in ONE message and ask once: install `explainimals` from `https://github.com/darwiniquina/Explainimals/tree/main/plugin/skills/explainimals` into `~/.codex/skills/explainimals` (all projects), using the command in step 2. Say that this needs network access and permission to write to the Codex skills folder, so a sandboxed Codex will ask for that approval once. Mention that a project-only install into `<project>/.agents/skills` is possible if they want it, and add the Node line from Step 2 if it applies. Wait for a yes. Do not ask about the scope or each step.
2. Run the installer. Prefer invoking Codex's `skill-installer` skill with that URL. Otherwise run the script directly. If you are sandboxed, use the approval you named in the plan; do not ask again.
   - PowerShell: `python "$HOME\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py" --url https://github.com/darwiniquina/Explainimals/tree/main/plugin/skills/explainimals`
   - bash: `python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --url https://github.com/darwiniquina/Explainimals/tree/main/plugin/skills/explainimals`
   - If `python` is not found, try `python3` or `py`. For one project only, add `--dest <project>/.agents/skills`.
3. If the `explainimals` folder already exists at the destination, the installer aborts. Tell the user and ask once. On a yes, delete only that old `explainimals` folder, then run step 2 again.
4. Verify that `<dest>/explainimals/SKILL.md` exists directly inside it, and that the folder holds 34 files. If not, stop and report.
5. Tell the user to restart Codex, run `/skills` and check that `explainimals` is listed, then try `$explainimals make an explainer about DNS`. If it is not listed after a restart, stop and report. Offer to read the OpenAI Codex skills docs (https://developers.openai.com/codex/skills), and do not guess other folders.
6. Fallback. If the command is blocked by a sandbox policy, rejected, or fails (network error, Python missing): STOP. Do not try other ways around the block, and do not leave temp files. Tell the user what was blocked (the exact message), then give them exactly ONE of these lines to paste into their own terminal, chosen for their shell, and say that it installs into `~/.codex/skills/explainimals` and that they must restart Codex afterwards (if an `explainimals` folder is already there, delete it first):
   - PowerShell: `python "$HOME\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py" --url https://github.com/darwiniquina/Explainimals/tree/main/plugin/skills/explainimals`
   - bash: `python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --url https://github.com/darwiniquina/Explainimals/tree/main/plugin/skills/explainimals`
   - If `python` is not found, use `python3` or `py`. If the `.system/skill-installer` folder does not exist (an older Codex), use the last resort below.
   - Last resort, with no Python at all (agent sandboxes often block this too; needs `git`): ask the user to run these in their own terminal, which clones the repo and copies the skill into `~/.agents/skills`. If the clone folder already exists, delete it first. PowerShell:
   ```powershell
   git clone --depth 1 https://github.com/darwiniquina/Explainimals "$HOME\explainimals-clone"
   New-Item -ItemType Directory -Force "$HOME\.agents\skills\explainimals" | Out-Null
   Copy-Item -Recurse -Force "$HOME\explainimals-clone\plugin\skills\explainimals\*" "$HOME\.agents\skills\explainimals\"
   Remove-Item -Recurse -Force "$HOME\explainimals-clone"
   ```
   bash:
   ```bash
   git clone --depth 1 https://github.com/darwiniquina/Explainimals ~/explainimals-clone && mkdir -p ~/.agents/skills/explainimals && cp -r ~/explainimals-clone/plugin/skills/explainimals/. ~/.agents/skills/explainimals/ && rm -r ~/explainimals-clone
   ```
   Check that `SKILL.md` sits directly inside `~/.agents/skills/explainimals` (do not nest it twice), then restart Codex and run `/skills`.

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

Do the same copy as the last-resort commands in B6 (clone, then copy `plugin/skills/explainimals`), into that agent's skills folder, so that `explainimals/SKILL.md` ends up inside it. Ask the user where that folder is. Do not guess the path.

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
- Codex, PowerShell: `Remove-Item -Recurse -Force "$HOME\.codex\skills\explainimals"`, bash: `rm -r ~/.codex/skills/explainimals`. If you also installed it into `~/.agents/skills` or `<project>/.agents/skills`, remove that `explainimals` folder the same way.
- Another agent, PowerShell: `Remove-Item -Recurse -Force "$HOME\.agents\skills\explainimals"`
- Another agent, bash: `rm -r ~/.agents/skills/explainimals`
- Claude.ai: delete the skill in the Skills section of settings.

## What this installs

- Only the `plugin/` folder of the repo: about 35 files, about 400 KB (the 34-file skill folder; for Codex it lands in `~/.codex/skills/explainimals`). That is the skill (`SKILL.md`, `references/`, `runtime/`, `scripts/`, `assets/`) and, for Claude Code, its plugin manifest.
- Not installed: the studio, the dashboard and the source art.
- Nothing runs in the background. The skill runs only when the user asks for an explainer.
- No network calls. The skill's scripts and the pages it builds send nothing anywhere.
