import { useState, useRef, useCallback } from "react";
import { useStore, Template } from "@/lib/store";
import { processOMRImage, DetectedAnswer } from "@/lib/omr-processor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Camera, Upload, ArrowRight, ArrowLeft,
  RefreshCw, CheckCircle2, ImageIcon, ScanLine, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

type WizardStep = "idle" | "upload" | "align" | "review";

export default function Templates() {
  const { templates, addTemplate, deleteTemplate } = useStore();
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>("idle");
  const [name, setName] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [optionsPerQuestion, setOptionsPerQuestion] = useState(4);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [gridRect, setGridRect] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedAnswers, setDetectedAnswers] = useState<DetectedAnswer[] | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = () => {
    setStep("idle");
    setName("");
    setQuestionCount(20);
    setOptionsPerQuestion(4);
    setImageUrl(null);
    setImageDataUrl(null);
    setNaturalSize({ width: 0, height: 0 });
    setGridRect({ x: 10, y: 10, w: 80, h: 80 });
    setDetectedAnswers(null);
  };

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageDataUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  }, []);

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
    if (handle) {
      setIsResizing(handle);
    } else {
      setIsDragging(true);
    }
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

  const handleDetect = async () => {
    if (!imageRef.current) return;
    setIsProcessing(true);
    try {
      const bounds = {
        x: (gridRect.x / 100) * naturalSize.width,
        y: (gridRect.y / 100) * naturalSize.height,
        width: (gridRect.w / 100) * naturalSize.width,
        height: (gridRect.h / 100) * naturalSize.height,
      };

      const mockTemplate = {
        id: "",
        name: "",
        questionCount,
        optionsPerQuestion,
        correctAnswers: [],
        createdAt: 0,
      };

      const detected = await processOMRImage(imageRef.current, mockTemplate, bounds);
      setDetectedAnswers(detected);
      setStep("review");
    } catch {
      toast({ title: "Detection failed", description: "Could not analyze the image.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAnswer = (qIdx: number, option: string) => {
    if (!detectedAnswers) return;
    const updated = [...detectedAnswers];
    updated[qIdx] = {
      ...updated[qIdx],
      answer: updated[qIdx].answer === option ? "" : option,
      confidence: 100,
    };
    setDetectedAnswers(updated);
  };

  const handleSaveTemplate = () => {
    if (!detectedAnswers || !name.trim()) return;

    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name: name.trim(),
      questionCount,
      optionsPerQuestion,
      correctAnswers: detectedAnswers.map((d) => d.answer),
      gridConfig: { ...gridRect },
      templateImageDataUrl: imageDataUrl || undefined,
      createdAt: Date.now(),
    };

    addTemplate(newTemplate);
    toast({ title: "Template saved", description: `"${name}" is ready to use for grading.` });
    resetWizard();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Upload a photo of a correctly filled OMR sheet to create a scoring template.
          </p>
        </div>
        {step === "idle" && (
          <Button onClick={() => setStep("upload")} className="gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {/* === WIZARD === */}
      {step !== "idle" && (
        <Card className="border-primary/30 shadow-md">
          {/* Step indicator */}
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(["upload", "align", "review"] as WizardStep[]).map((s, i) => {
                  const stepIndex = ["upload", "align", "review"].indexOf(step);
                  const thisIndex = i;
                  const isActive = s === step;
                  const isDone = thisIndex < stepIndex;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isDone ? "bg-primary text-primary-foreground" :
                        isActive ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`text-sm font-medium hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {s === "upload" ? "Upload Sheet" : s === "align" ? "Align Grid" : "Review Answers"}
                      </span>
                      {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" size="icon" onClick={resetWizard} title="Cancel">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* STEP 1: Upload */}
          {step === "upload" && (
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-name">Template Name</Label>
                    <Input
                      id="tpl-name"
                      data-testid="input-template-name"
                      placeholder="e.g. Midterm Exam 2025"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tpl-questions">Questions</Label>
                      <Input
                        id="tpl-questions"
                        type="number"
                        min={1}
                        max={100}
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 20))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tpl-options">Options (A–?)</Label>
                      <Input
                        id="tpl-options"
                        type="number"
                        min={2}
                        max={5}
                        value={optionsPerQuestion}
                        onChange={(e) => setOptionsPerQuestion(Math.max(2, Math.min(5, parseInt(e.target.value) || 4)))}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <strong>Tip:</strong> Take a clear, well-lit photo of the answer key sheet with all correct answers shaded. Lay it flat to avoid shadows and warping.
                  </div>
                </div>

                {/* Upload Zone */}
                <div>
                  {imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden border bg-muted h-64">
                      <img src={imageUrl} alt="Template preview" className="w-full h-full object-contain" />
                      <button
                        onClick={() => { setImageUrl(null); setImageDataUrl(null); }}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      data-testid="upload-template-zone"
                      className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 h-64 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-3 text-center px-4">
                        <div className="rounded-full bg-primary/10 p-4">
                          <Camera className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Snap or upload the answer key sheet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            The sheet with ALL correct answers already shaded
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Upload className="h-3 w-3" /> Browse files
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Camera className="h-3 w-3" /> Take photo
                          </Badge>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}

          {/* STEP 2: Align Grid */}
          {step === "align" && imageUrl && (
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Drag and resize the blue grid to cover exactly the bubble area of your OMR sheet.
                The grid lines should line up with each row of questions and each column of options.
              </p>
              <div
                ref={containerRef}
                className="relative select-none overflow-hidden rounded-lg border bg-muted/10 cursor-crosshair"
                style={{ maxHeight: 500 }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="OMR sheet"
                  className="w-full block object-contain"
                  onLoad={handleImageLoad}
                  draggable={false}
                />

                {/* Grid overlay */}
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
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col pointer-events-none">
                    {Array.from({ length: questionCount }).map((_, qIdx) => (
                      <div key={qIdx} className="flex-1 border-b border-blue-400/40 flex">
                        {Array.from({ length: optionsPerQuestion }).map((_, oIdx) => (
                          <div key={oIdx} className="flex-1 border-r border-blue-400/40 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-blue-400/60" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Resize handles */}
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
              </div>
            </CardContent>
          )}

          {/* STEP 3: Review */}
          {step === "review" && detectedAnswers && (
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                These are the answers detected from the template photo. Click any bubble to correct a misread answer before saving.
              </p>
              <div className="rounded-lg border bg-muted/20 p-4 overflow-y-auto max-h-[420px]">
                <div className="grid gap-2">
                  {detectedAnswers.map((d, qIdx) => (
                    <div key={qIdx} className="flex items-center gap-3">
                      <span className="w-7 text-right text-sm font-mono text-muted-foreground shrink-0">
                        {qIdx + 1}.
                      </span>
                      <div className="flex gap-2">
                        {Array.from({ length: optionsPerQuestion }).map((_, oIdx) => {
                          const option = OPTION_LABELS[oIdx];
                          const isSelected = d.answer === option;
                          const isLowConf = isSelected && d.confidence < 50;
                          return (
                            <button
                              key={option}
                              data-testid={`bubble-q${qIdx + 1}-${option}`}
                              onClick={() => toggleAnswer(qIdx, option)}
                              title={isSelected ? `Detected: ${option}${isLowConf ? " (low confidence)" : ""}` : option}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                                isSelected
                                  ? isLowConf
                                    ? "border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "border-primary bg-primary text-primary-foreground"
                                  : "border-input bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent"
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {d.confidence < 50 && d.answer && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">check</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}

          <CardFooter className="border-t pt-4 flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (step === "upload") resetWizard();
                else if (step === "align") setStep("upload");
                else if (step === "review") { setStep("align"); setDetectedAnswers(null); }
              }}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === "upload" ? "Cancel" : "Back"}
            </Button>

            <div className="flex gap-2">
              {step === "upload" && (
                <Button
                  onClick={() => setStep("align")}
                  disabled={!imageUrl || !name.trim()}
                  className="gap-2"
                  data-testid="button-next-align"
                >
                  Next: Align Grid
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}

              {step === "align" && (
                <Button
                  onClick={handleDetect}
                  disabled={isProcessing}
                  className="gap-2"
                  data-testid="button-run-detection"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="h-4 w-4" />
                  )}
                  {isProcessing ? "Detecting..." : "Detect Answers"}
                </Button>
              )}

              {step === "review" && (
                <Button
                  onClick={handleSaveTemplate}
                  className="gap-2"
                  data-testid="button-save-template"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save Template
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Existing templates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col overflow-hidden">
            {template.templateImageDataUrl ? (
              <div className="h-36 overflow-hidden bg-muted border-b">
                <img
                  src={template.templateImageDataUrl}
                  alt={`${template.name} template`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center bg-muted/30 border-b">
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}

            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(template.createdAt).toLocaleDateString()}
              </p>
            </CardHeader>

            <CardContent className="flex-1 pb-3">
              <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                <Badge variant="secondary">{template.questionCount} questions</Badge>
                <Badge variant="secondary">
                  {template.optionsPerQuestion} options (A–{OPTION_LABELS[template.optionsPerQuestion - 1]})
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {template.correctAnswers.slice(0, 20).map((ans, i) => (
                  <div
                    key={i}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold"
                  >
                    {ans || "?"}
                  </div>
                ))}
                {template.correctAnswers.length > 20 && (
                  <div className="flex h-6 px-2 items-center rounded-full bg-muted text-xs text-muted-foreground">
                    +{template.correctAnswers.length - 20}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-0 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteTemplate(template.id)}
                data-testid={`button-delete-template-${template.id}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}

        {templates.length === 0 && step === "idle" && (
          <div className="col-span-full py-16 text-center border rounded-lg border-dashed flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-4">
              <Camera className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">No templates yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Click "New Template" and upload a photo of a correctly filled OMR sheet to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
