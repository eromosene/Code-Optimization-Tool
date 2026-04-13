import { useState, useRef, useCallback } from "react";
import { useStore, GradingResult } from "@/lib/store";
import { processOMRImage, DetectedAnswer } from "@/lib/omr-processor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Camera, CheckCircle2, XCircle, Loader2, Layers,
  Upload, Trash2, Play, Save, ImageIcon, AlertTriangle,
  TrendingUp, Users, Target, Download
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface BatchItem {
  id: string;
  file: File;
  imageUrl: string;
  studentName: string;
  status: "pending" | "processing" | "done" | "error";
  detectedAnswers?: DetectedAnswer[];
  score?: number;
  errorMsg?: string;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function Batch() {
  const { templates, addResult } = useStore();
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const doneItems = items.filter((i) => i.status === "done");
  const pendingItems = items.filter((i) => i.status === "pending");
  const errorItems = items.filter((i) => i.status === "error");
  const progress = items.length > 0 ? Math.round((doneItems.length / items.length) * 100) : 0;
  const allDone = items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");

  const avgScore = doneItems.length > 0
    ? Math.round(doneItems.reduce((sum, i) => sum + ((i.score ?? 0) / (selectedTemplate?.questionCount ?? 1)) * 100, 0) / doneItems.length)
    : 0;
  const passRate = doneItems.length > 0
    ? Math.round((doneItems.filter((i) => ((i.score ?? 0) / (selectedTemplate?.questionCount ?? 1)) >= 0.6).length / doneItems.length) * 100)
    : 0;

  const addFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newItems: BatchItem[] = imageFiles.map((file, idx) => ({
      id: crypto.randomUUID(),
      file,
      imageUrl: URL.createObjectURL(file),
      studentName: `Student ${items.length + idx + 1}`,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);
    setSaved(false);
  }, [items.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSaved(false);
  };

  const updateName = (id: string, name: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, studentName: name } : i));
  };

  const setItemStatus = (id: string, update: Partial<BatchItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...update } : i));
  };

  const handleGradeAll = async () => {
    if (!selectedTemplate || items.length === 0) return;

    const gridConfig = selectedTemplate.gridConfig ?? { x: 10, y: 10, w: 80, h: 80 };
    setIsRunning(true);
    setSaved(false);

    for (const item of items) {
      if (item.status === "done") continue;

      setItemStatus(item.id, { status: "processing" });

      try {
        const img = await loadImageElement(item.imageUrl);

        const bounds = {
          x: (gridConfig.x / 100) * img.naturalWidth,
          y: (gridConfig.y / 100) * img.naturalHeight,
          width: (gridConfig.w / 100) * img.naturalWidth,
          height: (gridConfig.h / 100) * img.naturalHeight,
        };

        const detected = await processOMRImage(img, selectedTemplate, bounds);
        const score = detected.filter((d, i) => d.answer === selectedTemplate.correctAnswers[i]).length;

        setItemStatus(item.id, { status: "done", detectedAnswers: detected, score });
      } catch {
        setItemStatus(item.id, { status: "error", errorMsg: "Could not process image" });
      }
    }

    setIsRunning(false);
  };

  const handleSaveAll = () => {
    if (!selectedTemplate) return;
    let savedCount = 0;

    for (const item of doneItems) {
      if (!item.detectedAnswers) continue;
      const result: GradingResult = {
        id: crypto.randomUUID(),
        templateId: selectedTemplate.id,
        studentName: item.studentName.trim() || "Anonymous",
        answers: item.detectedAnswers.map((d) => d.answer),
        score: item.score ?? 0,
        totalQuestions: selectedTemplate.questionCount,
        detectedAnswers: item.detectedAnswers,
        gradedAt: Date.now(),
      };
      addResult(result);
      savedCount++;
    }

    setSaved(true);
    toast({
      title: "All results saved",
      description: `${savedCount} sheet${savedCount !== 1 ? "s" : ""} saved to history.`,
    });
  };

  const handleExportCsv = () => {
    if (!selectedTemplate || doneItems.length === 0) return;

    const headers = ["Student", "Score", "Total", "Percentage"];
    const rows = doneItems.map((item) => [
      item.studentName || "Anonymous",
      String(item.score ?? 0),
      String(selectedTemplate.questionCount),
      `${Math.round(((item.score ?? 0) / selectedTemplate.questionCount) * 100)}%`,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-${selectedTemplate.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (templates.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Grading</h1>
          <p className="text-muted-foreground mt-1">Grade an entire class at once.</p>
        </div>
        <Card className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Layers className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">No Templates Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              First create a template by snapping the answer key sheet, then come back here to batch grade.
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Grading</h1>
        <p className="text-muted-foreground mt-1">
          Upload all student sheets at once — graded automatically using the template's grid.
        </p>
      </div>

      {/* Template + actions bar */}
      <div className="flex flex-wrap gap-4 items-start">
        <Card className="flex-1 min-w-60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Answer Key Template
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  data-testid={`batch-select-template-${t.id}`}
                  onClick={() => { setSelectedTemplateId(t.id); setItems([]); setSaved(false); }}
                  disabled={isRunning}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all hover:bg-accent ${
                    selectedTemplateId === t.id
                      ? "border-primary ring-1 ring-primary bg-primary/5 font-medium"
                      : "border-border"
                  }`}
                >
                  {t.templateImageDataUrl ? (
                    <img src={t.templateImageDataUrl} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span>{t.name}</span>
                  {selectedTemplateId === t.id && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-1" />
                  )}
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedTemplate.questionCount} questions · {selectedTemplate.optionsPerQuestion} options
                {selectedTemplate.gridConfig
                  ? " · grid pre-loaded from template"
                  : " · no saved grid — results may vary"}
              </p>
            )}
          </CardContent>
        </Card>

        {allDone && (
          <div className="flex gap-2 shrink-0 self-center">
            <Button
              variant="outline"
              onClick={handleExportCsv}
              className="gap-2"
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={saved}
              className="gap-2"
              data-testid="button-save-all"
            >
              <Save className="h-4 w-4" />
              {saved ? "Saved to History" : "Save All to History"}
            </Button>
          </div>
        )}
      </div>

      {/* Summary stats — shown when grading is done */}
      {allDone && doneItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
              <CardTitle className="text-sm font-medium">Graded</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-bold">{doneItems.length}</div>
              {errorItems.length > 0 && (
                <p className="text-xs text-destructive mt-1">{errorItems.length} failed</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-bold">{avgScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">class average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-bold">{passRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">scoring 60% or above</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload zone */}
      {selectedTemplate && (
        <div
          data-testid="batch-upload-zone"
          className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 py-10 text-center transition-all hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="rounded-full bg-primary/10 p-4 mb-3">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <p className="font-semibold text-sm">Drop all student sheets here</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select multiple files at once — each image becomes one graded sheet
          </p>
          <Badge variant="outline" className="mt-3 text-xs gap-1">
            <Camera className="h-3 w-3" /> Supports photos, scans, or any image
          </Badge>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {/* Progress bar while running */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processing sheets...</span>
            <span>{doneItems.length + errorItems.length} / {items.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Sheet queue */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {items.length} sheet{items.length !== 1 ? "s" : ""} queued
            </span>
            <div className="flex gap-2">
              {!allDone && (
                <Button
                  onClick={handleGradeAll}
                  disabled={isRunning || !selectedTemplate}
                  className="gap-2"
                  data-testid="button-grade-all"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isRunning ? "Grading..." : "Grade All"}
                </Button>
              )}
              {!isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setItems([]); setSaved(false); }}
                  className="gap-2 text-muted-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => {
              const pct = selectedTemplate
                ? Math.round(((item.score ?? 0) / selectedTemplate.questionCount) * 100)
                : 0;

              return (
                <Card
                  key={item.id}
                  data-testid={`batch-item-${item.id}`}
                  className={`relative overflow-hidden transition-all ${
                    item.status === "done"
                      ? pct >= 80 ? "border-green-300 dark:border-green-800"
                        : pct >= 60 ? "border-amber-300 dark:border-amber-800"
                        : "border-red-300 dark:border-red-800"
                      : item.status === "error"
                      ? "border-destructive/40"
                      : item.status === "processing"
                      ? "border-primary/50 shadow-md"
                      : ""
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative h-32 overflow-hidden bg-muted/30">
                    <img
                      src={item.imageUrl}
                      alt={`Sheet ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Status overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {item.status === "processing" && (
                        <div className="bg-black/50 rounded-full p-3">
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                      )}
                      {item.status === "done" && (
                        <div className={`absolute top-2 right-2 rounded-full px-2 py-1 text-xs font-bold text-white shadow ${
                          pct >= 80 ? "bg-green-600" : pct >= 60 ? "bg-amber-600" : "bg-red-600"
                        }`}>
                          {pct}%
                        </div>
                      )}
                      {item.status === "error" && (
                        <div className="bg-black/60 rounded-lg px-3 py-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span className="text-white text-xs">Failed</span>
                        </div>
                      )}
                    </div>

                    {/* Remove button (only when not running) */}
                    {!isRunning && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="absolute top-2 left-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                        data-testid={`remove-item-${item.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <CardContent className="p-3 space-y-2">
                    <Input
                      value={item.studentName}
                      onChange={(e) => updateName(item.id, e.target.value)}
                      placeholder={`Student ${idx + 1}`}
                      className="h-8 text-sm"
                      disabled={isRunning}
                      data-testid={`input-student-name-${item.id}`}
                    />

                    <div className="flex items-center justify-between">
                      {item.status === "pending" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                      {item.status === "processing" && (
                        <Badge variant="outline" className="text-xs text-primary border-primary/40">
                          Processing...
                        </Badge>
                      )}
                      {item.status === "done" && selectedTemplate && (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <span className="text-xs text-muted-foreground font-medium">
                            {item.score}/{selectedTemplate.questionCount} correct
                          </span>
                          <div className="flex items-center gap-1">
                            {pct >= 60
                              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                              : <XCircle className="h-4 w-4 text-red-500" />
                            }
                            <span className={`text-sm font-bold ${
                              pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-600"
                            }`}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      )}
                      {item.status === "error" && (
                        <Badge variant="destructive" className="text-xs">
                          Error — try single grading
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when template selected but no files */}
      {selectedTemplate && items.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Upload student sheets above to begin.
        </div>
      )}
    </div>
  );
}
