<div align="center">

<img src="https://raw.githubusercontent.com/mermaid-js/mermaid/develop/docs/public/favicon.svg" alt="Mermaid.js Logo" width="100" />

# Mermaid Live Editor

A browser-based live editor for [Mermaid.js](https://mermaid.js.org/) diagrams.

Write Mermaid syntax on the left, see the rendered diagram instantly on the right.

**Live at: [mermaidlive.netlify.app](https://mermaidlive.netlify.app/)**


Made by **[Parithosh Varma](https://github.com/Parithosh-Varma)**

</div>

---

## Features

| | Feature | Description |
|---|---|---|
| | **Live Preview** | Diagrams render in real-time as you type |
| | **Monaco Editor** | Full-featured code editor with Mermaid syntax highlighting |
| | **Multiple Diagrams** | Work on multiple diagrams in tabs |
| | **Pan & Zoom** | Drag to pan, scroll to zoom, fit-to-screen |
| | **Themes & Styles** | 11 themes, 3 visual looks, multiple layout engines |
| | **Export** | Download as SVG, PNG (2x), or PNG (4x) |
| | **Share** | Shareable URL with QR code, Markdown/Image embed |
| | **Dark Mode** | Toggle between light and dark UI |
| | **Presentation Mode** | Fullscreen diagram view |
| | **Import** | Open `.mmd`, `.md`, or `.txt` files via drag-and-drop |
| | **Frontmatter Config** | Override theme per diagram using YAML frontmatter |
| | **Persistence** | Diagrams and settings persist across sessions |
| | **Single-File Build** | Builds to a single self-contained HTML file |

## Supported Diagram Types

```
Flowchart · Sequence · Class · State · ER · Gantt · Pie · Git Graph
Mindmap · User Journey · Timeline · Quadrant · Requirement · Sankey · C4
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
```

Outputs a single `dist/index.html` file that can be opened directly in any browser — no server required.

## Frontmatter Configuration

Override global settings per diagram by adding YAML frontmatter:

```yaml
---
config:
  theme: dark
  look: handDrawn
  layout: elk
  themeVariables:
    primaryColor: "#ff6b6b"
---
flowchart TD
    A --> B
```

## Keyboard Shortcuts

| Action | Shortcut |
|:---|:---|
| Save diagram | `Ctrl + S` |
| Presentation mode | `Ctrl + Shift + P` |
| Show shortcuts | `Ctrl + K` |
| Exit presentation | `Esc` |

## Tech Stack

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Mermaid.js](https://img.shields.io/badge/Mermaid.js-11-FF3670?logo=mermaid&logoColor=white)
![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.55-1E90FF?logo=visual-studio-code&logoColor=white)

</div>

## License

[MIT](LICENSE)

---

<div align="center">
Built with ❤️ by <a href="https://github.com/Parithosh-Varma">Parithosh Varma</a>
</div>
