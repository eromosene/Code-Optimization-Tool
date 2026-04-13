import { useStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Download, TrendingUp, Users, Target } from "lucide-react";

export default function History() {
  const { results, templates, deleteResult } = useStore();

  const getTemplateName = (id: string) => {
    return templates.find((t) => t.id === id)?.name || "Unknown Template";
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    
    const headers = ["Date", "Student", "Template", "Score", "Percentage"];
    const rows = results.map(r => [
      new Date(r.gradedAt).toLocaleDateString(),
      r.studentName || "Anonymous",
      getTemplateName(r.templateId),
      `${r.score}/${r.totalQuestions}`,
      `${Math.round((r.score / r.totalQuestions) * 100)}%`
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gradesnap-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch stats calculations
  const totalGraded = results.length;
  let avgScore = 0;
  let passRate = 0;
  
  if (totalGraded > 0) {
    const sumPercentages = results.reduce((acc, r) => acc + (r.score / r.totalQuestions), 0);
    avgScore = Math.round((sumPercentages / totalGraded) * 100);
    
    const passed = results.filter(r => (r.score / r.totalQuestions) >= 0.6).length;
    passRate = Math.round((passed / totalGraded) * 100);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground">View and export your graded sheets.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={results.length === 0} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {totalGraded > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Graded</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGraded}</div>
              <p className="text-xs text-muted-foreground">Across all templates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgScore}%</div>
              <p className="text-xs text-muted-foreground">Mean performance</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{passRate}%</div>
              <p className="text-xs text-muted-foreground">Students scoring ≥ 60%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
          <CardDescription>
            List of all graded sheets in reverse chronological order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...results].reverse().map((result) => {
                  const percentage = Math.round((result.score / result.totalQuestions) * 100);
                  return (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium text-sm">
                        {new Date(result.gradedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{result.studentName || "Anonymous"}</TableCell>
                      <TableCell className="text-muted-foreground">{getTemplateName(result.templateId)}</TableCell>
                      <TableCell className="font-medium">{result.score} / {result.totalQuestions}</TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          percentage >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          percentage >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {percentage}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteResult(result.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <Trash2 className="h-6 w-6 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-semibold">No results yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Once you grade student sheets, their results and statistics will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
