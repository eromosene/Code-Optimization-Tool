import { useState } from "react";
import { useStore, Template } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, CheckCircle2, X, Edit2, RefreshCw,
  ClipboardList, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

type Mode = "list" | "create" | "edit";

function AnswerGrid({
  questionCount,
  optionsPerQuestion,
  questionsPerBlock,
  answers,
  onChange,
}: {
  questionCount: number;
  optionsPerQuestion: number;
  questionsPerBlock: number;
  answers: string[];
  onChange: (answers: string[]) => void;
}) {
  const toggle = (qIdx: number, option: string) => {
    const updated = [...answers];
    updated[qIdx] = updated[qIdx] === option ? "" : option;
    onChange(updated);
  };

  const filledCount = answers.filter((a) => a !== "").length;

  const perBlock = Math.max(1, questionsPerBlock);
  const blockCount = Math.ceil(questionCount / perBlock);
  const blocks = Array.from({ length: blockCount }).map((_, b) => {
    const start = b * perBlock;
    const end = Math.min(start + perBlock, questionCount);
    return Array.from({ length: end - start }).map((_, i) => start + i);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click the correct answer bubble for each question. Columns match the printed sheet's blocks.
        </p>
        <Badge variant={filledCount === questionCount ? "default" : "outline"} className="text-xs">
          {filledCount}/{questionCount} filled
        </Badge>
      </div>

      <div
        className="rounded-lg border bg-muted/10 p-3 overflow-x-auto overflow-y-auto"
        style={{ maxHeight: 480 }}
      >
        <div className="flex gap-6 w-max">
          {blocks.map((blockQuestions, bIdx) => (
            <div
              key={bIdx}
              className="flex flex-col gap-1 shrink-0"
              style={{ minWidth: 190 }}
            >
              <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pb-1 border-b mb-1">
                Block {bIdx + 1}
                <span className="font-normal normal-case ml-1">
                  (Q{blockQuestions[0] + 1}–{blockQuestions[blockQuestions.length - 1] + 1})
                </span>
              </div>
              {blockQuestions.map((qIdx) => {
                const currentAnswer = answers[qIdx] ?? "";
                const isFilled = currentAnswer !== "";

                return (
                  <div
                    key={qIdx}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
                      isFilled ? "bg-background" : "bg-amber-50/60 dark:bg-amber-950/20"
                    }`}
                  >
                    <span className="w-7 text-right text-xs font-mono text-muted-foreground shrink-0 select-none">
                      {qIdx + 1}.
                    </span>
                    <div className="flex gap-1.5">
                      {Array.from({ length: optionsPerQuestion }).map((_, oIdx) => {
                        const option = OPTION_LABELS[oIdx];
                        const isSelected = currentAnswer === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => toggle(qIdx, option)}
                            data-testid={`answer-q${qIdx + 1}-${option}`}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all select-none ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow"
                                : "border-input bg-background text-muted-foreground hover:border-primary/60 hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    {!isFilled && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useStore();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [questionCountInput, setQuestionCountInput] = useState("20");
  const [optionsPerQuestion, setOptionsPerQuestion] = useState(4);
  const [questionsPerBlock, setQuestionsPerBlock] = useState(15);
  const [questionsPerBlockInput, setQuestionsPerBlockInput] = useState("15");
  const [answers, setAnswers] = useState<string[]>([]);

  const resetForm = () => {
    setMode("list");
    setEditingId(null);
    setName("");
    setQuestionCount(20);
    setQuestionCountInput("20");
    setOptionsPerQuestion(4);
    setQuestionsPerBlock(15);
    setQuestionsPerBlockInput("15");
    setAnswers([]);
  };

  const startCreate = () => {
    setName("");
    setQuestionCount(20);
    setQuestionCountInput("20");
    setOptionsPerQuestion(4);
    setQuestionsPerBlock(15);
    setQuestionsPerBlockInput("15");
    setAnswers(Array(20).fill(""));
    setEditingId(null);
    setMode("create");
  };

  const startEdit = (template: Template) => {
    setName(template.name);
    setQuestionCount(template.questionCount);
    setQuestionCountInput(String(template.questionCount));
    setOptionsPerQuestion(template.optionsPerQuestion);
    setQuestionsPerBlock(template.questionsPerBlock ?? 15);
    setQuestionsPerBlockInput(String(template.questionsPerBlock ?? 15));
    setAnswers([...template.correctAnswers]);
    setEditingId(template.id);
    setMode("edit");
  };

  // Called on every keystroke — keep the raw string as-is (may be empty
  // or transiently invalid) so users can freely backspace/retype.
  const handleQuestionCountInputChange = (raw: string) => {
    setQuestionCountInput(raw);
  };

  // Called on blur — parse, clamp, and fall back to the last valid value.
  const commitQuestionCount = () => {
    const parsed = parseInt(questionCountInput, 10);
    const n = Number.isNaN(parsed) ? questionCount : Math.max(1, Math.min(100, parsed));
    setQuestionCount(n);
    setQuestionCountInput(String(n));
    setAnswers((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    });
  };

  const handleQuestionsPerBlockInputChange = (raw: string) => {
    setQuestionsPerBlockInput(raw);
  };

  const commitQuestionsPerBlock = () => {
    const parsed = parseInt(questionsPerBlockInput, 10);
    const n = Number.isNaN(parsed) ? questionsPerBlock : Math.max(1, Math.min(100, parsed));
    setQuestionsPerBlock(n);
    setQuestionsPerBlockInput(String(n));
  };

  const handleOptionsChange = (val: number) => {
    const n = Math.max(2, Math.min(5, val));
    setOptionsPerQuestion(n);
    const validLabels = OPTION_LABELS.slice(0, n);
    setAnswers((prev) =>
      prev.map((a) => (validLabels.includes(a) ? a : ""))
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please give this template a name.", variant: "destructive" });
      return;
    }
    const filledCount = answers.filter((a) => a !== "").length;
    if (filledCount === 0) {
      toast({ title: "No answers selected", description: "Fill in at least one correct answer.", variant: "destructive" });
      return;
    }

    if (mode === "create") {
      const newTemplate: Template = {
        id: crypto.randomUUID(),
        name: name.trim(),
        questionCount,
        optionsPerQuestion,
        questionsPerBlock,
        correctAnswers: [...answers],
        createdAt: Date.now(),
      };
      addTemplate(newTemplate);
      toast({ title: "Template saved", description: `"${name}" is ready for grading.` });
    } else if (mode === "edit" && editingId) {
      updateTemplate(editingId, {
        name: name.trim(),
        questionCount,
        optionsPerQuestion,
        questionsPerBlock,
        correctAnswers: [...answers],
      });
      toast({ title: "Template updated", description: `"${name}" has been updated.` });
    }

    resetForm();
  };

  const handleClearAnswers = () => {
    setAnswers(Array(questionCount).fill(""));
  };

  const handleDelete = (id: string, tplName: string) => {
    deleteTemplate(id);
    toast({ title: "Template deleted", description: `"${tplName}" was removed.` });
  };

  const filledCount = answers.filter((a) => a !== "").length;
  const allFilled = filledCount === questionCount && questionCount > 0;

  if (mode === "create" || mode === "edit") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === "create" ? "New Template" : "Edit Template"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Fill in the correct answer for each question number.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={resetForm}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Template Name</Label>
              <Input
                id="tpl-name"
                data-testid="input-template-name"
                placeholder="e.g. Biology Midterm 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-questions">Number of Questions</Label>
                <Input
                  id="tpl-questions"
                  type="number"
                  min={1}
                  max={100}
                  value={questionCountInput}
                  onChange={(e) => handleQuestionCountInputChange(e.target.value)}
                  onBlur={commitQuestionCount}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-block">Questions per Block</Label>
                <Input
                  id="tpl-block"
                  data-testid="input-questions-per-block"
                  type="number"
                  min={1}
                  max={100}
                  value={questionsPerBlockInput}
                  onChange={(e) => handleQuestionsPerBlockInputChange(e.target.value)}
                  onBlur={commitQuestionsPerBlock}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-options">Options per Question</Label>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleOptionsChange(n)}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                      optionsPerQuestion === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    {OPTION_LABELS.slice(0, n).join("")}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              e.g. 60 questions ÷ 15 per block = 4 columns (Q1–15, Q16–30, Q31–45, Q46–60), matching a printed sheet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Answer Key</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAnswers}
              className="gap-1.5 text-muted-foreground h-8 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Clear All
            </Button>
          </CardHeader>
          <CardContent>
            <AnswerGrid
              questionCount={questionCount}
              optionsPerQuestion={optionsPerQuestion}
              questionsPerBlock={questionsPerBlock}
              answers={answers}
              onChange={setAnswers}
            />
          </CardContent>
          <CardFooter className="border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {allFilled ? (
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  All {questionCount} answers filled
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  {questionCount - filledCount} question{questionCount - filledCount !== 1 ? "s" : ""} still empty
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || filledCount === 0}
                className="gap-2"
                data-testid="button-save-template"
              >
                <CheckCircle2 className="h-4 w-4" />
                {mode === "create" ? "Save Template" : "Update Template"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create an answer key by clicking the correct option for each question.
          </p>
        </div>
        <Button onClick={startCreate} className="gap-2" data-testid="button-new-template">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <ClipboardList className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">No Templates Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              Create your first template by clicking "New Template" and filling in the correct answers for each question.
            </p>
          </div>
          <Button onClick={startCreate} className="mt-2 gap-2">
            <Plus className="h-4 w-4" />
            Create First Template
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const answeredCount = template.correctAnswers.filter((a) => a !== "").length;
            const pct = Math.round((answeredCount / template.questionCount) * 100);

            return (
              <Card key={template.id} className="flex flex-col">
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug flex-1">{template.name}</CardTitle>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(template)}
                        data-testid={`button-edit-${template.id}`}
                        title="Edit answers"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(template.id, template.name)}
                        data-testid={`button-delete-${template.id}`}
                        title="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 pb-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{template.questionCount} questions</Badge>
                    <Badge variant="secondary">
                      {OPTION_LABELS.slice(0, template.optionsPerQuestion).join(" / ")}
                    </Badge>
                    {template.gridConfig && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300 dark:border-green-700">
                        Grid saved
                      </Badge>
                    )}
                  </div>

                  {/* Compact answer preview — blocks matching the printed sheet */}
                  <div className="rounded-md border bg-muted/20 p-2 overflow-auto" style={{ maxHeight: 140 }}>
                    <div className="flex gap-3 w-max">
                      {(() => {
                        const perBlock = Math.max(1, template.questionsPerBlock ?? 15);
                        const blockCount = Math.ceil(template.questionCount / perBlock);
                        return Array.from({ length: blockCount }).map((_, bIdx) => {
                          const start = bIdx * perBlock;
                          const end = Math.min(start + perBlock, template.questionCount);
                          return (
                            <div key={bIdx} className="flex flex-col gap-0.5 shrink-0">
                              {Array.from({ length: end - start }).map((_, i) => {
                                const idx = start + i;
                                const ans = template.correctAnswers[idx];
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs py-0.5">
                                    <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">
                                      {idx + 1}.
                                    </span>
                                    {ans ? (
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                        {ans}
                                      </span>
                                    ) : (
                                      <span className="text-amber-500 text-xs">—</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {answeredCount < template.questionCount && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {template.questionCount - answeredCount} answer{template.questionCount - answeredCount !== 1 ? "s" : ""} missing
                    </p>
                  )}
                  {pct === 100 && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      All answers complete
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
