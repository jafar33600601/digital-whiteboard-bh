import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, Trash2, RotateCw } from "lucide-react";

export default function SpinnerWheel() {
  const utils = trpc.useUtils();

  // الصفوف الدراسية
  const classroomsQuery = trpc.wheel.getClassrooms.useQuery();
  const [newClassroomName, setNewClassroomName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null);
  const [studentNames, setStudentNames] = useState("");

  // الأسئلة
  const questionsQuery = trpc.wheel.getQuestions.useQuery();
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState("");

  // العجلة
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // Mutations
  const createClassroomMut = trpc.wheel.createClassroom.useMutation({
    onSuccess: () => {
      setNewClassroomName("");
      utils.wheel.getClassrooms.invalidate();
    },
  });

  const deleteClassroomMut = trpc.wheel.deleteClassroom.useMutation({
    onSuccess: () => {
      setSelectedClassroomId(null);
      utils.wheel.getClassrooms.invalidate();
    },
  });

  const replaceStudentsMut = trpc.wheel.replaceStudents.useMutation({
    onSuccess: () => {
      setStudentNames("");
      utils.wheel.getClassrooms.invalidate();
    },
  });

  const createQuestionMut = trpc.wheel.createQuestion.useMutation({
    onSuccess: () => {
      setNewQuestion("");
      setNewOptions("");
      utils.wheel.getQuestions.invalidate();
    },
  });

  const deleteQuestionMut = trpc.wheel.deleteQuestion.useMutation({
    onSuccess: () => {
      setSelectedQuestionId(null);
      utils.wheel.getQuestions.invalidate();
    },
  });

  // الحصول على الطلاب من الصف المختار
  const selectedClassroom = classroomsQuery.data?.find((c) => c.id === selectedClassroomId);
  const students = selectedClassroom?.students || [];

  // دالة تدوير العجلة
  const spinWheel = () => {
    if (students.length === 0) return;
    setIsSpinning(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * students.length);
      setSelectedStudent(students[randomIndex].name);
      setIsSpinning(false);
    }, 2000);
  };

  // الحصول على السؤال المختار
  const selectedQuestion = questionsQuery.data?.find((q) => q.id === selectedQuestionId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">🎡 عجلة الأسماء</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* الصفوف الدراسية */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-xl">📚 الصفوف الدراسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="اسم الصف الجديد"
                  value={newClassroomName}
                  onChange={(e) => setNewClassroomName(e.target.value)}
                />
                <Button
                  onClick={() => createClassroomMut.mutate({ name: newClassroomName })}
                  disabled={!newClassroomName || createClassroomMut.isPending}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة صف
                </Button>
              </div>

              <Select value={selectedClassroomId?.toString() || ""} onValueChange={(v) => setSelectedClassroomId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر صفاً" />
                </SelectTrigger>
                <SelectContent>
                  {classroomsQuery.data?.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id.toString()}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedClassroomId && (
                <Button
                  variant="destructive"
                  onClick={() => deleteClassroomMut.mutate({ id: selectedClassroomId })}
                  disabled={deleteClassroomMut.isPending}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف الصف
                </Button>
              )}

              {selectedClassroomId && (
                <div className="space-y-2 pt-4 border-t">
                  <label className="text-sm font-medium">أسماء الطلاب (كل اسم في سطر)</label>
                  <Textarea
                    placeholder="أحمد&#10;فاطمة&#10;محمد&#10;..."
                    value={studentNames}
                    onChange={(e) => setStudentNames(e.target.value)}
                    className="min-h-32"
                  />
                  <Button
                    onClick={() =>
                      replaceStudentsMut.mutate({
                        classroomId: selectedClassroomId,
                        names: studentNames.split("\n").filter((n) => n.trim()),
                      })
                    }
                    disabled={!studentNames || replaceStudentsMut.isPending}
                    className="w-full"
                  >
                    حفظ الأسماء
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* العجلة */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-xl">🎯 العجلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {students.length === 0 ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">اختر صفاً وأضف أسماء الطلاب</span>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-purple-400 to-blue-500 rounded-full w-48 h-48 mx-auto flex items-center justify-center shadow-lg">
                    <div className="text-center">
                      {selectedStudent ? (
                        <div>
                          <p className="text-white text-sm mb-2">الطالب المختار</p>
                          <p className="text-white text-2xl font-bold">{selectedStudent}</p>
                        </div>
                      ) : (
                        <p className="text-white text-sm">اضغط أدِّر العجلة</p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={spinWheel}
                    disabled={isSpinning || students.length === 0}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    size="lg"
                  >
                    <RotateCw className={`w-5 h-5 ml-2 ${isSpinning ? "animate-spin" : ""}`} />
                    أدِّر العجلة
                  </Button>

                  <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                    <p className="text-sm font-medium mb-2">الطلاب ({students.length})</p>
                    <div className="space-y-1">
                      {students.map((student: any) => (
                        <p key={student.id} className="text-sm text-gray-600">
                          • {student.name}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* الأسئلة */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-xl">❓ الأسئلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="السؤال"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                />
                <Textarea
                  placeholder="الخيارات (كل خيار في سطر) - اختياري"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  className="min-h-20"
                />
                <Button
                  onClick={() =>
                    createQuestionMut.mutate({
                      question: newQuestion,
                      options: newOptions.split("\n").filter((o) => o.trim()),
                    })
                  }
                  disabled={!newQuestion || createQuestionMut.isPending}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة سؤال
                </Button>
              </div>

              <Select value={selectedQuestionId?.toString() || ""} onValueChange={(v) => setSelectedQuestionId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر سؤالاً" />
                </SelectTrigger>
                <SelectContent>
                  {questionsQuery.data?.map((question) => (
                    <SelectItem key={question.id} value={question.id.toString()}>
                      {question.question.substring(0, 30)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedQuestionId && (
                <Button
                  variant="destructive"
                  onClick={() => deleteQuestionMut.mutate({ id: selectedQuestionId })}
                  disabled={deleteQuestionMut.isPending}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف السؤال
                </Button>
              )}

              {selectedQuestion && (
                <div className="bg-blue-50 p-3 rounded space-y-2">
                  <p className="font-medium text-sm">{selectedQuestion.question}</p>
                  {selectedQuestion.options && (typeof selectedQuestion.options === 'object' && Array.isArray(selectedQuestion.options)) && selectedQuestion.options.length > 0 && (
                    <div className="space-y-1">
                      {(selectedQuestion.options as string[]).map((option: string, idx: number) => (
                        <p key={idx} className="text-sm text-gray-600">
                          {String.fromCharCode(97 + idx)}) {option}
                        </p>
                      ))}
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
