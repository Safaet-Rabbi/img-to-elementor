import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Download, 
  Check, 
  Code, 
  FolderTree, 
  Palette, 
  Type, 
  Box,
  Image as ImageIcon,
  ExternalLink,
  MousePointer,
  Hash,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DIRInspectorProps {
  dirData: Record<string, unknown> | null;
  className?: string;
}

function countTotalNodes(nodes: Array<Record<string, unknown>>): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    const children = (node.children || node.elements || node.nodes || []) as Array<Record<string, unknown>>;
    if (children.length > 0) {
      count += countTotalNodes(children);
    }
  }
  return count;
}

function stripHtml(html?: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}

export function DIRInspector({ dirData, className }: DIRInspectorProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [copied, setCopied] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  if (!dirData) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No DIR JSON artifact available yet for this project.
      </div>
    );
  }

  const jsonString = JSON.stringify(dirData, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dir-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleNode = (id: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Extract high-level DIR metadata
  const meta = (dirData.meta as Record<string, unknown>) || {};
  const globals = (dirData.globals as Record<string, unknown>) || {};
  const colors = (globals.colors as Record<string, string>) || {};
  const pages = (dirData.pages as Array<Record<string, unknown>>) || [];
  const confidence = typeof meta.confidenceScore === 'number' ? meta.confidenceScore : 0.95;

  const renderNodeTree = (nodes: Array<Record<string, unknown>>, parentKey: string, depth = 0) => {
    return nodes.map((node, nodeIdx) => {
      const nodeKey = `${parentKey}-node-${node.id || nodeIdx}`;
      const isNodeCollapsed = collapsedNodes[nodeKey];
      const children = (node.children || node.elements || node.nodes || []) as Array<Record<string, unknown>>;
      const hasChildren = children.length > 0;
      const kind = String(node.kind || node.type || 'element');
      const text = String(node.text || node.heading || node.alt || (node.html ? stripHtml(String(node.html)) : '') || '');
      const responsiveOverrides = node.responsiveOverrides as Record<string, unknown> | undefined;
      const hasResponsive = Boolean(responsiveOverrides && Object.keys(responsiveOverrides).length > 0);

      // Icon determination
      let icon = <Box className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
      if (kind === 'image') icon = <ImageIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />;
      else if (kind === 'heading') icon = <Type className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
      else if (kind === 'text') icon = <Code className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      else if (kind === 'button') icon = <MousePointer className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
      else if (kind === 'link') icon = <ExternalLink className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
      else if (kind === 'counter') icon = <Hash className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
      else if (kind === 'badge') icon = <Sparkles className="h-3.5 w-3.5 text-lime-400 shrink-0" />;

      if (hasChildren) {
        const nestedCount = countTotalNodes(children);
        return (
          <div key={nodeKey} className="rounded border border-border/40 bg-card/40 my-1 overflow-hidden">
            <div
              onClick={() => toggleNode(nodeKey)}
              className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-xs hover:bg-secondary/40 select-none transition-colors"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {isNodeCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-mono text-[11px] font-semibold text-primary">{kind}</span>
                {Boolean(node.direction) && (
                  <span className="text-[10px] text-muted-foreground font-mono">[{String(node.direction)}]</span>
                )}
                {Boolean(node.columns) && (
                  <span className="text-[10px] text-muted-foreground font-mono">[{String(node.columns)} cols]</span>
                )}
                {hasResponsive && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded font-mono">
                    <Smartphone className="h-2.5 w-2.5" />
                    resp
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {nestedCount} node{nestedCount === 1 ? '' : 's'}
                </span>
                {node.confidence !== undefined && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {Math.round(Number(node.confidence) * 100)}%
                  </span>
                )}
              </div>
            </div>

            {!isNodeCollapsed && (
              <div className="pl-4 pr-1.5 py-1 border-l-2 border-border/40 ml-2 space-y-1">
                {renderNodeTree(children, nodeKey, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // Leaf Node
      return (
        <div
          key={nodeKey}
          className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-secondary/30 text-xs transition-colors"
        >
          <div className="flex items-center gap-2 truncate pr-2">
            {icon}
            <span className="font-mono text-[11px] text-foreground font-medium">{kind}</span>
            {Boolean(node.level) && (
              <span className="text-[10px] font-mono text-amber-400 font-bold">H{String(node.level)}</span>
            )}
            {Boolean(text) && (
              <span className="truncate text-[11px] text-muted-foreground italic">&quot;{text}&quot;</span>
            )}
            {kind === 'counter' && node.value !== undefined && (
              <span className="text-[11px] font-mono font-bold text-purple-400">
                {String(node.prefix || '')}{String(node.value)}{String(node.suffix || '')}
              </span>
            )}
            {Boolean(node.assetId) && (
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1 rounded truncate">
                {String(node.assetId)}
              </span>
            )}
            {hasResponsive && (
              <span className="flex items-center gap-0.5 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded font-mono shrink-0">
                <Smartphone className="h-2.5 w-2.5" />
                resp
              </span>
            )}
          </div>
          {node.confidence !== undefined && (
            <span className="text-[10px] text-emerald-400 font-mono shrink-0">
              {Math.round(Number(node.confidence) * 100)}%
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className || ''}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-sm">
            <FolderTree className="h-4 w-4 text-primary" />
            <span>DIR Architecture Inspector</span>
          </div>
          <Badge variant="success" withDot>
            {Math.round(confidence * 100)}% Confidence
          </Badge>
          {meta.analysisModel ? (
            <span className="hidden sm:inline-block text-xs font-mono text-muted-foreground">
              {String(meta.analysisModel)}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode switch */}
          <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === 'tree' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" />
              Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === 'raw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              JSON
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleCopy} leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} leftIcon={<Download className="h-3.5 w-3.5" />}>
            Download
          </Button>
        </div>
      </div>

      {/* Body */}
      {viewMode === 'raw' ? (
        <div className="max-h-[600px] overflow-auto p-4 bg-muted/20 font-mono text-xs">
          <pre className="text-foreground leading-relaxed">{jsonString}</pre>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-auto p-5 space-y-6">
          {/* Globals preview */}
          {Object.keys(colors).length > 0 && (
            <div className="rounded-lg border border-border/80 bg-background/50 p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Detected Color Palette
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(colors).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1 text-xs">
                    <span className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: val }} />
                    <span className="text-muted-foreground font-mono text-[11px]">{key}:</span>
                    <span className="font-mono font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Structured hierarchy */}
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5" />
              Identified Sections & Elements ({pages.length} Pages/Viewports)
            </span>

            {pages.map((page, pageIdx) => {
              const sections = (page.sections as Array<Record<string, unknown>>) || [];
              const pageKey = `page-${pageIdx}`;
              const isPageCollapsed = collapsedNodes[pageKey];
              let totalPageElements = 0;
              for (const s of sections) {
                const sChildren = (s.children || s.nodes || s.elements || []) as Array<Record<string, unknown>>;
                totalPageElements += countTotalNodes(sChildren);
              }

              return (
                <div key={pageKey} className="rounded-lg border border-border/80 bg-card/60 overflow-hidden">
                  <div
                    onClick={() => toggleNode(pageKey)}
                    className="flex cursor-pointer items-center justify-between bg-secondary/40 px-3 py-2 text-xs font-semibold hover:bg-secondary/60 select-none"
                  >
                    <div className="flex items-center gap-2">
                      {isPageCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span>Page: {String(page.name || `Viewport #${pageIdx + 1}`)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{sections.length} Sections</Badge>
                      <Badge variant="neutral">{totalPageElements} Elements</Badge>
                    </div>
                  </div>

                  {!isPageCollapsed && (
                    <div className="p-3 space-y-2.5">
                      {sections.map((section, secIdx) => {
                        const secKey = `${pageKey}-sec-${secIdx}`;
                        const isSecCollapsed = collapsedNodes[secKey];
                        const role = String(section.role || 'content');
                        const children = (section.children || section.nodes || section.elements || []) as Array<Record<string, unknown>>;
                        const totalElements = countTotalNodes(children);

                        return (
                          <div key={secKey} className="rounded border border-border/60 bg-background/50 pl-3 pr-3 py-2">
                            <div
                              onClick={() => toggleNode(secKey)}
                              className="flex cursor-pointer items-center justify-between text-xs select-none"
                            >
                              <div className="flex items-center gap-2">
                                {isSecCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                <span className="font-medium text-foreground capitalize">
                                  {role} Section #{secIdx + 1}
                                </span>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {totalElements} element{totalElements === 1 ? '' : 's'}
                              </span>
                            </div>

                            {!isSecCollapsed && children.length > 0 && (
                              <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-border/40 text-xs">
                                {renderNodeTree(children, secKey)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
