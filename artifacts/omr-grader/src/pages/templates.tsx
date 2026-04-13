import { useState } from "react";
import { useStore, Template } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

export default function Templates() {
  const { templates, addTemplate, deleteTemplate } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // New template state
  const [name, setName] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [optionsPerQuestion, setOptionsPerQuestion] = useState(4);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(Array(20).fill("A"));

  const handleCreateTemplate = () => {
    if (!name) return;
    
    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name,
      questionCount,
      optionsPerQuestion,
      correctAnswers,
      createdAt: Date.now(),
    };
    
    addTemplate(newTemplate);
    setIsDialogOpen(false);
    // Reset form
    setName("");
    setQuestionCount(20);
    setOptionsPerQuestion(4);
    setCorrectAnswers(Array(20).fill("A"));
  };

  const handleQuestionCountChange = (count: number) => {
    setQuestionCount(count);
    setCorrectAnswers((prev) => {
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill("A")];
      }
      return prev.slice(0, count);
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Manage your answer key templates.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button gap="2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Answer Key Template</DialogTitle>
              <DialogDescription>
                Define the correct answers for your exam. This template will be used to automatically grade student sheets.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4 md:grid-cols-[250px_1fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Midterm Fall 2024" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="questions">Number of Questions</Label>
                  <Input 
                    id="questions" 
                    type="number" 
                    min={5} 
                    max={100} 
                    value={questionCount}
                    onChange={(e) => handleQuestionCountChange(parseInt(e.target.value) || 20)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="options">Options per Question</Label>
                  <Input 
                    id="options" 
                    type="number" 
                    min={2} 
                    max={5} 
                    value={optionsPerQuestion}
                    onChange={(e) => setOptionsPerQuestion(parseInt(e.target.value) || 4)}
                  />
                </div>
              </div>

              <div className="rounded-md border bg-muted/50 p-4">
                <Label className="mb-4 block">Answer Key</Label>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="grid gap-2">
                    {Array.from({ length: questionCount }).map((_, qIdx) => (
                      <div key={qIdx} className="flex items-center gap-4">
                        <span className="w-6 text-right text-sm font-medium text-muted-foreground">
                          {qIdx + 1}.
                        </span>
                        <div className="flex gap-2">
                          {Array.from({ length: optionsPerQuestion }).map((_, oIdx) => {
                            const option = OPTION_LABELS[oIdx];
                            const isSelected = correctAnswers[qIdx] === option;
                            return (
                              <button
                                key={option}
                                onClick={() => {
                                  const newAnswers = [...correctAnswers];
                                  newAnswers[qIdx] = option;
                                  setCorrectAnswers(newAnswers);
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-colors ${
                                  isSelected 
                                    ? "border-primary bg-primary text-primary-foreground font-bold" 
                                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTemplate} disabled={!name}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>
                {new Date(template.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex justify-between text-sm text-muted-foreground mb-4">
                <span>{template.questionCount} Questions</span>
                <span>{template.optionsPerQuestion} Options (A-{OPTION_LABELS[template.optionsPerQuestion - 1]})</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {template.correctAnswers.slice(0, 10).map((ans, i) => (
                  <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {ans}
                  </div>
                ))}
                {template.correctAnswers.length > 10 && (
                  <div className="flex h-6 px-2 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                    +{template.correctAnswers.length - 10}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteTemplate(template.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-12 text-center border rounded-lg border-dashed">
            <p className="text-muted-foreground">No templates created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
