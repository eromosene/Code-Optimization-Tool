import { useState, useRef, useEffect } from "react";
import { useStore, Template, GradingResult } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, ListChecks, CheckCircle2, XCircle, ArrowRight, Play, Save, RefreshCw, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { processOMRImage, DetectedAnswer } from "@/lib/omr-processor";
import { useToast } from "@/hooks/use-toast";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

export default function Home() {
  const { templates, addResult } = useStore();
  const { toast } = useToast();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  
  // Grid state (percentages of width/height to make it responsive)
  const [gridRect, setGridRect] = useState({ x: 20, y: 20, w: 60, h: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<DetectedAnswer[] | null>(null);
  const [studentName, setStudentName] = useState("");
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResults(null);
  };

  const handleImageLoad = () => {
    if (imageRef.current && containerRef.current) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      setImageSize({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  };

  // Mouse events for dragging grid
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    const rect = containerRef.current.getBoundingClientRect();
    const dxPercent = (dx / rect.width) * 100;
    const dyPercent = (dy / rect.height) * 100;
    
    setGridRect((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(100 - prev.w, prev.x + dxPercent)),
      y: Math.max(0, Math.min(100 - prev.h, prev.y + dyPercent)),
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleProcess = async () => {
    if (!imageRef.current || !selectedTemplate) return;
    
    setIsProcessing(true);
    try {
      // Convert grid percentages to natural image coordinates
      const bounds = {
        x: (gridRect.x / 100) * naturalSize.width,
        y: (gridRect.y / 100) * naturalSize.height,
        width: (gridRect.w / 100) * naturalSize.width,
        height: (gridRect.h / 100) * naturalSize.height,
      };
      
      const detected = await processOMRImage(imageRef.current, selectedTemplate, bounds);
      setResults(detected);
    } catch (e) {
      toast({
        title: "Processing Failed",
        description: "Could not analyze the image.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveResult = () => {
    if (!selectedTemplate || !results) return;
    
    let score = 0;
    results.forEach((r, i) => {
      if (r.answer === selectedTemplate.correctAnswers[i]) {
        score++;
      }
    });

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
    toast({
      title: "Result Saved",
      description: `Scored ${score}/${selectedTemplate.questionCount}`,
    });
    
    // Reset for next
    setImageFile(null);
    setImageUrl(null);
    setResults(null);
    setStudentName("");
  };

  const toggleManualAnswer = (questionIdx: number, optionStr: string) => {
    if (!results) return;
    const newResults = [...results];
    
    if (newResults[questionIdx].answer === optionStr) {
      newResults[questionIdx].answer = ""; // Deselect
    } else {
      newResults[questionIdx].answer = optionStr;
    }
    
    // Mark as manually overridden (confidence 100)
    newResults[questionIdx].confidence = 100;
    setResults(newResults);
  };

  if (templates.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Grade Sheet</h1>
          <p className="text-muted-foreground">Scan and score student answer sheets.</p>
        </div>

        <Card className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">No Templates Found</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Before grading sheets, you need to create an answer key template defining the correct answers.
            </p>
          </div>
          <Link href="/templates">
            <Button className="mt-4 gap-2">
              <ListChecks className="h-4 w-4" />
              Create Template
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Grade Sheet</h1>
        <p className="text-muted-foreground">Select a template and upload a sheet to begin.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Workflow */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">1. Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 max-h-40 overflow-y-auto pr-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setResults(null);
                    }}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all hover:bg-accent ${
                      selectedTemplateId === template.id
                        ? "border-primary ring-1 ring-primary"
                        : "border-border"
                    }`}
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {template.questionCount} questions • {template.optionsPerQuestion} options
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">2. Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-center transition-all hover:bg-accent/50 cursor-pointer">
                <FileUp className="mx-auto h-6 w-6 text-muted-foreground" />
                <span className="mt-2 text-sm font-medium">Click to upload image</span>
                <Input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={!selectedTemplateId}
                />
              </div>
            </CardContent>
          </Card>

          {imageUrl && !results && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">3. Detect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Drag the red grid overlay to align with the bubbles on the image.
                </p>
                <Button 
                  className="w-full gap-2" 
                  onClick={handleProcess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isProcessing ? "Processing..." : "Run Detection"}
                </Button>
              </CardContent>
            </Card>
          )}

          {results && selectedTemplate && (
            <Card className="border-primary bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between border-b border-primary/20 pb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Score</p>
                    <p className="text-4xl font-bold text-primary">
                      {results.filter((r, i) => r.answer === selectedTemplate.correctAnswers[i]).length}
                      <span className="text-2xl text-muted-foreground">/{selectedTemplate.questionCount}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {Math.round((results.filter((r, i) => r.answer === selectedTemplate.correctAnswers[i]).length / selectedTemplate.questionCount) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="student-name">Student Name (Optional)</Label>
                  <Input 
                    id="student-name"
                    placeholder="Enter name..."
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setResults(null)}>
                      Edit Grid
                    </Button>
                    <Button className="flex-1 gap-2" onClick={handleSaveResult}>
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Image Workspace */}
        <div className="lg:col-span-8">
          <Card className="h-[600px] flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Workspace</span>
                {results && (
                  <span className="text-xs font-normal text-muted-foreground">
                    Click bubbles to manually correct detections
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative overflow-auto bg-muted/10">
              {!imageUrl ? (
                <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">
                  Select a template and upload an image to start grading.
                </div>
              ) : (
                <div 
                  className="relative inline-block min-w-full"
                  style={{ minHeight: "100%" }}
                  ref={containerRef}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img 
                    ref={imageRef}
                    src={imageUrl} 
                    alt="OMR Sheet" 
                    className="max-w-none block object-contain"
                    onLoad={handleImageLoad}
                    draggable={false}
                  />

                  {/* Grid Overlay for alignment (only when not results) */}
                  {!results && selectedTemplate && (
                    <div 
                      className="absolute border-2 border-red-500 bg-red-500/10 cursor-move"
                      style={{
                        left: `${gridRect.x}%`,
                        top: `${gridRect.y}%`,
                        width: `${gridRect.w}%`,
                        height: `${gridRect.h}%`,
                      }}
                      onMouseDown={handleMouseDown}
                    >
                      {/* Draw grid lines */}
                      <div className="absolute inset-0 flex flex-col pointer-events-none">
                        {Array.from({ length: selectedTemplate.questionCount }).map((_, i) => (
                          <div key={i} className="flex-1 border-b border-red-500/30 flex">
                            {Array.from({ length: selectedTemplate.optionsPerQuestion }).map((_, j) => (
                              <div key={j} className="flex-1 border-r border-red-500/30 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-red-500/50" />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      
                      {/* Resize handles */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-red-500 cursor-nwse-resize" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-red-500 cursor-nesw-resize" />
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-red-500 cursor-nesw-resize" />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-red-500 cursor-nwse-resize" />
                    </div>
                  )}

                  {/* Interactive Results Overlay */}
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
                          const lowConfidence = results[qIdx].confidence < 50 && results[qIdx].answer !== "";
                          
                          return (
                            <div key={qIdx} className="flex-1 flex relative group">
                              {/* Row Indicator */}
                              <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background/90 px-1 py-0.5 rounded text-xs font-bold shadow-sm">
                                <span>{qIdx + 1}</span>
                                {isCorrect ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                )}
                              </div>
                              
                              {lowConfidence && (
                                <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-amber-500" title="Low Confidence">
                                  <AlertTriangle className="w-4 h-4" />
                                </div>
                              )}

                              {Array.from({ length: selectedTemplate.optionsPerQuestion }).map((_, oIdx) => {
                                const option = OPTION_LABELS[oIdx];
                                const isDetected = results[qIdx].answer === option;
                                const isKey = selectedTemplate.correctAnswers[qIdx] === option;
                                
                                let ringColor = "border-transparent";
                                let bgColor = "bg-transparent hover:bg-black/10";
                                
                                if (isDetected && isKey) {
                                  ringColor = "border-green-500";
                                  bgColor = "bg-green-500/40";
                                } else if (isDetected && !isKey) {
                                  ringColor = "border-red-500";
                                  bgColor = "bg-red-500/40";
                                } else if (!isDetected && isKey) {
                                  ringColor = "border-blue-500 border-dashed";
                                }

                                return (
                                  <div 
                                    key={oIdx} 
                                    className="flex-1 relative flex items-center justify-center"
                                  >
                                    <button
                                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition-all ${ringColor} ${bgColor}`}
                                      onClick={() => toggleManualAnswer(qIdx, option)}
                                      title={`Mark as ${option}`}
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
