import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import panzoom from "panzoom";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  Fullscreen,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  Sun,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import mermaid from "mermaid";
import { AuthorCard } from "@/components/AuthorCard";

// --- Types ---
interface Diagram {
  id: string;
  name: string;
  code: string;
}

interface FrontmatterConfig {
  theme?: string;
  look?: string;
  layout?: string;
  themeVariables?: Record<string, string>;
}

interface AppConfig {
  theme: string;
  look: string;
  layout: string;
  background: string;
  transparent: boolean;
  themeVariables: Record<string, string>;
}

// --- Samples ---
const SAMPLES: Record<string, string> = {
  Flowchart: `flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> E{Fixed?}
    E -- Yes --> C
    E -- No --> D`,

  "Sequence Diagram": `sequenceDiagram
    autonumber
    participant U as User
    participant A as App
    participant S as Server
    U->>A: Enter query
    A->>S: POST /api/query
    S-->>A: Return results
    A-->>U: Display results`,

  "Class Diagram": `classDiagram
    class Animal {
      +String name
      +makeSound()
    }
    class Dog {
      +fetch()
    }
    class Cat {
      +scratch()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,

  "State Diagram": `stateDiagram-v2
    [*] --> Idle
    Idle --> Running : start
    Running --> Paused : pause
    Paused --> Running : resume
    Running --> Idle : stop
    Idle --> [*] : exit`,

  "ER Diagram": `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int id
        date created_at
    }`,

  "Gantt Chart": `gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Research       :a1, 2024-01-01, 7d
    Design         :after a1, 5d
    section Development
    Implementation :2024-01-15, 10d
    Testing        :2024-01-25, 5d`,

  "Pie Chart": `pie title Favorite Frontend Frameworks
    "React" : 40
    "Vue" : 25
    "Angular" : 15
    "Svelte" : 20`,

  "Git Graph": `gitGraph
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit`,

  Mindmap: `mindmap
  root((Project))
    Planning
      Research
      Design
    Development
      Frontend
      Backend
    Deployment
      CI/CD
      Hosting`,

  "User Journey": `journey
    title User Login Flow
    section Visit site
      Load page: 5: User
      Click login: 4: User
    section Authenticate
      Enter credentials: 4: User
      Submit form: 5: User, System
      Receive token: 5: System`,
};

const THEMES = [
  "default",
  "dark",
  "forest",
  "neutral",
  "base",
  "neo",
  "neo-dark",
  "redux",
  "redux-dark",
  "redux-color",
  "redux-dark-color",
];

const LOOKS = ["classic", "handDrawn", "neo"];
const LAYOUTS = ["dagre", "elk", "tidy-tree"];
const STORAGE_DIAGRAMS = "mermaid-live-diagrams";
const STORAGE_ACTIVE = "mermaid-live-active";
const STORAGE_APP_CONFIG = "mermaid-live-app-config";
const STORAGE_DARK = "mermaid-live-dark";

// --- Helpers ---
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseFrontmatter(code: string): { config: FrontmatterConfig; body: string } {
  const match = code.trimStart().match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { config: {}, body: code };
  const yaml = match[1];
  const config: FrontmatterConfig = {};
  const lines = yaml.split("\n");
  let inConfig = false;
  let inThemeVariables = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "config:") {
      inConfig = true;
      continue;
    }
    if (!inConfig) continue;
    if (line.startsWith("themeVariables:")) {
      inThemeVariables = true;
      config.themeVariables = {};
      continue;
    }
    if (inThemeVariables) {
      const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
      if (kv) {
        config.themeVariables![kv[1]] = kv[2].replace(/^["']|["']$/g, "");
      } else if (line.match(/^\w+:/)) {
        inThemeVariables = false;
      }
    }
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
    if (kv) {
      const key = kv[1];
      const value = kv[2].replace(/^["']|["']$/g, "");
      if (key === "theme") config.theme = value;
      if (key === "look") config.look = value;
      if (key === "layout") config.layout = value;
    }
  }
  return { config, body: code.slice(match[0].length) };
}

function formatThemeName(t: string) {
  return t
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Register Mermaid language in Monaco.
loader.init().then((monacoInstance) => {
  monacoInstance.languages.register({ id: "mermaid" });
  monacoInstance.languages.setMonarchTokensProvider("mermaid", {
    defaultToken: "",
    tokenPostfix: ".mmd",
    keywords: [
      "flowchart", "graph", "sequenceDiagram", "classDiagram", "stateDiagram", "stateDiagram-v2",
      "erDiagram", "gantt", "pie", "gitGraph", "mindmap", "journey", "requirementDiagram",
      "C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment",
      "sankey", "xychart-beta", "timeline", "quadrantChart", "architecture-beta",
      "autonumber", "participant", "actor", "loop", "alt", "else", "opt", "par", "rect", "note",
      "class", "section", "commit", "branch", "checkout", "merge", "title", "dateFormat",
      "subgraph", "end",
    ],
    operators: [
      "-->", "--->", "==>", "===>", "-.->", "-.->>", "-->>", "--x", "--X", "==>>", "==x", "==X",
      "--|>", "--*", "--o", "..|>", "..", "--", "==", "-.-",
    ],
    tokenizer: {
      root: [
        [/[a-zA-Z][\w]*/, {
          cases: {
            "@keywords": "keyword",
            "@default": "identifier",
          },
        }],
        [/[{}\[\]()]/, "delimiter.bracket"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/[#%;]/, "comment"],
        [/\d+/, "number"],
        [/[\-+*/:<>=!]+/, {
          cases: {
            "@operators": "operator",
            "@default": "",
          },
        }],
      ],
      string: [
        [/[^"\\]+/, "string"],
        [/"/, "string", "@pop"],
      ],
    },
  });
});

interface PanZoomApi extends ReturnType<typeof panzoom> {
  zoomIn: () => void;
  zoomOut: () => void;
  getTransform: () => { x: number; y: number; scale: number };
}

export default function App() {
  // --- State ---
  const [diagrams, setDiagrams] = useState<Diagram[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DIAGRAMS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ id: uid(), name: "Diagram 1", code: SAMPLES["Flowchart"] }];
  });
  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_ACTIVE) || diagrams[0]?.id;
    } catch {
      return diagrams[0]?.id;
    }
  });
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_APP_CONFIG);
      if (saved) return { ...JSON.parse(saved) };
    } catch {}
    return {
      theme: "default",
      look: "classic",
      layout: "dagre",
      background: "#ffffff",
      transparent: false,
      themeVariables: {},
    };
  });
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DARK);
      if (stored) return stored === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  const activeDiagram = diagrams.find((d) => d.id === activeId) || diagrams[0];
  const [code, setCode] = useState(activeDiagram?.code || "");
  const [renderCode, setRenderCode] = useState(code);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderTime, setRenderTime] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [split, setSplit] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [showConfig, setShowConfig] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [isPresentation, setIsPresentation] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showAuthor, setShowAuthor] = useState(false);
  const [filename, setFilename] = useState("diagram");
  const [dragOver, setDragOver] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<PanZoomApi | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // --- Effects ---
  useEffect(() => {
    const d = diagrams.find((x) => x.id === activeId);
    if (d) setCode(d.code);
  }, [activeId, diagrams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DIAGRAMS, JSON.stringify(diagrams));
    } catch {}
  }, [diagrams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE, activeId);
    } catch {}
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_APP_CONFIG, JSON.stringify(appConfig));
    } catch {}
  }, [appConfig]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_DARK, String(isDark));
    } catch {}
  }, [isDark]);

  // Debounce rendering.
  useEffect(() => {
    const id = setTimeout(() => setRenderCode(code), 250);
    return () => clearTimeout(id);
  }, [code]);

  // Parse frontmatter and merge with app config.
  const { effectiveConfig, bodyCode } = useMemo(() => {
    const { config, body } = parseFrontmatter(renderCode);
    const merged: AppConfig = {
      ...appConfig,
      theme: config.theme || appConfig.theme,
      look: config.look || appConfig.look,
      layout: config.layout || appConfig.layout,
      themeVariables: { ...appConfig.themeVariables, ...(config.themeVariables || {}) },
    };
    return { effectiveConfig: merged, bodyCode: body };
  }, [renderCode, appConfig]);

  // Render diagram.
  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    setLoading(true);
    setError(null);

    mermaid.initialize({
      startOnLoad: false,
      theme: effectiveConfig.theme as any,
      look: effectiveConfig.look as any,
      layout: effectiveConfig.layout as any,
      securityLevel: "loose",
      logLevel: "error",
      themeVariables: effectiveConfig.themeVariables,
    });

    mermaid
      .render(`mermaid-${Date.now()}`, bodyCode || renderCode)
      .then(({ svg }) => {
        if (cancelled) return;
        setSvg(svg);
        setError(null);
        setRenderTime(performance.now() - start);
      })
      .catch((err) => {
        if (cancelled) return;
        setSvg("");
        setError(err instanceof Error ? err.message : String(err));
        setRenderTime(performance.now() - start);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [renderCode, effectiveConfig.theme, effectiveConfig.look, effectiveConfig.layout, effectiveConfig.themeVariables]);

  // Panzoom.
  useEffect(() => {
    if (!previewRef.current || !svg) return;
    if (panzoomRef.current) {
      panzoomRef.current.dispose();
      panzoomRef.current = null;
    }
    const pz = panzoom(previewRef.current, {
      bounds: true,
      boundsPadding: 0.1,
      maxZoom: 5,
      minZoom: 0.1,
      initialZoom: 1,
      smoothScroll: false,
      zoomDoubleClickSpeed: 1,
    }) as PanZoomApi;
    panzoomRef.current = pz;
    return () => {
      pz.dispose();
      panzoomRef.current = null;
    };
  }, [svg]);

  // Load from URL hash.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    try {
      const decoded = decodeURIComponent(escape(atob(hash)));
      const name = new URLSearchParams(window.location.search).get("name") || "Shared diagram";
      const newD = { id: uid(), name, code: decoded };
      setDiagrams((prev) => [...prev, newD]);
      setActiveId(newD.id);
      setCode(decoded);
    } catch {
      // ignore
    }
  }, []);

  // Render QR code when sharing.
  useEffect(() => {
    if (!showShare || !qrUrl) return;
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    QRCode.toCanvas(canvas, qrUrl, { width: 180, margin: 2 }).catch(() => {});
  }, [showShare, qrUrl]);

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveActive();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsPresentation((p) => !p);
      }
      if (e.key === "Escape" && isPresentation) {
        setIsPresentation(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPresentation, activeDiagram]);

  // --- Actions ---
  const updateDiagramCode = (newCode: string) => {
    setCode(newCode);
    setDiagrams((prev) => prev.map((d) => (d.id === activeId ? { ...d, code: newCode } : d)));
  };

  const saveActive = () => {
    setDiagrams((prev) =>
      prev.map((d) => (d.id === activeId ? { ...d, code } : d))
    );
  };

  const addDiagram = (sample?: string) => {
    const newD: Diagram = {
      id: uid(),
      name: `Diagram ${diagrams.length + 1}`,
      code: sample ? SAMPLES[sample] || SAMPLES["Flowchart"] : SAMPLES["Flowchart"],
    };
    setDiagrams((prev) => [...prev, newD]);
    setActiveId(newD.id);
  };

  const closeDiagram = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiagrams((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (next.length === 0) {
        const empty = { id: uid(), name: "Diagram 1", code: SAMPLES["Flowchart"] };
        setActiveId(empty.id);
        return [empty];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  const renameDiagram = (id: string, name: string) => {
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {}
  };

  const handleCopySvg = async () => {
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(svg);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 1500);
    } catch {}
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    if (!svg) return;
    const styled = wrapSvgBackground(svg, appConfig.transparent ? undefined : appConfig.background);
    download(new Blob([styled], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`);
  };

  const handleDownloadPng = async () => {
    if (!svg) return;
    const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement as unknown as SVGSVGElement;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const rect = svgEl.viewBox.baseVal;
    const width = rect?.width || svgEl.width.baseVal.value || 800;
    const height = rect?.height || svgEl.height.baseVal.value || 600;
    const scale = 2;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!appConfig.transparent) {
        ctx.fillStyle = appConfig.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        download(pngBlob, `${filename}.png`);
      });
    };
    img.src = url;
  };

  const handleDownloadPng4x = async () => {
    if (!svg) return;
    const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement as unknown as SVGSVGElement;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const rect = svgEl.viewBox.baseVal;
    const width = rect?.width || svgEl.width.baseVal.value || 800;
    const height = rect?.height || svgEl.height.baseVal.value || 600;
    const scale = 4;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!appConfig.transparent) {
        ctx.fillStyle = appConfig.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        download(pngBlob, `${filename}@4x.png`);
      });
    };
    img.src = url;
  };

  const wrapSvgBackground = (svgCode: string, bg?: string) => {
    if (!bg) return svgCode;
    if (svgCode.includes("<svg") && !svgCode.includes("background")) {
      return svgCode.replace("<svg", `<svg style="background:${bg}"`);
    }
    return svgCode;
  };

  const openShare = async () => {
    const encoded = btoa(unescape(encodeURIComponent(code)));
    const url = `${window.location.origin}${window.location.pathname}?name=${encodeURIComponent(activeDiagram.name)}#${encoded}`;
    setQrUrl(url);
    setShowShare(true);
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  };

  const embedMarkdown = `\`\`\`mermaid\n${code}\n\`\`\``;
  const embedImage = `![${activeDiagram.name}](${qrUrl})`;

  const getPreviewCenter = () => {
    const el = previewRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const zoomIn = () => {
    const pz = panzoomRef.current;
    if (!pz) return;
    const { x, y } = getPreviewCenter();
    const { scale } = pz.getTransform();
    pz.zoomAbs(x, y, Math.min(scale * 1.25, 5));
  };

  const zoomOut = () => {
    const pz = panzoomRef.current;
    if (!pz) return;
    const { x, y } = getPreviewCenter();
    const { scale } = pz.getTransform();
    pz.zoomAbs(x, y, Math.max(scale / 1.25, 0.1));
  };

  const zoomReset = () => {
    const pz = panzoomRef.current;
    if (!pz) return;
    const { x, y } = getPreviewCenter();
    pz.zoomAbs(x, y, 1);
    pz.moveTo(0, 0);
  };

  const fitToScreen = () => {
    const pz = panzoomRef.current;
    const wrapper = previewRef.current;
    if (!pz || !wrapper) return;
    const svgEl = wrapper.querySelector("svg") as SVGSVGElement | null;
    if (!svgEl) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const vb = svgEl.viewBox.baseVal;
    const svgWidth = vb?.width || svgEl.width.baseVal.value || wrapperRect.width;
    const svgHeight = vb?.height || svgEl.height.baseVal.value || wrapperRect.height;
    const scale = Math.min(wrapperRect.width / svgWidth, wrapperRect.height / svgHeight, 1);
    const { x, y } = getPreviewCenter();
    pz.zoomAbs(x, y, scale);
    pz.moveTo((wrapperRect.width - svgWidth * scale) / 2, (wrapperRect.height - svgHeight * scale) / 2);
  };

  // Drag split pane.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      if (orientation === "horizontal") {
        const pct = Math.min(80, Math.max(20, (e.clientX / window.innerWidth) * 100));
        setSplit(pct);
      } else {
        const pct = Math.min(80, Math.max(20, (e.clientY / window.innerHeight) * 100));
        setSplit(pct);
      }
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, orientation]);

  // Drag & drop import.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    importFile(file);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const name = file.name.replace(/\.mmd$|\.md$|\.txt$/, "") || "Imported";
      const newD = { id: uid(), name, code: text };
      setDiagrams((prev) => [...prev, newD]);
      setActiveId(newD.id);
    };
    reader.readAsText(file);
  };

  // Diagram type detection.
  const diagramType = useMemo(() => {
    const firstLine = renderCode.split("\n")[0].trim().toLowerCase();
    if (firstLine.startsWith("graph ") || firstLine.startsWith("flowchart ")) return "Flowchart";
    if (firstLine.startsWith("sequence")) return "Sequence";
    if (firstLine.startsWith("class")) return "Class";
    if (firstLine.startsWith("state")) return "State";
    if (firstLine.startsWith("er")) return "ER";
    if (firstLine.startsWith("gantt")) return "Gantt";
    if (firstLine.startsWith("pie")) return "Pie";
    if (firstLine.startsWith("gitgraph")) return "Git Graph";
    if (firstLine.startsWith("mindmap")) return "Mindmap";
    if (firstLine.startsWith("journey")) return "User Journey";
    if (firstLine.startsWith("timeline")) return "Timeline";
    if (firstLine.startsWith("quadrant")) return "Quadrant";
    if (firstLine.startsWith("requirement")) return "Requirement";
    if (firstLine.startsWith("sankey")) return "Sankey";
    if (firstLine.startsWith("c4")) return "C4";
    return "Unknown";
  }, [renderCode]);

  // --- UI ---
  const editorPane = (
    <div
      className={`flex min-w-0 flex-col border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        orientation === "horizontal" ? "border-r" : "border-b"
      }`}
      style={{ [orientation === "horizontal" ? "width" : "height"]: `${split}%` }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
        <span>Editor</span>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{diagramType}</span>
          <button
            onClick={() => setShowMinimap((m) => !m)}
            title="Toggle minimap"
            className={`rounded px-1.5 py-0.5 transition ${showMinimap ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            Map
          </button>
          <div className="flex items-center gap-1">
            <Type className="h-3 w-3" />
            <input
              type="range"
              min={10}
              max={24}
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(Number(e.target.value))}
              className="w-16"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          value={code}
          onChange={(v) => updateDiagramCode(v || "")}
          language="mermaid"
          theme={isDark ? "vs-dark" : "vs-light"}
          options={{
            minimap: { enabled: showMinimap },
            fontSize: editorFontSize,
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            renderLineHighlight: "all",
            padding: { top: 12 },
          }}
          onMount={(ed) => {
            editorRef.current = ed;
          }}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading editor…
            </div>
          }
        />
      </div>
    </div>
  );

  const previewPane = (
    <div className="relative flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-xs text-slate-500">Preview</span>
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} title="Zoom out" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={zoomReset} title="Reset pan" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={zoomIn} title="Zoom in" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={fitToScreen} title="Fit to screen" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Maximize className="h-4 w-4" />
          </button>
          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={() => setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"))}
            title="Toggle layout"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {orientation === "horizontal" ? <span className="text-xs font-bold">↔</span> : <span className="text-xs font-bold">↕</span>}
          </button>
          <button
            onClick={() => setIsPresentation((p) => !p)}
            title="Presentation mode (Ctrl+Shift+P)"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Fullscreen className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowConfig((s) => !s)}
            title="Config"
            className={`rounded p-1 transition ${showConfig ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="max-h-48 overflow-y-auto border-b border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              Theme
              <select
                value={appConfig.theme}
                onChange={(e) => setAppConfig((c) => ({ ...c, theme: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800"
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {formatThemeName(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              Look
              <select
                value={appConfig.look}
                onChange={(e) => setAppConfig((c) => ({ ...c, look: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800"
              >
                {LOOKS.map((l) => (
                  <option key={l} value={l}>
                    {formatThemeName(l)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              Layout
              <select
                value={appConfig.layout}
                onChange={(e) => setAppConfig((c) => ({ ...c, layout: e.target.value }))}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800"
              >
                {LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              Background
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={appConfig.background}
                  onChange={(e) => setAppConfig((c) => ({ ...c, background: e.target.value }))}
                  className="h-7 w-8 rounded border border-slate-300 p-0 dark:border-slate-700"
                />
                <input
                  type="text"
                  value={appConfig.background}
                  onChange={(e) => setAppConfig((c) => ({ ...c, background: e.target.value }))}
                  className="w-20 rounded border border-slate-300 px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={appConfig.transparent}
              onChange={(e) => setAppConfig((c) => ({ ...c, transparent: e.target.checked }))}
              className="rounded"
            />
            Transparent export background
          </label>
          <div className="mt-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">themeVariables JSON</label>
            <textarea
              value={JSON.stringify(appConfig.themeVariables, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setAppConfig((c) => ({ ...c, themeVariables: parsed }));
                } catch {}
              }}
              className="mt-1 h-16 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      )}

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{ background: appConfig.transparent ? undefined : appConfig.background }}
      >
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex items-center rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-500 shadow-sm backdrop-blur dark:bg-slate-900/80">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Rendering…
            </div>
          </div>
        )}

        {error ? (
          <div className="mx-4 max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <RefreshCw className="h-4 w-4" />
              Syntax Error
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
          </div>
        ) : (
          <div
            ref={previewRef}
            className="cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div
      className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-pink-500/20 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-6 py-4 text-lg font-medium shadow-lg dark:bg-slate-900">
            Drop a .mmd / .md / .txt file to import
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 491 491" className="h-9 w-9" aria-label="Mermaid logo">
            <path
              fill="#ff3670"
              d="M490.16,84.61C490.16,37.912 452.248,0 405.55,0L84.61,0C37.912,0 0,37.912 0,84.61L0,405.55C0,452.248 37.912,490.16 84.61,490.16L405.55,490.16C452.248,490.16 490.16,452.248 490.16,405.55L490.16,84.61Z"
            />
            <path
              fill="#ffffff"
              d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z"
            />
          </svg>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Mermaid Live Editor</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Live diagram compiler</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value=""
            onChange={(e) => e.target.value && addDiagram(e.target.value)}
            className="hidden rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-pink-500 sm:block dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">+ New from sample</option>
            {Object.keys(SAMPLES).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            onClick={() => addDiagram()}
            title="New diagram"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import file"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mmd,.md,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />

          <button
            onClick={saveActive}
            title="Save (Ctrl+S)"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
          </button>

          <button
            onClick={handleCopyCode}
            title="Copy code"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>

          <div className="relative group">
            <button
              title="Download"
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full z-20 hidden w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-800">
              <button onClick={handleDownloadSvg} disabled={!svg} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                Download SVG
              </button>
              <button onClick={handleCopySvg} disabled={!svg} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                {copiedSvg ? "SVG copied" : "Copy SVG"}
              </button>
              <button onClick={handleDownloadPng} disabled={!svg} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                Download PNG (2×)
              </button>
              <button onClick={handleDownloadPng4x} disabled={!svg} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                Download PNG (4×)
              </button>
            </div>
          </div>

          <button
            onClick={openShare}
            title="Share"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Share2 className="h-4 w-4" />
          </button>

          <button
            onClick={() => setShowShortcuts(true)}
            title="Shortcuts"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <button
            onClick={() => setShowAuthor(true)}
            title="About"
            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>

          <button
            onClick={() => setIsDark((d) => !d)}
            title="Toggle dark mode"
            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/50">
        {diagrams.map((d) => (
          <div
            key={d.id}
            onClick={() => setActiveId(d.id)}
            className={`group flex min-w-0 max-w-[160px] cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition ${
              activeId === d.id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => renameDiagram(d.id, e.currentTarget.textContent || d.name)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="truncate outline-none"
            >
              {d.name}
            </span>
            <button
              onClick={(e) => closeDiagram(d.id, e)}
              className="rounded p-0.5 opacity-0 transition hover:bg-slate-200 group-hover:opacity-100 dark:hover:bg-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Main workspace */}
      <main
        className={`relative flex flex-1 overflow-hidden ${
          orientation === "horizontal" ? "flex-row" : "flex-col"
        }`}
      >
        {editorPane}

        <div
          onMouseDown={() => setIsDragging(true)}
          className={`z-10 flex shrink-0 items-center justify-center bg-slate-200 transition hover:bg-pink-500 dark:bg-slate-800 ${
            orientation === "horizontal" ? "cursor-col-resize w-1.5" : "cursor-row-resize h-1.5 w-full"
          } ${isDragging ? "bg-pink-500" : ""}`}
        />

        {previewPane}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${error ? "bg-red-500" : svg ? "bg-green-500" : "bg-amber-500"}`} />
            {error ? "Error" : svg ? "Ready" : "Loading"}
          </span>
          <span>{code.split("\n").length} lines</span>
          <span>{code.length} chars</span>
          <span>{renderTime.toFixed(0)} ms</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Parithosh-Varma"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-500 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-400 transition"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Parithosh Varma
          </a>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <a
            href="https://mermaidlive.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-pink-600 dark:hover:text-pink-400 transition"
          >
            mermaidlive.netlify.app
          </a>
          <span className="hidden sm:inline">· drag to pan, scroll to zoom</span>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-28 rounded border border-slate-300 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            placeholder="filename"
          />
        </div>
      </footer>

      {/* Presentation overlay */}
      {isPresentation && (
        <div className="fixed inset-0 z-40 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white">
            <span className="text-sm font-medium">{activeDiagram.name}</span>
            <button onClick={() => setIsPresentation(false)} className="rounded p-1 hover:bg-slate-800">
              <Minimize className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <div
              className="cursor-grab active:cursor-grabbing"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share diagram</h3>
              <button onClick={() => setShowShare(false)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Share URL (copied)</label>
                <input
                  readOnly
                  value={qrUrl}
                  className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-center">
                <canvas id="qr-canvas" className="rounded border border-slate-200 dark:border-slate-700" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-500">Markdown embed</label>
                  <button
                    onClick={() => navigator.clipboard.writeText(embedMarkdown)}
                    className="text-xs text-pink-600 hover:underline dark:text-pink-400"
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  readOnly
                  value={embedMarkdown}
                  className="mt-1 h-20 w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-500">Image markdown</label>
                  <button
                    onClick={() => navigator.clipboard.writeText(embedImage)}
                    className="text-xs text-pink-600 hover:underline dark:text-pink-400"
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  readOnly
                  value={embedImage}
                  className="mt-1 h-16 w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Author card modal */}
      {showAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAuthor(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowAuthor(false)}
              className="absolute -right-10 top-0 rounded p-1 text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            <AuthorCard />
          </div>
        </div>
      )}

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Keyboard shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Save diagram</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">Ctrl+S</kbd></div>
              <div className="flex justify-between"><span>Presentation mode</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">Ctrl+Shift+P</kbd></div>
              <div className="flex justify-between"><span>Shortcuts</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">Ctrl+K</kbd></div>
              <div className="flex justify-between"><span>Exit presentation</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">Esc</kbd></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
