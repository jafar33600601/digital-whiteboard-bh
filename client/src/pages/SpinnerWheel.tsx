import { useState, useRef, useEffect } from "react";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  // دالة تشغيل الصوت
  const playTickSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  };

  const playWinSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  };

  // دالة رسم المستطيل
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const itemHeight = 140;
    const itemWidth = 380;

    // رسم الخلفية
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#9333ea";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, width, height);

    // رسم الخط الأوسط (المؤشر)
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // رسم الأسماء
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 48px 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const repeatedNames = [...students, ...students, ...students];
    repeatedNames.forEach((student, idx) => {
      const x = (idx * itemWidth - scrollOffset) % (repeatedNames.length * itemWidth);
      if (x > -itemWidth && x < width) {
        // تحديد اللون: أرجواني للاسم المختار، أزرق للآخرين
        const isSelected = x > width / 2 - 40 && x < width / 2 + 40;
        ctx.fillStyle = isSelected ? "#7c3aed" : "#3b82f6";
        ctx.fillRect(x, height / 2 - itemHeight / 2, itemWidth, itemHeight);
        
        // رسم النص
        ctx.fillStyle = "white";
        ctx.font = "bold 48px 'Segoe UI', Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(student.name, x + itemWidth / 2, height / 2);
      }
    });
  }, [scrollOffset, students]);

  // دالة تدوير العجلة
  const spinWheel = () => {
    if (students.length === 0) return;
    setIsSpinning(true);
    setScrollOffset(0);
    setSelectedStudent(null);

    const itemWidth = 380;
    const randomIndex = Math.floor(Math.random() * students.length);
    const canvasWidth = canvasRef.current?.width || 1200;
    const finalOffset = randomIndex * itemWidth + itemWidth / 2 - canvasWidth / 2;

    let currentOffset = 0;
    let speed = 10;
    const maxSpeed = 100;
    const startTime = Date.now();
    const spinDuration = 3000;
    let lastTickTime = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      if (progress < 0.6) {
        // مرحلة التسارع: من 10 إلى 100
        speed = 10 + (maxSpeed - 10) * (progress / 0.6);
        currentOffset += speed;
        
        // تشغيل الصوت كل 50ms
        if (elapsed - lastTickTime > 50) {
          playTickSound();
          lastTickTime = elapsed;
        }
      } else {
        // مرحلة التباطؤ: من 100 إلى 0
        const easeProgress = (progress - 0.6) / 0.4;
        speed = maxSpeed * (1 - easeProgress * easeProgress);
        currentOffset += speed;
        
        // تشغيل الصوت كل 50ms
        if (elapsed - lastTickTime > 50) {
          playTickSound();
          lastTickTime = elapsed;
        }
      }

      setScrollOffset(currentOffset);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setScrollOffset(finalOffset);
        setSelectedStudent(students[randomIndex].name);
        playWinSound();
        setIsSpinning(false);
      }
    };

    animate();
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
                  <div className="space-y-4">
                    <canvas
                      ref={canvasRef}
                      width={1200}
                      height={200}
                      className="w-full border-4 border-purple-500 rounded-lg shadow-2xl"
                    />
                    {selectedStudent && (
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 rounded-lg text-center">
                        <p className="text-white text-sm mb-2">الطالب المختار 🎉</p>
                        <p className="text-white text-3xl font-bold">{selectedStudent}</p>
                      </div>
                    )}
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
