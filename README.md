<p align="center">
  <img src="resources/branding/musical-github.png" alt="Musical AI - your ideas, your models, your machine" width="100%">
</p>
<p align="center">
  <a href="https://github.com/Kuloka/Nevo-AI-place/releases/tag/1.18">Download for Windows</a> &nbsp; / &nbsp;
  <a href="#development">Development</a>
</p>

# Musical AI

Local desktop AI studio built with Electron. Musical AI can prepare a compact model without installing Ollama, and split a request between specialist agents before producing a combined answer.

## Windows installation

Run the generated Musical AI Setup executable, then choose **Quick setup** in the welcome screen. It downloads a pinned llama.cpp CPU runtime (18.6 MB) and Qwen2.5 1.5B Instruct Q4_K_M (1.12 GB), verifies both using SHA256, and starts the model automatically. Interrupted downloads can resume. If Microsoft Visual C++ runtime libraries are missing, setup downloads their signed 25.6 MB installer from Microsoft and launches it; Windows may request administrator confirmation. This prerequisite path was inspected but not exercised on a clean Windows installation. No Node.js, Python, API key, or Ollama installation is needed for this path.

Quick setup currently supports **Windows x64** and text conversations. The small starter model is intended for getting started; it is not a replacement for a larger coding model. The runtime binds only to loopback and stops when Musical AI exits. Models need an internet connection to download; generation with the prepared model works locally. The existing optional web search feature can still make internet requests.

Existing Ollama installations are detected and started automatically. **Install Ollama instead** installs it from the app; downloading an Ollama catalog model also prepares Ollama when necessary. Other platforms currently use Ollama. The welcome screen provides the model download size before setup starts.

## Agent team

**Agents - Auto** enables a coordinator that proposes up to two independent subtasks. Specialists receive the conversation context and assigned task, and the main model combines their drafts. Simple or indivisible requests skip the specialists. Image requests use the existing vision path.

The team panel displays actual request states, model names, elapsed time, assignments, and returned drafts. Stop cancels the active team requests and final response. Failed workers are shown as errors; their output is excluded from synthesis. Workers analyze supplied context and draft text/code; they do not independently execute tools or edit files. Existing main-response file handling remains responsible for project writes.

Settings let each specialist use the main model or another installed text model. The embedded engine shares one set of model weights across up to two request slots, falling back to one at startup when available RAM is below 6 GiB or there are fewer than four logical CPUs. Ollama schedules its own requests and may queue them. Multiple agents can take longer than one model; acceleration is not guaranteed.

## Development

```sh
npm install
npm start
npm run check
npm test
npm run dist:win
```

`dist:win` builds an NSIS installer and a portable executable. On PowerShell systems that block npm.ps1, use `npm.cmd`. `install.cmd` prepares development dependencies; end users should use the generated installer.

Data lives in ~/.musical-data and projects in ~/MusicalProject. On first launch, existing legacy chats, settings, downloaded models and projects are imported once without overwriting current files. Original folders remain as backups. Installer upgrade identity is preserved.

## Upstream components

- [llama.cpp b10549](https://github.com/ggml-org/llama.cpp/releases/tag/b10549), MIT license; the downloaded archive retains its upstream files.
- [Qwen2.5 1.5B Instruct GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF), Apache 2.0 model license.
- [Ollama](https://ollama.com/) remains an optional model backend.

The starter engine and model are downloaded separately and are not bundled into the application installer.

## Downloading more models without Ollama

The text catalog defaults to Without Ollama. Compatible GGUF text models download directly from the public model registry and run through the built-in CPU engine. The registry is a download source; the Ollama application is not needed. Downloads verify SHA256 and GGUF format and are saved in the managed runtime model index. Select the Ollama tab for the separate Ollama backend, including vision models.

The built-in engine loads one model at a time. Specialists sharing that model can use its parallel slots; specialists assigned different built-in models run sequentially to avoid replacing a model during an active response.

## Local skills

Settings > Skills imports Markdown instruction files. Enable each skill explicitly; enabled instructions apply to the main model on subsequent requests. Imported files live in ~/.musical-data/skills. Each imported skill is limited to 12,000 characters and the enabled set to 24,000. Skills are instructions, not executable plugins.

The window uses an integrated draggable title bar with minimize, maximize/restore and close controls.

## Discord Activity

Settings > Discord Activity enables Rich Presence using the built-in Musical AI application ID. The default animated string logo is hosted publicly on GitHub. A running Discord desktop client and activity sharing enabled in Discord are required. The sidebar logo animates only on hover.

Custom HTTPS image URLs or Discord asset names override the default logo; clear the field to restore it. Add prepares a local image/GIF (up to 1024 pixels on its longest side), preserves animation, and warns about small images. Custom files need public hosting before Discord can display them. No bot token is required.

## Brand assets

[Banner, 2560 x 1280](resources/branding/musical-banner.png) / [GitHub image, 1280 x 640](resources/branding/musical-github.png) / [Transparent icon](resources/branding/musical-icon.png)

Regenerate the vector-based artwork with `node scripts/create-branding.cjs`.
