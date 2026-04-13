import { useState, useRef, useEffect, useCallback } from "react";
import { useStore, Template, GradingResult } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileUp, ListChecks, CheckCircle2, XCircle, Play,
  Save, RefreshCw, AlertTriangle, Camera, ImageIcon
} from "lucide-react";
import { Link } from "wouter";
import { processOMRImage, DetectedAnswer } from "@/lib/omr-processor";
import { useToast } from "@/hooks/use-toast";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

export default function Home() {
  const { templates, addResult } = useStore();
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [gridRect, setGridRect] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<DetectedAnswer[] | null>(null);
  const [studentName, setStudentName] = useState("");

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // When template is selected, seed the grid from its saved config
  useEffect(() => {
    if (selectedTemplate?.gridConfig) {
      setGridRect(selectedTemplate.gridConfig);
    } else {
      setGridRect({ x: 10, y: 10, w: 80, h: 80 });
    }
    setResults(null);
  }, [selectedTemplateId]);

  const handleFileSelect = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResults(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  };

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    if (handle) setIsResizing(handle);
    else setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = getContainerRect();
    if (!rect) return;
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100;

    if (isDragging) {
      setGridRect((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(100 - prev.w, prev.x + dx)),
        y: Math.max(0, Math.min(100 - prev.h, prev.y + dy)),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isResizing) {
      setGridRect((prev) => {
        let { x, y, w, h } = prev;
        if (isResizing.includes("e")) w = Math.max(10, Math.min(100 - x, w + dx));
        if (isResizing.includes("s")) h = Math.max(10, Math.min(100 - y, h + dy));
        if (isResizing.includes("w")) {
          const newX = Math.max(0, Math.min(x + w - 10, x + dx));
          w = w - (newX - x);
          x = newX;
        }
        if (isResizing.includes("n")) {
          const newY = Math.max(0, Math.min(y + h - 10, y + dy));
          h = h - (newY - y);
          y = newY;
        }
        return { x, y, w, h };
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(null);
  };

  const handleProcess = async () => {
    if (!imageRef.current || !selectedTemplate) return;
    setIsProcessing(true);
    try {
      const bounds = {
        x: (gridRect.x / 100) * naturalSize.width,
        y: (gridRect.y / 100) * naturalSize.height,
        width: (gridRect.w / 100) * naturalSize.width,
        height: (gridRect.h / 100) * naturalSize.height,
      };
      const detected = await processOMRImage(imageRef.current, selectedTemplate, bounds);
      setResults(detected);
    } catch {
      toast({ title: "Processing failed", description: "Could not analyze the image.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveResult = () => {
    if (!selectedTemplate || !results) return;
    const score = results.filter((r, i) => r.answer === selectedTemplate.correctAnswers[i]).length;

    const newResult: GradingResult = {
      id: crypto.randomUUID(),
      templateId: selectedTemplate.id,
      studentName: studentName.trim() || "Anonymous",
      answers: results.map((r) => r.answer),
      score,
      totalQuestions: selectedTemplate.questionCount,
      detectedAnswers: results,
      gradedAt: Date.now(),
    };

    addResult(newResult);
    toast({ title: "Result saved", description: `Scored ${score}/${selectedTemplate.questionCount}` });
    setImageUrl(null);
    setResults(null);
    setStudentName("");
  };

  const toggleManualAnswer = (qIdx: number, option: string) => {
    if (!results) return;
    const updated = [...results];
    updated[qIdx] = {
      ...updated[qIdx],
      answer: updated[qIdx].answer === option ? "" : option,
      confidence: 100,
    };
    setResults(updated);
  };

  if (templates.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grade Sheet</h1>
          <p className="text-muted-foreground mt-1">Upload a student OMR sheet and compare it to a template.</p>
        </div>
        <Card className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <ListChecks className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">No Templates Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              First, go to Templates and fill in the correct answers for each question to create an answer key.
            </p>
          </div>
          <Link href="/templates">
            <Button className="mt-2 gap-2">
              <Camera className="h-4 w-4" />
              Create a Template
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const scoreCount = results && selectedTemplate
    ? results.filter((r, i) => r.answer === selectedTemplate.correctAnswers[i]).length
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grade Sheet</h1>
        <p className="text-muted-foreground mt-1">Select a template and upload a student sheet to begin.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left panel */}
        <div className="lg:col-span-4 space-y-5">

          {/* 1. Template selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                1. Answer Key Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  data-testid={`select-template-${t.id}`}
                  onClick={() => { setSelectedTemplateId(t.id); setResults(null); setImageUrl(null); }}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent ${
                    selectedTemplateId === t.id
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.questionCount}q · {t.optionsPerQuestion} opts
                    </div>
                  </div>
                  {selectedTemplateId === t.id && (
                    <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* 2. Upload student sheet */}
          <Card className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                2. Upload Student Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                data-testid="upload-student-zone"
                className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-8 text-center transition-all hover:bg-accent/40 hover:border-primary/40 cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                {imageUrl ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Image loaded — align grid below</span>
                  </div>
                ) : (
                  <>
                    <Camera className="h-7 w-7 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Snap or upload student sheet</p>
                    <p className="text-xs text-muted-foreground mt-1">Camera · photo · scan</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Detect */}
          {imageUrl && !results && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  3. Detect Answers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Drag and resize the grid overlay on the image to align with the bubbles, then run detection.
                </p>
                <Button
                  data-testid="button-run-detection"
                  className="w-full gap-2"
                  onClick={handleProcess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isProcessing ? "Detecting..." : "Run Detection"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 4. Results panel */}
          {results && selectedTemplate && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Score</CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-base font-bold px-3 py-1 ${
                      scoreCount / selectedTemplate.questionCount >= 0.8
                        ? "border-green-500 text-green-600"
                        : scoreCount / selectedTemplate.questionCount >= 0.6
                        ? "border-amber-500 text-amber-600"
                        : "border-red-500 text-red-600"
                    }`}
                  >
                    {Math.round((scoreCount / selectedTemplate.questionCount) * 100)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-2">
                  <span className="text-5xl font-black text-primary">{scoreCount}</span>
                  <span className="text-2xl text-muted-foreground font-medium">
                    /{selectedTemplate.questionCount}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">correct answers</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student-name" className="text-xs">Student Name (optional)</Label>
                  <Input
                    id="student-name"
                    data-testid="input-student-name"
                    placeholder="Enter name..."
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setResults(null)}
                  >
                    Re-align Grid
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1 text-xs"
                    onClick={handleSaveResult}
                    data-testid="button-save-result"
                  >
                    <Save className="h-3 w-3" />
                    Save Result
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: image workspace */}
        <div className="lg:col-span-8">
          <Card className="flex flex-col overflow-hidden" style={{ height: 600 }}>
            <CardHeader className="py-2 px-4 border-b bg-muted/30 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Workspace</span>
                {results && (
                  <span className="text-xs text-muted-foreground">
                    Click bubbles to manually correct detections
                  </span>
                )}
                {!results && imageUrl && (
                  <span className="text-xs text-muted-foreground">
                    Drag grid to align · resize handles at corners/edges
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 relative overflow-auto bg-black/5">
              {!imageUrl ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 p-8 text-center">
                  <FileUp className="h-12 w-12 text-muted-foreground/20" />
                  <div>
                    <p className="text-sm font-medium">No image loaded</p>
                    <p className="text-xs mt-1">Select a template and upload a student sheet to begin</p>
                  </div>
                </div>
              ) : (
                <div
                  ref={containerRef}
                  className="relative inline-block min-w-full select-none"
                  style={{ minHeight: "100%" }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Student OMR Sheet"
                    className="block w-full object-contain"
                    onLoad={handleImageLoad}
                    draggable={false}
                  />

                  {/* Grid overlay (alignment mode) */}
                  {!results && selectedTemplate && (
                    <div
                      className="absolute border-2 border-blue-500 bg-blue-500/5 cursor-move"
                      style={{
                        left: `${gridRect.x}%`,
                        top: `${gridRect.y}%`,
                        width: `${gridRect.w}%`,
                        height: `${gridRect.h}%`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e)}
                    >
                      <div className="absolute inset-0 flex flex-col pointer-events-none">
                        {Array.from({ length: selectedTemplate.questionCount }).map((_, qIdx) => (
                          <div key={qIdx} className="flex-1 border-b border-blue-400/30 flex">
                            {Array.from({ length: selectedTemplate.optionsPerQuestion }).map((_, oIdx) => (
                              <div key={oIdx} className="flex-1 border-r border-blue-400/30 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-blue-400/50" />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      {[
                        { pos: "nw", cursor: "nwse-resize", style: { top: -5, left: -5 } },
                        { pos: "ne", cursor: "nesw-resize", style: { top: -5, right: -5 } },
                        { pos: "sw", cursor: "nesw-resize", style: { bottom: -5, left: -5 } },
                        { pos: "se", cursor: "nwse-resize", style: { bottom: -5, right: -5 } },
                        { pos: "n", cursor: "ns-resize", style: { top: -5, left: "calc(50% - 5px)" } },
                        { pos: "s", cursor: "ns-resize", style: { bottom: -5, left: "calc(50% - 5px)" } },
                        { pos: "w", cursor: "ew-resize", style: { top: "calc(50% - 5px)", left: -5 } },
                        { pos: "e", cursor: "ew-resize", style: { top: "calc(50% - 5px)", right: -5 } },
                      ].map((h) => (
                        <div
                          key={h.pos}
                          className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-sm z-10"
                          style={{ cursor: h.cursor, ...h.style as React.CSSProperties }}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, h.pos); }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Results overlay */}
                  {results && selectedTemplate && (
                    <div
                      className="absolute"
                      style={{
                        left: `${gridRect.x}%`,
                        top: `${gridRect.y}%`,
                        width: `${gridRect.w}%`,
                        height: `${gridRect.h}%`,
                      }}
                    >
                      <div className="absolute inset-0 flex flex-col">
                        {Array.from({ length: selectedTemplate.questionCount }).map((_, qIdx) => {
                          const isCorrect = results[qIdx].answer === selectedTemplate.correctAnswers[qIdx];
                          const lowConf = results[qIdx].confidence < 50 && results[qIdx].answer !== "";

                          return (
                            <div key={qIdx} className="flex-1 flex relative">
                              <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/90 dark:bg-black/70 px-1 py-0.5 rounded text-xs font-bold shadow">
                                <span>{qIdx + 1}</span>
                                {isCorrect
                                  ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  : <XCircle className="w-3 h-3 text-red-500" />
                                }
                              </div>
                              {lowConf && (
                                <div className="absolute -right-5 top-1/2 -translate-y-1/2 text-amber-500">
                                  <AlertTriangle className="w-3 h-3" />
                                </div>
                              )}
                              {Array.from({ length: selectedTemplate.optionsPerQuestion }).map((_, oIdx) => {
                                const option = OPTION_LABELS[oIdx];
                                const isDetected = results[qIdx].answer === option;
                                const isKey = selectedTemplate.correctAnswers[qIdx] === option;

                                let cls = "border-transparent bg-transparent hover:bg-black/10";
                                if (isDetected && isKey) cls = "border-green-500 bg-green-500/40";
                                else if (isDetected && !isKey) cls = "border-red-500 bg-red-500/40";
                                else if (!isDetected && isKey) cls = "border-blue-500 border-dashed";

                                return (
                                  <div key={oIdx} className="flex-1 flex items-center justify-center">
                                    <button
                                      className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full border-2 transition-all ${cls}`}
                                      onClick={() => toggleManualAnswer(qIdx, option)}
                                      data-testid={`result-q${qIdx + 1}-${option}`}
                                      title={`Q${qIdx + 1}: ${option}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
