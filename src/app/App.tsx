import { useState, useMemo, useEffect } from "react";
import {
  Home, ClipboardCheck, Award, BarChart2, Settings,
  ChevronLeft, ChevronRight, Plus, Search, Check, X,
  AlertTriangle, Send, Info, CheckCircle2, Mail, Star,
  Trash2, Pencil, GraduationCap, BookOpen, Users,
  BookMarked, Building2, Database, LogOut, ChevronDown,
  ClipboardList, Eye, EyeOff, Clock, UserCheck, LayoutDashboard,
  ShieldCheck, KeyRound
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "professor" | "admin";
// Professor tabs
type ProfTab = "home" | "chamada" | "avaliacao" | "relatorios";
// Admin tabs — each maps directly to an admin screen
type AdminTab = "home" | "admin-cursos" | "admin-turmas" | "admin-pessoas" | "admin-questoes";
type Tab = ProfTab | AdminTab;
type SubView =
  | { type: "chamada-lesson"; classId: string }
  | { type: "chamada-register"; classId: string; lessonIds: string[]; date?: string }
  | { type: "prof-questoes" }
  | { type: "avaliacao-config"; classId: string; moduleId: string }
  | { type: "avaliacao-summary"; classId: string; moduleId: string; selectedQuestions: Question[]; counts: QuestionCounts; lessonIds: string[]; generatedExamId: string }
  | { type: "avaliacao-conduct"; classId: string; moduleId: string; selectedQuestions: Question[]; generatedExamId: string }
  | { type: "avaliacao-done"; classId: string; moduleId: string; group: number }
  | { type: "student-report"; studentId: string };

interface Student { id: string; name: string; email: string; enrollment: string; classIds: string[]; status: string; }
interface Course { id: string; name: string; area: string; }
interface Module { id: string; courseId: string; order: number; name: string; lessonCount: number; status: string; }
interface Lesson { id: string; moduleId: string; courseId: string; order: number; name: string; }
interface Class { id: string; name: string; courseId: string; teacherId: string; studentIds: string[]; conductedLessons: string[]; schedule: string; status: string; currentModuleId?: string; }
interface Question { id: string; courseId: string; moduleId: string; lessonId: string; text: string; difficulty: "easy" | "medium" | "hard"; answer: string; status: "ativa" | "inativa"; }
interface Professor { id: string; name: string; email: string; password: string; status: string; classIds: string[]; }
interface AttendanceRecord { id: string; classId: string; lessonId: string; lessonIds?: string[]; studentId: string; status: "present" | "absent"; justification?: string; date: string; }
interface DailyAssessment { id: string; classId: string; lessonId: string; lessonIds?: string[]; studentId: string; criteria: Record<string, boolean>; date: string; }
interface QuestionResult { questionId: string; text: string; difficulty: Question["difficulty"]; score: number; observation: string; }
interface PeriodicAssessment {
  id: string; classId: string; moduleId: string; group: number; studentId: string;
  generatedExamId?: string; questionResults?: QuestionResult[];
  scores: { knowledge: number; creativity: number; objectivity: number; conciseness: number };
  total: number; final10?: number; date: string; emailSent: boolean; feedback?: string;
}
interface GeneratedExam { id: string; classId: string; moduleId: string; group: number; questionIds: string[]; counts: QuestionCounts; lessonIds: string[]; date: string; }
type QuestionCounts = { total: number; easy: number; medium: number; hard: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY_CRITERIA = [
  { id: "knowledge", label: "Conhecimento do conteúdo" },
  { id: "creativity", label: "Criatividade" },
  { id: "objectivity", label: "Objetividade" },
  { id: "conciseness", label: "Concisão" },
  { id: "participation", label: "Participação" },
  { id: "activeListening", label: "Escuta ativa e foco" },
  { id: "reactivity", label: "Reatividade" },
  { id: "teamwork", label: "Espírito de equipe" },
  { id: "proactivity", label: "Proatividade" },
  { id: "argumentation", label: "Capacidade de argumentação" },
];

function defaultDailyCriteria() {
  return Object.fromEntries(DAILY_CRITERIA.map(c => [c.id, true])) as Record<string, boolean>;
}

const ORAL_CRITERIA = [
  { id: "knowledge", label: "Domínio da disciplina", weight: 4 },
  { id: "creativity", label: "Criatividade", weight: 4 },
  { id: "conciseness", label: "Concisão", weight: 1 },
  { id: "objectivity", label: "Objetividade", weight: 1 },
] as const;

function calcOralScore(sc: { knowledge: number; creativity: number; conciseness: number; objectivity: number }) {
  return sc.knowledge * 4 + sc.creativity * 4 + sc.conciseness + sc.objectivity;
}

function gradeInfo(score: number) {
  if (score <= 60) return { label: "Reprovado", cls: "bg-red-100 text-red-700" };
  if (score <= 69) return { label: "Regular", cls: "bg-orange-100 text-orange-700" };
  if (score <= 79) return { label: "Bom", cls: "bg-yellow-100 text-yellow-800" };
  if (score <= 90) return { label: "Muito Bom", cls: "bg-blue-100 text-blue-700" };
  return { label: "Excelente", cls: "bg-green-100 text-green-700" };
}

function todayISO() { return new Date().toISOString().split("T")[0]; }
function todayBR() { return new Date().toLocaleDateString("pt-BR"); }
function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0, 2).join(""); }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5); }
function unique<T>(items: T[]) { return [...new Set(items)]; }
function lessonGroupId(lessonIds: string[]) { return unique(lessonIds).sort().join("+"); }
function getRecordLessonIds(record: { lessonId: string; lessonIds?: string[] }) {
  return record.lessonIds?.length ? record.lessonIds : record.lessonId.split("+").filter(Boolean);
}
function formatDateBR(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR"); }
function lessonGroupLabel(lessonIds: string[], lessons: Lesson[]) {
  return lessonIds.map(id => lessons.find(l => l.id === id)?.name ?? id).join(" + ");
}

// ─── Initial Data ─────────────────────────────────────────────────────────────

const COURSES_INIT: Course[] = [
  { id: "c1", name: "Desenvolvimento Web Full Stack", area: "Tecnologia da Informação" },
  { id: "c2", name: "Design Gráfico e UX/UI", area: "Design e Comunicação" },
  { id: "c3", name: "Marketing Digital", area: "Negócios e Gestão" },
];

const MODULES_INIT: Module[] = [
  { id: "m1", courseId: "c1", order: 1, name: "Fundamentos de HTML5 e CSS3", lessonCount: 18, status: "ativo" },
  { id: "m2", courseId: "c1", order: 2, name: "JavaScript Essencial", lessonCount: 18, status: "ativo" },
  { id: "m3", courseId: "c1", order: 3, name: "React e Frontend Moderno", lessonCount: 18, status: "ativo" },
  { id: "m4", courseId: "c2", order: 1, name: "Fundamentos do Design Gráfico", lessonCount: 18, status: "ativo" },
  { id: "m5", courseId: "c2", order: 2, name: "Adobe Photoshop Avançado", lessonCount: 18, status: "ativo" },
  { id: "m6", courseId: "c3", order: 1, name: "Fundamentos do Marketing Digital", lessonCount: 18, status: "ativo" },
];

const lessonNames: Record<string, string[]> = {
  m1: ["Introdução ao HTML5","Estrutura de documentos","Tags semânticas","Formulários HTML","Introdução ao CSS3","Seletores CSS","Box Model","Flexbox","CSS Grid","Animações CSS","Responsividade","Variáveis CSS","Pseudo-elementos","Transições","Boas práticas HTML","Acessibilidade Web","Performance","Projeto: Landing Page"],
  m2: ["Introdução ao JavaScript","Variáveis e Tipos","Operadores","Condicionais","Laços","Funções","Arrays","Objetos","DOM","Eventos","Promises","Fetch API","Local Storage","ES6+","Módulos","Debugging","Testes Unitários","Projeto: App To-Do"],
  m3: ["Intro React","JSX","Props e Estado","useEffect","Context API","React Router","Formulários","HTTP","Estado Global","Performance","Testes","Next.js","SSR","SSG","Deploy","E-commerce","API REST","Projeto Final"],
  m4: ["História do Design","Princípios","Tipografia","Teoria das Cores","Composição","Identidade Visual","Logo","Impresso","Design Digital","UI vs UX","Pesquisa","Wireframes","Protótipos","Testes","Portfolio","Figma Básico","Figma Avançado","Projeto Final"],
  m5: ["Interface PS","Camadas","Seleção","Máscaras","Ajuste de Cor","Filtros","Retoque","Composição","Tipografia PS","Smart Objects","Ações","Exportação","Formatos","Fluxo","Redes Sociais","Impressão","Portfolio","Projeto Final"],
  m6: ["O que é Marketing","Comportamento Online","Funil de Vendas","Personas","Branding","Inbound","Email Marketing","Conteúdo","SEO Básico","Métricas","Analytics","Social Media","Estratégia","Copywriting","Automação","CRM","Cases","Projeto Final"],
};

function generateLessons(modules: Module[]): Lesson[] {
  return modules.flatMap(mod => {
    const names = lessonNames[mod.id] ?? Array.from({ length: mod.lessonCount }, (_, i) => `Lição ${i + 1}`);
    return names.map((name, idx) => ({
      id: `${mod.id}-l${idx + 1}`, moduleId: mod.id, courseId: mod.courseId, order: idx + 1, name,
    }));
  });
}

const STUDENTS_INIT: Student[] = [
  { id: "s1", name: "Ana Beatriz Santos", email: "ana.santos@gmail.com", enrollment: "2024001", classIds: ["t1", "t3"], status: "ativo" },
  { id: "s2", name: "Bruno Henrique Oliveira", email: "bruno.oliveira@gmail.com", enrollment: "2024002", classIds: ["t1"], status: "ativo" },
  { id: "s3", name: "Carla Fernanda Lima", email: "carla.lima@hotmail.com", enrollment: "2024003", classIds: ["t1"], status: "ativo" },
  { id: "s4", name: "Diego Alves Costa", email: "diego.costa@gmail.com", enrollment: "2024004", classIds: ["t1", "t2"], status: "ativo" },
  { id: "s5", name: "Eduarda Pereira Ramos", email: "eduarda.ramos@gmail.com", enrollment: "2024005", classIds: ["t1"], status: "ativo" },
  { id: "s6", name: "Felipe Augusto Sousa", email: "felipe.sousa@outlook.com", enrollment: "2024006", classIds: ["t2"], status: "ativo" },
  { id: "s7", name: "Gabriela Martins Ferreira", email: "gabriela.ferreira@gmail.com", enrollment: "2024007", classIds: ["t2"], status: "ativo" },
  { id: "s8", name: "Hugo Tadeu Nascimento", email: "hugo.nascimento@gmail.com", enrollment: "2024008", classIds: ["t2"], status: "ativo" },
  { id: "s9", name: "Isabela Rocha Campos", email: "isabela.campos@hotmail.com", enrollment: "2024009", classIds: ["t2"], status: "ativo" },
  { id: "s10", name: "João Pedro Ribeiro", email: "joao.ribeiro@gmail.com", enrollment: "2024010", classIds: ["t3"], status: "ativo" },
  { id: "s11", name: "Larissa Andrade Vieira", email: "larissa.vieira@gmail.com", enrollment: "2024011", classIds: ["t3"], status: "ativo" },
  { id: "s12", name: "Marcos Vinicio Carvalho", email: "marcos.carvalho@gmail.com", enrollment: "2024012", classIds: ["t3"], status: "ativo" },
];

const PROFESSORS_INIT: Professor[] = [
  { id: "prof1", name: "Carlos Eduardo Silva", email: "carlos.silva@aprender.edu.br", password: "Aprender@2024", status: "ativo", classIds: ["t1", "t2"] },
  { id: "prof2", name: "Mariana Costa Ferreira", email: "mariana.ferreira@aprender.edu.br", password: "Aprender@2024", status: "ativo", classIds: ["t3"] },
  { id: "prof3", name: "Rafael Andrade Souza", email: "rafael.souza@aprender.edu.br", password: "Aprender@2024", status: "inativo", classIds: [] },
];

const CLASSES_INIT: Class[] = [
  { id: "t1", name: "Dev Web — Turma A (Manhã)", courseId: "c1", teacherId: "prof1", studentIds: ["s1","s2","s3","s4","s5"], conductedLessons: ["m1-l1","m1-l2","m1-l3","m1-l4","m1-l5","m1-l6"], schedule: "Seg/Qua 08h–10h", status: "ativo" },
  { id: "t2", name: "Dev Web — Turma B (Tarde)", courseId: "c1", teacherId: "prof1", studentIds: ["s6","s7","s8","s9"], conductedLessons: ["m1-l1","m1-l2","m1-l3","m1-l4","m1-l5"], schedule: "Ter/Qui 14h–16h", status: "ativo" },
  { id: "t3", name: "Design Gráfico — Turma Única", courseId: "c2", teacherId: "prof2", studentIds: ["s1","s10","s11","s12"], conductedLessons: ["m4-l1","m4-l2","m4-l3","m4-l4","m4-l5","m4-l6"], schedule: "Sex 09h–13h", status: "ativo" },
];

type QuestionSeed = Omit<Question, "status"> & Partial<Pick<Question, "status">>;

const QUESTIONS_INIT: QuestionSeed[] = [
  // m1 — HTML5 e CSS3
  { id: "q1",  courseId: "c1", moduleId: "m1", lessonId: "m1-l1", text: "O que significa a sigla HTML e qual sua principal função?", difficulty: "easy", answer: "HyperText Markup Language — linguagem de marcação para criar páginas web" },
  { id: "q2",  courseId: "c1", moduleId: "m1", lessonId: "m1-l1", text: "Qual a função da tag <head> em um documento HTML?", difficulty: "easy", answer: "Contém metadados e informações sobre o documento" },
  { id: "q3",  courseId: "c1", moduleId: "m1", lessonId: "m1-l4", text: "O que faz o atributo 'required' em um campo de formulário HTML?", difficulty: "easy", answer: "Torna o campo obrigatório antes do envio do formulário" },
  { id: "q4",  courseId: "c1", moduleId: "m1", lessonId: "m1-l2", text: "Explique a diferença entre elementos block e inline no HTML.", difficulty: "medium", answer: "Block ocupa toda a largura disponível; inline apenas o espaço necessário" },
  { id: "q5",  courseId: "c1", moduleId: "m1", lessonId: "m1-l5", text: "Qual a diferença entre margin e padding no CSS? Dê um exemplo prático.", difficulty: "medium", answer: "Margin é espaço externo ao elemento; padding é espaço interno entre borda e conteúdo" },
  { id: "q6",  courseId: "c1", moduleId: "m1", lessonId: "m1-l3", text: "Quais são as principais tags semânticas do HTML5 e por que são importantes para SEO?", difficulty: "hard", answer: "header, footer, nav, main, article, section, aside — melhoram SEO e acessibilidade" },
  { id: "q7",  courseId: "c1", moduleId: "m1", lessonId: "m1-l6", text: "Explique o conceito de especificidade em CSS e como ela é calculada.", difficulty: "hard", answer: "Regra que determina qual estilo prevalece — calculada por seletores (ID > classe > elemento)" },

  // m2 — JavaScript Essencial
  { id: "q11", courseId: "c1", moduleId: "m2", lessonId: "m2-l1", text: "O que é JavaScript e qual seu papel no desenvolvimento web?", difficulty: "easy", answer: "Linguagem de programação que adiciona interatividade às páginas web" },
  { id: "q12", courseId: "c1", moduleId: "m2", lessonId: "m2-l2", text: "Qual a diferença entre 'var', 'let' e 'const' no JavaScript?", difficulty: "easy", answer: "var tem escopo de função; let e const têm escopo de bloco; const não pode ser reatribuída" },
  { id: "q13", courseId: "c1", moduleId: "m2", lessonId: "m2-l4", text: "O que são condicionais e como o if/else funciona em JavaScript?", difficulty: "easy", answer: "Estruturas que executam código dependendo de uma condição ser verdadeira ou falsa" },
  { id: "q14", courseId: "c1", moduleId: "m2", lessonId: "m2-l6", text: "O que são funções em JavaScript? Explique a diferença entre função declarada e arrow function.", difficulty: "medium", answer: "Funções são blocos de código reutilizáveis; arrow functions têm sintaxe compacta e não têm próprio 'this'" },
  { id: "q15", courseId: "c1", moduleId: "m2", lessonId: "m2-l8", text: "Como o JavaScript manipula objetos? Explique propriedades e métodos.", difficulty: "medium", answer: "Objetos são coleções de pares chave-valor; propriedades são dados e métodos são funções associadas" },
  { id: "q16", courseId: "c1", moduleId: "m2", lessonId: "m2-l11", text: "O que são Promises e como elas resolvem o problema do callback hell?", difficulty: "hard", answer: "Promises representam valores futuros e permitem encadeamento .then()/.catch() em vez de callbacks aninhados" },
  { id: "q17", courseId: "c1", moduleId: "m2", lessonId: "m2-l13", text: "Explique a diferença entre localStorage e sessionStorage.", difficulty: "hard", answer: "localStorage persiste os dados indefinidamente; sessionStorage os apaga ao fechar a aba" },

  // m3 — React e Frontend Moderno
  { id: "q21", courseId: "c1", moduleId: "m3", lessonId: "m3-l1", text: "O que é React e qual problema ele resolve?", difficulty: "easy", answer: "Biblioteca JavaScript para criar interfaces de usuário com componentes reutilizáveis" },
  { id: "q22", courseId: "c1", moduleId: "m3", lessonId: "m3-l2", text: "O que é JSX e como ele difere de HTML puro?", difficulty: "easy", answer: "Sintaxe que mistura JavaScript e HTML, compilada pelo Babel para React.createElement()" },
  { id: "q23", courseId: "c1", moduleId: "m3", lessonId: "m3-l3", text: "Explique a diferença entre props e state em React.", difficulty: "medium", answer: "Props são dados passados de pai para filho (imutáveis); state é o estado interno mutável do componente" },
  { id: "q24", courseId: "c1", moduleId: "m3", lessonId: "m3-l4", text: "Para que serve o hook useEffect? Dê um exemplo de uso.", difficulty: "medium", answer: "Executa efeitos colaterais (chamadas de API, subscriptions) após a renderização do componente" },
  { id: "q25", courseId: "c1", moduleId: "m3", lessonId: "m3-l5", text: "O que é Context API e quando devo usá-la em vez de props?", difficulty: "hard", answer: "Mecanismo para compartilhar estado global sem prop drilling; útil para tema, autenticação, idioma" },

  // m4 — Design Gráfico
  { id: "q8",  courseId: "c2", moduleId: "m4", lessonId: "m4-l1", text: "Cite três princípios fundamentais do design gráfico.", difficulty: "easy", answer: "Equilíbrio, proporção e harmonia" },
  { id: "q31", courseId: "c2", moduleId: "m4", lessonId: "m4-l2", text: "O que é hierarquia visual e por que ela é importante em um layout?", difficulty: "easy", answer: "Organização visual que guia o olhar do leitor do elemento mais para o menos importante" },
  { id: "q32", courseId: "c2", moduleId: "m4", lessonId: "m4-l3", text: "Qual a diferença entre tipografia serif e sans-serif?", difficulty: "medium", answer: "Serif tem traços decorativos nas extremidades; sans-serif não" },
  { id: "q33", courseId: "c2", moduleId: "m4", lessonId: "m4-l5", text: "Explique o conceito de espaço negativo (espaço em branco) no design.", difficulty: "medium", answer: "Área vazia ao redor dos elementos que melhora a legibilidade e destaca o conteúdo principal" },
  { id: "q9",  courseId: "c2", moduleId: "m4", lessonId: "m4-l2", text: "Quais são os princípios da Gestalt e como eles se aplicam ao design?", difficulty: "hard", answer: "Proximidade, semelhança, continuidade, fechamento e figura-fundo" },
  { id: "q34", courseId: "c2", moduleId: "m4", lessonId: "m4-l4", text: "Como a teoria das cores influencia a comunicação visual de uma marca?", difficulty: "hard", answer: "Cores evocam emoções e associações; a escolha da paleta define a personalidade e o posicionamento da marca" },

  // m5 — Photoshop Avançado
  { id: "q41", courseId: "c2", moduleId: "m5", lessonId: "m5-l1", text: "O que são camadas no Photoshop e qual sua vantagem?", difficulty: "easy", answer: "Camadas são planos independentes que permitem editar cada elemento sem afetar os demais" },
  { id: "q42", courseId: "c2", moduleId: "m5", lessonId: "m5-l3", text: "Qual a diferença entre seleção por laço e seleção por varinha mágica?", difficulty: "easy", answer: "Laço seleciona manualmente por contorno; varinha mágica seleciona pixels por similaridade de cor" },
  { id: "q43", courseId: "c2", moduleId: "m5", lessonId: "m5-l4", text: "O que são máscaras de camada e como elas funcionam?", difficulty: "medium", answer: "Máscaras controlam a visibilidade da camada: áreas brancas mostram, pretas ocultam o conteúdo" },
  { id: "q44", courseId: "c2", moduleId: "m5", lessonId: "m5-l6", text: "Explique a diferença entre filtros destrutivos e filtros inteligentes (Smart Filters).", difficulty: "hard", answer: "Filtros destrutivos alteram os pixels permanentemente; Smart Filters são não-destrutivos e editáveis" },

  // m6 — Marketing Digital
  { id: "q51", courseId: "c3", moduleId: "m6", lessonId: "m6-l1", text: "O que é marketing digital e como ele difere do marketing tradicional?", difficulty: "easy", answer: "Marketing digital usa canais online (redes sociais, e-mail, SEO) com mensuração em tempo real" },
  { id: "q52", courseId: "c3", moduleId: "m6", lessonId: "m6-l3", text: "O que é funil de vendas e quais são suas etapas principais?", difficulty: "easy", answer: "Jornada do cliente: Conscientização → Interesse → Consideração → Conversão → Fidelização" },
  { id: "q53", courseId: "c3", moduleId: "m6", lessonId: "m6-l4", text: "O que é persona e como ela é criada?", difficulty: "medium", answer: "Representação fictícia do cliente ideal baseada em dados reais de comportamento e características" },
  { id: "q54", courseId: "c3", moduleId: "m6", lessonId: "m6-l9", text: "Explique a diferença entre SEO on-page e off-page.", difficulty: "medium", answer: "On-page: otimizações internas (conteúdo, meta tags); off-page: fatores externos (backlinks, autoridade)" },
  { id: "q55", courseId: "c3", moduleId: "m6", lessonId: "m6-l6", text: "O que é Inbound Marketing e como ele se diferencia do Outbound?", difficulty: "hard", answer: "Inbound atrai o cliente com conteúdo relevante; Outbound interrompe o público com publicidade direta" },
  { id: "q56", courseId: "c3", moduleId: "m6", lessonId: "m6-l15", text: "Como funciona a automação de marketing e quais ferramentas são usadas?", difficulty: "hard", answer: "Sequências automáticas de e-mails, segmentação e lead scoring usando ferramentas como RD Station, HubSpot" },
];

const INITIAL_PERIODIC: PeriodicAssessment[] = [
  { id: "pa1", classId: "t1", moduleId: "m1", group: 1, studentId: "s1", scores: { knowledge: 8, creativity: 9, objectivity: 7, conciseness: 8 }, total: 81, date: "2024-03-18", emailSent: true },
  { id: "pa2", classId: "t1", moduleId: "m1", group: 1, studentId: "s2", scores: { knowledge: 7, creativity: 6, objectivity: 8, conciseness: 7 }, total: 67, date: "2024-03-18", emailSent: true },
  { id: "pa3", classId: "t1", moduleId: "m1", group: 1, studentId: "s4", scores: { knowledge: 9, creativity: 8, objectivity: 9, conciseness: 9 }, total: 86, date: "2024-03-18", emailSent: true },
];

const STORAGE_KEY = "aprender-plus-state-v2";

interface AppData {
  role: UserRole | null;
  currentProfessorId: string;
  courses: Course[];
  modules: Module[];
  classes: Class[];
  students: Student[];
  professors: Professor[];
  questions: Question[];
  attendance: AttendanceRecord[];
  dailyAssessments: DailyAssessment[];
  periodic: PeriodicAssessment[];
  generatedExams: GeneratedExam[];
}

function initialAppData(): AppData {
  return {
    role: null,
    currentProfessorId: "prof1",
    courses: COURSES_INIT,
    modules: MODULES_INIT,
    classes: CLASSES_INIT,
    students: STUDENTS_INIT,
    professors: PROFESSORS_INIT,
    questions: QUESTIONS_INIT.map(q => ({ status: "ativa", ...q })),
    attendance: [],
    dailyAssessments: [],
    periodic: INITIAL_PERIODIC,
    generatedExams: [],
  };
}

function keepLatestByKey<T>(items: T[], getKey: (item: T) => string) {
  const latest = new Map<string, T>();
  items.forEach(item => {
    const key = getKey(item);
    if (latest.has(key)) latest.delete(key);
    latest.set(key, item);
  });
  return Array.from(latest.values());
}

function mergeLatestByKey<T>(current: T[], next: T[], getKey: (item: T) => string) {
  const nextKeys = new Set(next.map(getKey));
  return keepLatestByKey([...current.filter(item => !nextKeys.has(getKey(item))), ...next], getKey);
}

function attendanceUniqueKey(record: AttendanceRecord) {
  return `${record.classId}|${lessonGroupId(getRecordLessonIds(record))}|${record.studentId}|${record.date}`;
}

function dailyAssessmentUniqueKey(record: DailyAssessment) {
  return `${record.classId}|${lessonGroupId(getRecordLessonIds(record))}|${record.studentId}|${record.date}`;
}

function periodicAssessmentUniqueKey(record: PeriodicAssessment) {
  return `${record.classId}|${record.moduleId}|${record.group}|${record.studentId}`;
}

function generatedExamUniqueKey(record: GeneratedExam) {
  return `${record.classId}|${record.moduleId}|${record.group}`;
}

function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    attendance: keepLatestByKey(data.attendance, attendanceUniqueKey),
    dailyAssessments: keepLatestByKey(data.dailyAssessments, dailyAssessmentUniqueKey),
    periodic: keepLatestByKey(data.periodic, periodicAssessmentUniqueKey),
    generatedExams: keepLatestByKey(data.generatedExams, generatedExamUniqueKey),
  };
}

function loadAppData(): AppData {
  const fallback = initialAppData();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return normalizeAppData({
      ...fallback,
      ...parsed,
      questions: (parsed.questions ?? fallback.questions).map(q => ({ status: "ativa", ...q })),
      attendance: parsed.attendance ?? fallback.attendance,
      dailyAssessments: parsed.dailyAssessments ?? fallback.dailyAssessments,
      periodic: parsed.periodic ?? fallback.periodic,
      generatedExams: parsed.generatedExams ?? fallback.generatedExams,
    });
  } catch {
    return fallback;
  }
}

function saveAppData(data: AppData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppData(data)));
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", fullWidth = false, disabled = false, small = false, type = "button", className = "" }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  fullWidth?: boolean; disabled?: boolean; small?: boolean; type?: "button" | "submit"; className?: string;
}) {
  const base = `inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-40 disabled:pointer-events-none ${fullWidth ? "w-full" : ""} ${small ? "px-3 py-2 text-sm" : "px-5 py-3 text-[15px]"}`;
  const variants = { primary: "bg-primary text-white shadow-md shadow-blue-200", secondary: "bg-secondary text-secondary-foreground", danger: "bg-destructive text-white shadow-md shadow-red-100", ghost: "text-foreground hover:bg-muted", success: "bg-accent text-white shadow-md shadow-green-200" };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
}

function Field({ label, id, value, onChange, placeholder = "", type = "text", required = false, disabled = false }: {
  label?: string; id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password") : type;
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>}
      <div className="relative">
        <input id={id} type={inputType} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} disabled={disabled}
          className="w-full rounded-2xl border border-border bg-input-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-50 pr-10" />
        {type === "password" && (
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function SelField({ label, value, onChange, options, disabled = false, required = false }: {
  label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-foreground">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>}
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} required={required}
          className="w-full appearance-none rounded-2xl border border-border bg-input-background px-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-50 pr-10">
          <option value="">Selecione...</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

function AvatarCircle({ name, size = "md", color = "blue" }: { name: string; size?: "sm" | "md" | "lg"; color?: string }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  const colors: Record<string, string> = { blue: "bg-blue-100 text-blue-700", green: "bg-green-100 text-green-700", orange: "bg-orange-100 text-orange-700", red: "bg-red-100 text-red-700" };
  return <div className={`rounded-full flex items-center justify-center font-bold shrink-0 ${sizes[size]} ${colors[color] ?? colors.blue}`}>{initials(name)}</div>;
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, danger = false }: { title: string; onClose: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div className="bg-card w-full rounded-t-3xl shadow-2xl max-h-[88%] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <h3 className={`font-bold text-[17px] ${danger ? "text-red-600" : "text-foreground"}`} style={{ fontFamily: "'Nunito', sans-serif" }}>{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl active:bg-muted transition-colors"><X size={20} className="text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex items-center px-4" onClick={onCancel}>
      <div className="bg-card w-full rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertTriangle size={20} className="text-red-600" /></div>
          <p className="text-sm text-foreground font-medium">{message}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Btn>
          <Btn variant="danger" onClick={onConfirm} className="flex-1">Confirmar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type = "success", onDone }: { message: string; type?: "success" | "error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return (
    <div className="absolute top-16 left-4 right-4 z-50 flex items-center gap-2 text-white text-sm rounded-2xl px-4 py-3 shadow-xl"
      style={{ background: type === "error" ? "#dc2626" : "#111827", animation: "fadeSlideDown 0.3s ease" }}>
      {type === "success" ? <CheckCircle2 size={18} className="text-green-400 shrink-0" /> : <AlertTriangle size={18} className="text-yellow-300 shrink-0" />}
      {message}
    </div>
  );
}

// ─── Status Bar ───────────────────────────────────────────────────────────────

function StatusBar() {
  return (
    <div className="flex items-center px-6 pt-3 pb-1">
      <span className="text-[12px] font-bold text-foreground">9:41</span>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="flex items-end gap-[2px] h-3">{[2, 4, 6, 8, 10].map((h, i) => <div key={i} className={`w-[3px] rounded-sm ${i < 4 ? "bg-foreground" : "bg-foreground/30"}`} style={{ height: `${h}px` }} />)}</div>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none"><path d="M7.5 2.5C9.3 2.5 10.9 3.2 12.1 4.4L13.5 3C11.9 1.4 9.8 0.5 7.5 0.5C5.2 0.5 3.1 1.4 1.5 3L2.9 4.4C4.1 3.2 5.7 2.5 7.5 2.5Z" fill="currentColor" fillOpacity="0.9"/><circle cx="7.5" cy="9.5" r="1.5" fill="currentColor"/></svg>
        <div className="flex items-center gap-0.5"><div className="w-[22px] h-[11px] rounded-[2px] border border-foreground/60 p-[2px]"><div className="h-full w-4/5 bg-foreground rounded-[1px]" /></div><div className="w-[2px] h-[5px] bg-foreground/50 rounded-r-[1px]" /></div>
      </div>
    </div>
  );
}

// ─── Top App Bar ──────────────────────────────────────────────────────────────

function TopBar({ title, onBack, rightSlot }: { title: string; onBack?: () => void; rightSlot?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-card/90 backdrop-blur-sm border-b border-border shrink-0">
      {onBack && <button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-muted transition-colors" aria-label="Voltar"><ChevronLeft size={22} className="text-primary" /></button>}
      <h1 className="flex-1 font-bold text-[17px] text-foreground" style={{ fontFamily: "'Nunito', sans-serif" }}>{title}</h1>
      {rightSlot}
    </div>
  );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

const PROF_TABS = [
  { id: "home",      label: "Início",     icon: Home },
  { id: "chamada",   label: "Chamada",    icon: ClipboardCheck },
  { id: "avaliacao", label: "Avaliação",  icon: Award },
  { id: "relatorios",label: "Relatórios", icon: BarChart2 },
] as const;

const ADMIN_TABS = [
  { id: "home",               label: "Início",       icon: LayoutDashboard },
  { id: "admin-cursos",       label: "Cursos",        icon: BookOpen },
  { id: "admin-turmas",       label: "Turmas",        icon: Users },
  { id: "admin-pessoas",      label: "Pessoas",       icon: UserCheck },
  { id: "chamada",            label: "Operacao",      icon: ClipboardCheck },
  { id: "admin-questoes",     label: "Questões",      icon: Database },
] as const;

function BottomNav({ role, tab, setTab }: { role: UserRole; tab: Tab; setTab: (t: Tab) => void }) {
  const tabs = role === "admin" ? ADMIN_TABS : PROF_TABS;
  return (
    <div className="flex items-end bg-card/95 backdrop-blur-md border-t border-border shrink-0 pb-2">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 transition-all ${active ? "text-primary" : "text-muted-foreground"}`} aria-current={active ? "page" : undefined}>
            <div className={`p-1.5 rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}><Icon size={22} strokeWidth={active ? 2.5 : 1.8} /></div>
            <span className={`text-[10px] font-semibold ${active ? "text-primary" : ""}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── 1. Login Screen ──────────────────────────────────────────────────────────

function LoginScreen({ onLogin, professors }: { onLogin: (r: UserRole, userId?: string) => void; professors: Professor[] }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) { setError("Selecione um perfil de acesso."); return; }
    if (!email.trim()) { setError("Informe o e-mail."); return; }
    if (!password.trim()) { setError("Informe a senha."); return; }
    const matchedProfessor = role === "professor"
      ? professors.find(p => p.email.toLowerCase() === email.trim().toLowerCase() && p.status === "ativo") ?? professors.find(p => p.status === "ativo")
      : undefined;
    setError("");
    onLogin(role, matchedProfessor?.id);
  }

  return (
    <div className="flex flex-col flex-1 bg-gradient-to-b from-primary/5 to-background overflow-y-auto">
      <div className="flex flex-col items-center pt-10 pb-6 px-6 text-center">
        <img src="/logo vertical.svg" alt="Aprender+" className="h-24 w-auto object-contain mb-4" />
        <h1 className="sr-only">Aprender+</h1>
        <p className="text-muted-foreground text-sm mt-1.5">Sistema de Gestão Educacional</p>
        <p className="text-xs text-muted-foreground/70 mt-1">150 Unidades · 50+ Cursos · 10.000 Alunos</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 flex flex-col gap-4 pb-8">
        {/* Role selection */}
        <div>
          <p className="text-sm font-bold text-foreground mb-2">Perfil de acesso <span className="text-red-500">*</span></p>
          <div className="flex gap-2">
            {([["professor", "Professor", BookMarked, "blue"], ["admin", "Administrador", Building2, "green"]] as const).map(([r, label, Icon, color]) => (
              <button key={r} type="button" onClick={() => { setRole(r); setError(""); }}
                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${role === r ? (color === "blue" ? "border-primary bg-blue-50" : "border-accent bg-green-50") : "border-border bg-card"}`}>
                <Icon size={24} className={role === r ? (color === "blue" ? "text-primary" : "text-accent") : "text-muted-foreground"} />
                <span className={`text-sm font-bold ${role === r ? (color === "blue" ? "text-primary" : "text-accent") : "text-muted-foreground"}`}>{label}</span>
                {role === r && <div className={`w-4 h-4 rounded-full flex items-center justify-center ${color === "blue" ? "bg-primary" : "bg-accent"}`}><Check size={10} className="text-white" /></div>}
              </button>
            ))}
          </div>
        </div>

        <Field label="E-mail" id="email" value={email} onChange={v => { setEmail(v); setError(""); }} placeholder="seu@email.com" type="email" required />
        <Field label="Senha" id="password" value={password} onChange={v => { setPassword(v); setError(""); }} placeholder="••••••••" type="password" required />

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        <Btn type="submit" fullWidth>Entrar</Btn>

        <p className="text-center text-xs text-muted-foreground mt-2">
          <span className="font-semibold">Protótipo:</span> qualquer senha funciona. Para professor, use um e-mail cadastrado ou o primeiro professor ativo.
        </p>
      </form>
    </div>
  );
}

// ─── Home / Dashboard ─────────────────────────────────────────────────────────

function HomeScreen({ role, courses, classes, students, periodic, professors, currentProfessorId, onLogout, onGoPedagogic }: {
  role: UserRole; courses: Course[]; classes: Class[]; students: Student[]; periodic: PeriodicAssessment[]; professors: Professor[]; currentProfessorId?: string; onLogout: () => void; onGoPedagogic?: (tab: ProfTab) => void;
}) {
  const myClasses = role === "professor" ? classes.filter(c => c.teacherId === currentProfessorId) : classes;
  const totalStudents = [...new Set(myClasses.flatMap(c => c.studentIds))].length;
  const pendingCount = myClasses.filter(c => {
    const group = Math.ceil(c.conductedLessons.length / 6);
    return group > 0 && !periodic.some(p => p.classId === c.id && p.group === group);
  }).length;

  // Use index-based keys ("T1", "T2"…) — recharts uses `name` as internal tick key,
  // so any string collision (two classes with similar names) would cause duplicate-key warnings.
  const chartData = myClasses.map((c, i) => ({
    name: `T${i + 1}`,
    Lições: c.conductedLessons.length,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-2">
      <div className="px-5 pt-4 pb-5 bg-gradient-to-br from-primary to-blue-700 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-blue-100">Bom dia,</p>
            <p className="text-xl font-black" style={{ fontFamily: "'Nunito', sans-serif" }}>
              {role === "admin" ? "Administrador" : (professors.find(p => p.id === currentProfessorId)?.name.split(" ")[0] ?? "Professor")}
            </p>
            <p className="text-xs text-blue-200 mt-0.5">{todayBR()}</p>
          </div>
          <button onClick={onLogout} className="p-2 rounded-xl bg-white/20 active:bg-white/30 transition-colors" aria-label="Sair"><LogOut size={18} className="text-white" /></button>
        </div>
        {role === "admin" ? (
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: myClasses.length, l: "Turmas" },
              { v: students.length, l: "Alunos" },
              { v: professors.filter(p => p.status === "ativo").length, l: "Professores" },
              { v: courses.length, l: "Cursos" },
            ] as const).map(s => (
              <div key={s.l} className="rounded-2xl p-2.5 text-center bg-white/20">
                <p className="text-xl font-black">{s.v}</p>
                <p className="text-[10px] text-blue-50 font-medium">{s.l}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: myClasses.length, l: "Turmas", alert: false },
              { v: totalStudents, l: "Alunos", alert: false },
              { v: pendingCount, l: "Pendentes", alert: pendingCount > 0 },
            ] as const).map(s => (
              <div key={s.l} className={`rounded-2xl p-3 text-center ${s.alert ? "bg-orange-400/90" : "bg-white/20"}`}>
                <p className="text-2xl font-black">{s.v}</p>
                <p className="text-[11px] text-blue-50 font-medium">{s.l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingCount > 0 && role === "professor" && (
        <div className="mx-4 mt-4 flex items-center gap-2 p-3 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>{pendingCount}</strong> avaliação{pendingCount > 1 ? "ões" : ""} periódica{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}</span>
        </div>
      )}

      {role === "admin" && onGoPedagogic && (
        <div className="mx-4 mt-4 bg-card rounded-2xl p-4 border border-border shadow-sm">
          <p className="font-bold text-sm mb-1" style={{ fontFamily: "'Figtree', sans-serif" }}>Operação Pedagógica</p>
          <p className="text-xs text-muted-foreground mb-3">Acesso de administrador às rotinas de aulas, provas e relatórios.</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => onGoPedagogic("chamada")} className="rounded-2xl bg-blue-50 text-primary px-2 py-3 text-xs font-bold active:scale-[0.98]"><ClipboardCheck size={18} className="mx-auto mb-1" />Chamada</button>
            <button onClick={() => onGoPedagogic("avaliacao")} className="rounded-2xl bg-orange-50 text-orange-700 px-2 py-3 text-xs font-bold active:scale-[0.98]"><Award size={18} className="mx-auto mb-1" />Provas</button>
            <button onClick={() => onGoPedagogic("relatorios")} className="rounded-2xl bg-green-50 text-green-700 px-2 py-3 text-xs font-bold active:scale-[0.98]"><BarChart2 size={18} className="mx-auto mb-1" />Relatórios</button>
          </div>
        </div>
      )}

      <div className="mx-4 mt-4 bg-card rounded-2xl p-4 border border-border shadow-sm">
        <p className="font-bold text-sm mb-3" style={{ fontFamily: "'Nunito', sans-serif" }}>Progresso das Turmas</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, 180]} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #eef2ff" }} />
            <Bar dataKey="Lições" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {role === "admin" ? (
        /* Admin: recent turmas overview */
        <div className="mx-4 mt-4">
          <p className="font-bold text-sm mb-2" style={{ fontFamily: "'Nunito', sans-serif" }}>Visão Geral — Turmas</p>
          <div className="flex flex-col gap-2">
            {myClasses.map(cl => {
              const course = courses.find(c => c.id === cl.courseId);
              const prof = professors.find(p => p.id === cl.teacherId);
              const pct = Math.round((cl.conductedLessons.length / 180) * 100);
              return (
                <div key={cl.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Users size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cl.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{course?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{prof?.name ?? "Sem professor"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className="bg-blue-50 text-blue-700">{cl.studentIds.length} al.</Badge>
                      <Badge className={cl.status === "ativo" ? "bg-green-100 text-green-700 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{cl.status}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Professor: my classes */
        <div className="mx-4 mt-4">
          <p className="font-bold text-sm mb-2" style={{ fontFamily: "'Nunito', sans-serif" }}>Minhas Turmas</p>
          <div className="flex flex-col gap-2">
            {myClasses.map(cl => {
              const course = courses.find(c => c.id === cl.courseId);
              const pct = Math.round((cl.conductedLessons.length / 180) * 100);
              return (
                <div key={cl.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><BookMarked size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cl.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{course?.name}</p>
                    </div>
                    <Badge className="bg-blue-50 text-blue-700">{cl.studentIds.length} al.</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="h-4" />
    </div>
  );
}

// ─── 2. Chamada: Class List ───────────────────────────────────────────────────

function ChamadaList({ role, classes, courses, currentProfessorId, onSelectClass }: { role: UserRole; classes: Class[]; courses: Course[]; currentProfessorId?: string; onSelectClass: (id: string) => void }) {
  const myClasses = role === "professor" ? classes.filter(c => c.teacherId === currentProfessorId) : classes;
  return (
    <div className="flex-1 overflow-y-auto">
      <p className="px-4 pt-4 pb-2 text-sm text-muted-foreground">Selecione a turma para iniciar a chamada</p>
      <div className="px-4 flex flex-col gap-3 pb-4">
        {myClasses.map(cl => {
          const course = courses.find(c => c.id === cl.courseId);
          return (
            <button key={cl.id} onClick={() => onSelectClass(cl.id)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border-2 border-border active:border-primary active:bg-blue-50/50 transition-all text-left shadow-sm group focus:outline-none focus:ring-2 focus:ring-primary/40">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Users size={22} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px]" style={{ fontFamily: "'Nunito', sans-serif" }}>{cl.name}</p>
                <p className="text-xs text-muted-foreground truncate">{course?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cl.studentIds.length} aluno{cl.studentIds.length > 1 ? "s" : ""} · {cl.conductedLessons.length} lições</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground group-active:text-primary shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 4. Chamada: Lesson Select (conducted lessons DISABLED) ───────────────────

function ChamadaHomeScreen({ role, classes, courses, students, professors, lessons, attendance, dailyAssessments, currentProfessorId, onSelectClass, onEditCall, onDeleteCall }: {
  role: UserRole; classes: Class[]; courses: Course[]; students: Student[]; professors: Professor[]; lessons: Lesson[];
  attendance: AttendanceRecord[]; dailyAssessments: DailyAssessment[]; currentProfessorId?: string; onSelectClass: (id: string) => void; onEditCall: (classId: string, lessonIds: string[], date: string) => void; onDeleteCall: (classId: string, lessonIds: string[], date: string) => void;
}) {
  const [mode, setMode] = useState<"today" | "history">("today");
  const [classFilter, setClassFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const accessibleClasses = role === "professor" ? classes.filter(c => c.teacherId === currentProfessorId) : classes;
  const accessibleIds = new Set(accessibleClasses.map(c => c.id));
  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    attendance
      .filter(a => accessibleIds.has(a.classId))
      .forEach(a => {
        const key = `${a.date}|${a.classId}|${lessonGroupId(getRecordLessonIds(a))}`;
        map.set(key, [...(map.get(key) ?? []), a]);
      });
    return [...map.entries()]
      .map(([key, records]) => {
        const [date, classId, lessonId] = key.split("|");
        return { key, date, classId, lessonId, lessonIds: getRecordLessonIds(records[0]), records };
      })
      .filter(g => (!classFilter || g.classId === classFilter) && (!dateFilter || g.date === dateFilter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, classFilter, dateFilter, role, currentProfessorId, classes]);
  const detail = grouped.find(g => g.key === detailKey) ?? null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Chamada" rightSlot={<span className="text-xs text-muted-foreground">{todayBR()}</span>} />
      <div className="px-4 pt-3 pb-2 flex gap-2 shrink-0">
        <button onClick={() => setMode("today")} className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === "today" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>Hoje</button>
        <button onClick={() => setMode("history")} className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === "history" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>Anteriores</button>
      </div>
      {mode === "today" ? (
        <ChamadaList role={role} classes={classes} courses={courses} currentProfessorId={currentProfessorId} onSelectClass={onSelectClass} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none">
              <option value="">Todas as turmas</option>
              {accessibleClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <p className="px-4 pb-2 text-xs text-muted-foreground">{grouped.length} chamada{grouped.length !== 1 ? "s" : ""} encontrada{grouped.length !== 1 ? "s" : ""}</p>
          <div className="px-4 flex flex-col gap-2 pb-4">
            {grouped.map(g => {
              const cl = classes.find(c => c.id === g.classId);
              const course = courses.find(c => c.id === cl?.courseId);
              const prof = professors.find(p => p.id === cl?.teacherId);
              const present = g.records.filter(r => r.status === "present").length;
              const absent = g.records.filter(r => r.status === "absent").length;
              const lesson = lessons.find(l => l.id === g.lessonId);
              const lessonLabel = lessonGroupLabel(g.lessonIds, lessons);
              return (
                <button key={g.key} onClick={() => setDetailKey(g.key)} className="bg-card rounded-2xl border border-border p-4 text-left shadow-sm active:scale-[0.98]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Clock size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{cl?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{course?.name} · {lessonLabel || lesson?.name || g.lessonId}</p>
                      <p className="text-xs text-muted-foreground">{new Date(`${g.date}T00:00:00`).toLocaleDateString("pt-BR")} · {prof?.name ?? "Sem professor"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="bg-green-100 text-green-700">{present} pres.</Badge>
                      <Badge className="bg-red-100 text-red-700">{absent} falt.</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
            {grouped.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhuma chamada anterior encontrada</p>}
          </div>
        </div>
      )}

      {detail && (
        <Modal title="Detalhe da Chamada" onClose={() => setDetailKey(null)}>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-muted/50 border border-border px-4 py-3">
              <p className="font-bold text-sm">{classes.find(c => c.id === detail.classId)?.name}</p>
              <p className="text-xs text-muted-foreground">{new Date(`${detail.date}T00:00:00`).toLocaleDateString("pt-BR")} · {lessonGroupLabel(detail.lessonIds, lessons) || lessons.find(l => l.id === detail.lessonId)?.name || detail.lessonId}</p>
            </div>
            <Btn fullWidth small onClick={() => { setDetailKey(null); onEditCall(detail.classId, detail.lessonIds, detail.date); }}>
              <Pencil size={14} /> Editar chamada
            </Btn>
            <Btn fullWidth small variant="danger" onClick={() => { setDetailKey(null); onDeleteCall(detail.classId, detail.lessonIds, detail.date); }}>
              <Trash2 size={14} /> Excluir chamada
            </Btn>
            {detail.records.map(record => {
              const student = students.find(s => s.id === record.studentId);
              const daily = dailyAssessments.find(d => d.classId === record.classId && lessonGroupId(getRecordLessonIds(d)) === lessonGroupId(getRecordLessonIds(record)) && d.studentId === record.studentId && d.date === record.date);
              const okCount = daily ? Object.values(daily.criteria).filter(Boolean).length : 0;
              return (
                <div key={record.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <AvatarCircle name={student?.name ?? "?"} size="sm" color={record.status === "present" ? "green" : "red"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{student?.name}</p>
                      <p className="text-xs text-muted-foreground">{record.status === "present" ? "Presente" : "Falta"}</p>
                    </div>
                    {record.status === "present" ? <Badge className="bg-green-100 text-green-700">{okCount}/{DAILY_CRITERIA.length} OK</Badge> : <Badge className="bg-red-100 text-red-700">Falta</Badge>}
                  </div>
                  {record.justification && <p className="text-xs mt-2 bg-blue-50 text-blue-700 rounded-xl px-3 py-2">Justificativa: {record.justification}</p>}
                  {daily && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {DAILY_CRITERIA.map(c => <Badge key={c.id} className={daily.criteria[c.id] ? "bg-green-100 text-green-700 text-[10px]" : "bg-red-100 text-red-700 text-[10px]"}>{c.label}: {daily.criteria[c.id] ? "OK" : "Nao OK"}</Badge>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChamadaLessonScreen({ classId, classes, courses, lessons, onSelect, onBack }: {
  classId: string; classes: Class[]; courses: Course[]; lessons: Lesson[]; onSelect: (lessonIds: string[]) => void; onBack: () => void;
}) {
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const currentClass = classes.find(c => c.id === classId)!;
  const course = courses.find(c => c.id === currentClass.courseId)!;
  const MODULES_ALL = useMemo(() => {
    return lessons.filter(l => l.courseId === currentClass.courseId)
      .reduce((acc, l) => { if (!acc.find(m => m === l.moduleId)) acc.push(l.moduleId); return acc; }, [] as string[]);
  }, [lessons, currentClass]);

  const availableLessons = lessons.filter(l => l.courseId === currentClass.courseId);

  const grouped = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    availableLessons.forEach(l => { if (!map[l.moduleId]) map[l.moduleId] = []; map[l.moduleId].push(l); });
    return Object.entries(map);
  }, [availableLessons]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden max-w-full">
      <TopBar title="Selecionar Lição" onBack={onBack} />
      <div className="px-4 py-3 bg-primary/5 border-b border-border">
        <p className="text-xs text-muted-foreground">{currentClass.name}</p>
        <p className="text-sm font-semibold">{course.name}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs text-muted-foreground mb-3">
          <Info size={11} className="inline mr-1" />
          Lições já ministradas estão bloqueadas. Selecione apenas lições disponíveis.
        </p>
        {grouped.map(([moduleId, mLessons]) => {
          const modIdx = MODULES_ALL.indexOf(moduleId);
          return (
            <div key={moduleId} className="mb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 ml-1">Módulo {modIdx + 1}</p>
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {mLessons.map((lesson, idx) => {
                  const conducted = currentClass.conductedLessons.includes(lesson.id);
                  const selected = selectedLessons.includes(lesson.id);
                  return (
                    <button key={lesson.id} onClick={() => !conducted && setSelectedLessons(current => selected ? current.filter(id => id !== lesson.id) : [...current, lesson.id])}
                      disabled={conducted}
                      aria-disabled={conducted}
                      className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all ${idx > 0 ? "border-t border-border" : ""} ${conducted ? "opacity-50 cursor-not-allowed bg-muted/30" : selected ? "bg-blue-50" : "active:bg-muted/50"}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${selected ? "bg-primary text-white" : conducted ? "bg-muted text-muted-foreground" : "bg-muted text-foreground"}`}>
                        {conducted ? <Check size={12} /> : selected ? <Check size={13} /> : <span className="text-[11px] font-bold">{lesson.order}</span>}
                      </div>
                      <span className={`text-sm flex-1 ${selected ? "font-bold text-primary" : conducted ? "text-muted-foreground line-through" : "text-foreground"}`}>{lesson.name}</span>
                      {conducted && <Badge className="bg-muted text-muted-foreground text-[10px]">Já ministrada</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>
      <div className="px-4 py-4 bg-card border-t border-border">
        <Btn fullWidth onClick={() => selectedLessons.length > 0 && onSelect(selectedLessons)} disabled={selectedLessons.length === 0}>
          <ClipboardCheck size={18} /> Iniciar Chamada {selectedLessons.length > 1 ? `(${selectedLessons.length})` : ""}
        </Btn>
      </div>
    </div>
  );
}

// ─── 2+3. Chamada: Register (modal justification, fixed scroll) ───────────────

type JustifModal = { studentId: string; value: string } | null;

function ChamadaRegisterScreen({ classId, lessonIds, date = todayISO(), classes, students, lessons, courses, existingAttendance, existingDailyAssessments, onSave, onBack }: {
  classId: string; lessonIds: string[]; date?: string; classes: Class[]; students: Student[]; lessons: Lesson[]; courses: Course[];
  existingAttendance: AttendanceRecord[]; existingDailyAssessments: DailyAssessment[];
  onSave: (att: AttendanceRecord[], daily: DailyAssessment[]) => void; onBack: () => void;
}) {
  const currentClass = classes.find(c => c.id === classId)!;
  const classStudents = students.filter(s => currentClass.studentIds.includes(s.id));
  const lessonId = lessonGroupId(lessonIds);
  const lessonLabel = lessonGroupLabel(lessonIds, lessons);
  const course = courses.find(c => c.id === currentClass.courseId);

  const todaysAttendance = existingAttendance.filter(a => a.classId === classId && lessonGroupId(getRecordLessonIds(a)) === lessonId && a.date === date);
  const todaysDaily = existingDailyAssessments.filter(a => a.classId === classId && lessonGroupId(getRecordLessonIds(a)) === lessonId && a.date === date);

  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | null>>(() =>
    Object.fromEntries(classStudents.map(s => {
      const saved = todaysAttendance.find(a => a.studentId === s.id);
      return [s.id, saved?.status ?? null];
    }))
  );
  const [justifications, setJustifications] = useState<Record<string, string>>(() =>
    Object.fromEntries(todaysAttendance.filter(a => a.justification).map(a => [a.studentId, a.justification ?? ""]))
  );
  const [daily, setDaily] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(classStudents.map(s => {
      const saved = todaysDaily.find(a => a.studentId === s.id);
      return [s.id, saved?.criteria ?? defaultDailyCriteria()];
    }))
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  // 2. Justification modal state
  const [justifModal, setJustifModal] = useState<JustifModal>(null);
  const [justifTemp, setJustifTemp] = useState("");

  const allMarked = classStudents.every(s => attendance[s.id] !== null);
  const presentCount = classStudents.filter(s => attendance[s.id] === "present").length;
  const absentCount = classStudents.filter(s => attendance[s.id] === "absent").length;

  function openJustifModal(studentId: string) {
    setJustifTemp(justifications[studentId] ?? "");
    setJustifModal({ studentId, value: justifications[studentId] ?? "" });
  }
  function saveJustification() {
    if (!justifModal) return;
    setJustifications(p => ({ ...p, [justifModal.studentId]: justifTemp }));
    setJustifModal(null);
  }

  function markStudent(id: string, status: "present" | "absent") {
    setAttendance(p => ({ ...p, [id]: status }));
    if (status === "present") { setExpanded(id); }
    else { setExpanded(null); openJustifModal(id); }
  }

  function handleSave() {
    const attRecords: AttendanceRecord[] = classStudents.map(s => ({
      id: `att-${uid()}`, classId, lessonId, lessonIds, studentId: s.id,
      status: attendance[s.id] === "present" ? "present" : "absent",
      justification: attendance[s.id] === "absent" ? justifications[s.id] : undefined,
      date,
    }));
    const dailyRecords: DailyAssessment[] = classStudents.filter(s => attendance[s.id] === "present")
      .map(s => ({ id: `daily-${uid()}`, classId, lessonId, lessonIds, studentId: s.id, criteria: daily[s.id], date }));
    onSave(attRecords, dailyRecords);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Chamada" onBack={onBack}
        rightSlot={allMarked ? (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-green-100 text-green-700"><Check size={11} />{presentCount}</Badge>
            <Badge className="bg-red-100 text-red-700"><X size={11} />{absentCount}</Badge>
          </div>
        ) : undefined}
      />
      <div className="px-4 py-3 bg-primary/5 border-b border-border shrink-0">
        <p className="text-xs text-muted-foreground">{currentClass.name} · {course?.name}</p>
        <p className="text-sm font-bold">{lessonLabel || lessonId}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{todayBR()} · {classStudents.length} alunos</p>
      </div>
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 px-4 py-2 shrink-0">
        {classStudents.map(s => {
          const st = attendance[s.id];
          return <div key={s.id} className={`flex-1 h-1.5 rounded-full transition-colors ${st === "present" ? "bg-green-500" : st === "absent" ? "bg-red-400" : "bg-border"}`} />;
        })}
      </div>

      {/* 3. Scrollable student list with pb to account for fixed footer */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-3">
          {classStudents.map(student => {
            const status = attendance[student.id];
            const isPresent = status === "present";
            const isAbsent = status === "absent";
            const isExpanded = expanded === student.id;
            const hasJustification = !!justifications[student.id];
            const okCount = isPresent ? Object.values(daily[student.id] ?? {}).filter(Boolean).length : 0;

            return (
              <div key={student.id} className={`rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${isPresent ? "border-green-200" : isAbsent ? "border-red-200" : "border-border"} bg-card`}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <AvatarCircle name={student.name} color={isPresent ? "green" : isAbsent ? "red" : "blue"} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground">Mat. {student.enrollment}</p>
                    {isPresent && <p className="text-xs text-green-600 font-medium mt-0.5">{okCount}/{DAILY_CRITERIA.length} critérios OK</p>}
                    {isAbsent && hasJustification && <Badge className="bg-blue-100 text-blue-700 mt-1">Justificada</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => markStudent(student.id, "present")}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl border font-semibold text-sm transition-all active:scale-95 ${isPresent ? "bg-green-600 border-green-600 text-white" : "border-border text-muted-foreground"}`}>
                      <Check size={15} />
                    </button>
                    <button onClick={() => markStudent(student.id, "absent")}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl border font-semibold text-sm transition-all active:scale-95 ${isAbsent ? "bg-red-600 border-red-600 text-white" : "border-border text-muted-foreground"}`}>
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Absent: button to open justification modal */}
                {isAbsent && (
                  <div className="px-4 pb-3 border-t border-red-100 bg-red-50/40">
                    <div className="mt-2 flex items-center gap-2">
                      {hasJustification ? (
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Justificativa registrada:</p>
                          <p className="text-xs text-foreground bg-white border border-border rounded-xl px-3 py-2">{justifications[student.id]}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground flex-1 flex items-center gap-1"><AlertTriangle size={11} /> Nenhuma justificativa registrada</p>
                      )}
                      <button onClick={() => openJustifModal(student.id)}
                        className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold active:scale-95 transition-all shrink-0">
                        {hasJustification ? "Editar" : "Justificar"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Present: daily assessment */}
                {isPresent && (
                  <div className="border-t border-green-100">
                    <button onClick={() => setExpanded(isExpanded ? null : student.id)}
                      className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold text-green-700 active:bg-green-50 transition-colors">
                      <span className="flex items-center gap-1.5"><ClipboardList size={14} /> Avaliação Diária</span>
                      <ChevronDown size={16} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-green-50/40">
                        <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1"><Info size={11} /> Resultado não visível ao aluno</p>
                        <div className="flex flex-col gap-1.5">
                          {DAILY_CRITERIA.map(criterion => {
                            const checked = daily[student.id]?.[criterion.id] ?? false;
                            return (
                              <button key={criterion.id} onClick={() => setDaily(p => ({ ...p, [student.id]: { ...p[student.id], [criterion.id]: !checked } }))}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${checked ? "bg-green-600 border-green-600 text-white" : "bg-white border-border text-foreground"}`}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? "border-white bg-white/20" : "border-current"}`}>
                                  {checked && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span className="flex-1 text-left">{criterion.label}</span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${checked ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>{checked ? "OK" : "Não OK"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-2" />
      </div>

      {/* Fixed bottom action */}
      <div className="px-4 py-4 bg-card border-t border-border shrink-0">
        {!allMarked && <p className="text-xs text-muted-foreground text-center mb-2">Marque todos os {classStudents.length} alunos para salvar</p>}
        <Btn fullWidth onClick={handleSave} disabled={!allMarked} variant="success"><Send size={17} /> Salvar Chamada</Btn>
      </div>

      {/* 2. Justification Modal */}
      {justifModal && (
        <Modal title="Justificar Falta" onClose={() => setJustifModal(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Pergunte aos colegas o motivo da ausência e registre abaixo.</span>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Motivo da falta</label>
              <textarea value={justifTemp} onChange={e => setJustifTemp(e.target.value)} rows={3} placeholder="Ex: Problema de saúde (informado pelo colega Bruno Oliveira)"
                className="w-full rounded-2xl border border-border bg-input-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setJustifModal(null)} className="flex-1">Cancelar</Btn>
              <Btn variant="success" onClick={saveJustification} className="flex-1" disabled={!justifTemp.trim()}><Check size={16} /> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Avaliação: Home ──────────────────────────────────────────────────────────

function AvaliacaoHome({ role, classes, courses, modules, students, periodic, currentProfessorId, onStart, onManageQuestions }: {
  role: UserRole; classes: Class[]; courses: Course[]; modules: Module[]; students: Student[]; periodic: PeriodicAssessment[]; currentProfessorId?: string; onStart: (classId: string, moduleId: string) => void; onManageQuestions?: () => void;
}) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const myClasses = role === "professor" ? classes.filter(c => c.teacherId === currentProfessorId) : classes;
  const currentClass = classes.find(c => c.id === selectedClass);
  const classModules = useMemo(() => {
    if (!currentClass) return [];
    return modules.filter(m => m.courseId === currentClass.courseId);
  }, [currentClass, modules]);
  const conductedInModule = currentClass?.conductedLessons.filter(l => l.startsWith(selectedModule)).length ?? 0;
  const group = Math.min(3, Math.floor(conductedInModule / 6));

  return (
    <div className="flex-1 overflow-y-auto">
      {periodic.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Últimos Resultados</p>
          <div className="flex flex-col gap-2 mb-4">
            {periodic.slice(-3).reverse().map(p => {
              const student = students.find(s => s.id === p.studentId);
              const mod = modules.find(m => m.id === p.moduleId);
              const gi = gradeInfo(p.total);
              return (
                <div key={p.id} className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-border shadow-sm">
                  <AvatarCircle name={student?.name ?? "?"} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{student?.name}</p>
                    <p className="text-xs text-muted-foreground">{mod?.name ?? "—"} · Grupo {p.group}</p>
                  </div>
                  <div className="text-right shrink-0"><p className="text-lg font-black">{p.total}</p><Badge className={gi.cls}>{gi.label}</Badge></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 pb-4">
        {onManageQuestions && (
          <div className="mb-3">
            <Btn fullWidth variant="secondary" onClick={onManageQuestions}><Database size={16} /> Elaborar questoes</Btn>
          </div>
        )}
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Nova Avaliação</p>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col gap-4">
          <SelField label="Turma" value={selectedClass} onChange={v => { setSelectedClass(v); setSelectedModule(""); }}
            options={myClasses.map(c => ({ value: c.id, label: c.name }))} required />
          {selectedClass && (
            <div>
              <label className="block text-sm font-semibold mb-2">Módulo</label>
              <div className="flex flex-col gap-2">
                {classModules.map(m => {
                  const done = currentClass?.conductedLessons.filter(l => l.startsWith(m.id)).length ?? 0;
                  const ready = done >= 6;
                  const selected = selectedModule === m.id;
                  return (
                    <button key={m.id} type="button" disabled={!ready} onClick={() => setSelectedModule(m.id)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${selected ? "border-primary bg-blue-50" : "border-border bg-card"} ${!ready ? "opacity-55 cursor-not-allowed" : "active:scale-[0.98]"}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{m.order}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{done}/18 lições ministradas</p>
                      </div>
                      <Badge className={ready ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>{ready ? "Disponível" : "Aguardando 6"}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {selectedModule && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
               <p className="font-bold">Avaliação disponível: {group > 0 ? `${group} / 3` : "aguardando 6 lições"}</p>
               <p className="text-xs mt-0.5">Lições ministradas no módulo: {conductedInModule}</p>
            </div>
          )}
          <Btn fullWidth onClick={() => selectedClass && selectedModule && onStart(selectedClass, selectedModule)}
            disabled={!selectedClass || !selectedModule}>
            Configurar Prova <ChevronRight size={16} />
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Avaliação: Configure (select questions) ──────────────────────────────────

function AvaliacaoConfigScreen({ classId, moduleId, classes, modules, courses, questions, onStart, onBack }: {
  classId: string; moduleId: string; classes: Class[]; modules: Module[]; courses: Course[]; questions: Question[];
  onStart: (selectedQuestions: Question[], counts: QuestionCounts, lessonIds: string[]) => void; onBack: () => void;
}) {
  const [total, setTotal] = useState(5);
  const [easy, setEasy] = useState(2);
  const [med, setMed] = useState(2);
  const [hard, setHard] = useState(1);
  const currentClass = classes.find(c => c.id === classId)!;
  const mod = modules.find(m => m.id === moduleId)!;
  const course = courses.find(c => c.id === currentClass.courseId);

  const eligibleLessonIds = currentClass.conductedLessons.filter(id => id.startsWith(moduleId));
  const conductedCount = eligibleLessonIds.length;
  const group = Math.min(3, Math.floor(conductedCount / 6));
  const pool = questions.filter(q =>
    q.status === "ativa" &&
    q.courseId === currentClass.courseId &&
    q.moduleId === moduleId &&
    eligibleLessonIds.includes(q.lessonId)
  );
  const poolEasy = pool.filter(q => q.difficulty === "easy");
  const poolMed = pool.filter(q => q.difficulty === "medium");
  const poolHard = pool.filter(q => q.difficulty === "hard");
  useEffect(() => {
    setEasy(v => Math.min(v, poolEasy.length));
    setMed(v => Math.min(v, poolMed.length));
    setHard(v => Math.min(v, poolHard.length));
    setTotal(v => Math.min(v, pool.length));
  }, [pool.length, poolEasy.length, poolMed.length, poolHard.length]);
  const sumRequested = easy + med + hard;
  const hasEnoughQuestions = easy <= poolEasy.length && med <= poolMed.length && hard <= poolHard.length;
  const canGenerate = group > 0 && total > 0 && sumRequested === total && hasEnoughQuestions;
  const selectedQ = useMemo(
    () => canGenerate ? [...shuffle(poolEasy).slice(0, easy), ...shuffle(poolMed).slice(0, med), ...shuffle(poolHard).slice(0, hard)] : [],
    [canGenerate, easy, med, hard, poolEasy.length, poolMed.length, poolHard.length]
  );

  const StepCounter = ({ value, set, max, label }: { value: number; set: (v: number) => void; max: number; label: string }) => (
    <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-4 py-3">
      <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{max} disponíveis</p></div>
      <div className="flex items-center gap-3">
        <button disabled={value <= 0} onClick={() => set(Math.max(0, value - 1))} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-all disabled:opacity-40"><span className="text-lg font-bold leading-none">−</span></button>
        <span className="text-xl font-black text-primary w-6 text-center">{value}</span>
        <button disabled={value >= max} onClick={() => set(Math.min(max, value + 1))} className="w-9 h-9 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-all disabled:opacity-40"><Plus size={18} className="text-white" /></button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Configurar Prova" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-muted/50 rounded-2xl px-4 py-3 mb-4 border border-border">
          <p className="text-xs text-muted-foreground">{currentClass.name} · {course?.name}</p>
          <p className="text-sm font-bold">Módulo {mod?.order}: {mod?.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{pool.length} questões ativas válidas · {conductedCount} lições ministradas</p>
        </div>
        <p className="text-sm font-bold mb-3">Questões por nível de dificuldade:</p>
        <div className="mb-2">
          <StepCounter value={total} set={setTotal} max={pool.length} label="Total da prova" />
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <StepCounter value={easy} set={setEasy} max={poolEasy.length} label="🟢 Fáceis" />
          <StepCounter value={med} set={setMed} max={poolMed.length} label="🟡 Médias" />
          <StepCounter value={hard} set={setHard} max={poolHard.length} label="🔴 Difíceis" />
        </div>
        {group === 0 && <div className="mb-3 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">A turma precisa ter pelo menos 6 lições ministradas neste módulo para gerar a avaliação periódica.</div>}
        {sumRequested !== total && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">A soma por dificuldade precisa ser igual ao total da prova.</div>}
        {!hasEnoughQuestions && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">Não há questões ativas suficientes para a configuração escolhida.</div>}
        {selectedQ.length > 0 && (
          <div>
            <p className="text-sm font-bold mb-2">Questões sorteadas ({selectedQ.length}):</p>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {selectedQ.map((q, i) => (
                <div key={`${q.id}-${i}`} className={`px-4 py-3 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                    <div className="flex-1"><p>{q.text}</p>
                      <Badge className={`mt-1 ${q.difficulty === "easy" ? "bg-green-100 text-green-700" : q.difficulty === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"}`}>
                        {q.difficulty === "easy" ? "Fácil" : q.difficulty === "medium" ? "Média" : "Difícil"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="h-4" />
      </div>
      <div className="px-4 py-4 bg-card border-t border-border">
        <Btn fullWidth onClick={() => canGenerate && onStart(selectedQ, { total, easy, medium: med, hard }, eligibleLessonIds)} disabled={!canGenerate}>
          Gerar resumo da prova <ChevronRight size={16} />
        </Btn>
      </div>
    </div>
  );
}

// ─── 5. Avaliação: Conduct (question-by-question oral exam) ───────────────────

function AvaliacaoSummaryScreen({ classId, moduleId, selectedQuestions, counts, lessonIds, classes, courses, modules, lessons, onStart, onBack }: {
  classId: string; moduleId: string; selectedQuestions: Question[]; counts: QuestionCounts; lessonIds: string[];
  classes: Class[]; courses: Course[]; modules: Module[]; lessons: Lesson[]; onStart: () => void; onBack: () => void;
}) {
  const currentClass = classes.find(c => c.id === classId)!;
  const course = courses.find(c => c.id === currentClass.courseId);
  const mod = modules.find(m => m.id === moduleId);
  const lessonLabels = lessonIds
    .map(id => lessons.find(l => l.id === id))
    .filter(Boolean)
    .map(l => `L${l!.order}`)
    .join(", ");

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Prova Gerada" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm mb-3">
          <p className="text-xs text-muted-foreground">{currentClass.name}</p>
          <p className="font-bold text-sm">{course?.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Módulo {mod?.order}: {mod?.name}</p>
          <p className="text-xs text-muted-foreground mt-2">Lições consideradas: {lessonLabels || "nenhuma"}</p>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="rounded-2xl bg-blue-50 text-primary p-3 text-center"><p className="text-xl font-black">{counts.total}</p><p className="text-[10px] font-bold">Total</p></div>
          <div className="rounded-2xl bg-green-50 text-green-700 p-3 text-center"><p className="text-xl font-black">{counts.easy}</p><p className="text-[10px] font-bold">Fáceis</p></div>
          <div className="rounded-2xl bg-yellow-50 text-yellow-800 p-3 text-center"><p className="text-xl font-black">{counts.medium}</p><p className="text-[10px] font-bold">Médias</p></div>
          <div className="rounded-2xl bg-red-50 text-red-700 p-3 text-center"><p className="text-xl font-black">{counts.hard}</p><p className="text-[10px] font-bold">Difíceis</p></div>
        </div>
        <p className="text-sm font-bold mb-2">Perguntas sorteadas</p>
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {selectedQuestions.map((q, i) => (
            <div key={q.id} className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-muted-foreground mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm">{q.text}</p>
                  <Badge className={`mt-1 ${q.difficulty === "easy" ? "bg-green-100 text-green-700" : q.difficulty === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"}`}>
                    {q.difficulty === "easy" ? "Fácil" : q.difficulty === "medium" ? "Média" : "Difícil"}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-4 bg-card border-t border-border">
        <Btn fullWidth onClick={onStart}>Iniciar aplicação <ChevronRight size={16} /></Btn>
      </div>
    </div>
  );
}

interface OralScore { knowledge: number; creativity: number; conciseness: number; objectivity: number; observation: string; [key: string]: number | string; }

function AvaliacaoConductScreen({ classId, moduleId, selectedQuestions, generatedExamId, classes, courses, modules, students, periodic, setPeriodic, onDone, onBack }: {
  classId: string; moduleId: string; selectedQuestions: Question[]; generatedExamId: string;
  classes: Class[]; courses: Course[]; modules: Module[]; students: Student[]; periodic: PeriodicAssessment[];
  setPeriodic: (p: PeriodicAssessment[]) => void; onDone: (group: number) => void; onBack: () => void;
}) {
  const currentClass = classes.find(c => c.id === classId)!;
  const classStudents = students.filter(s => currentClass.studentIds.includes(s.id));
  const mod = modules.find(m => m.id === moduleId)!;
  const course = courses.find(c => c.id === currentClass.courseId);
  const group = Math.min(3, Math.floor(currentClass.conductedLessons.filter(l => l.startsWith(moduleId)).length / 6)) || 1;

  // scores[studentIdx][questionIdx]
  const [scores, setScores] = useState<Record<number, Record<number, OralScore>>>(() => {
    const init: Record<number, Record<number, OralScore>> = {};
    classStudents.forEach((_, si) => {
      init[si] = {};
      selectedQuestions.forEach((_, qi) => { init[si][qi] = { knowledge: 7, creativity: 7, conciseness: 7, objectivity: 7, observation: "" }; });
    });
    return init;
  });
  const [studentIdx, setStudentIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);

  const student = classStudents[studentIdx];
  const question = selectedQuestions[questionIdx];
  const currentScore = scores[studentIdx]?.[questionIdx] ?? { knowledge: 7, creativity: 7, conciseness: 7, objectivity: 7, observation: "" };

  function setScore(field: keyof OralScore, value: number | string) {
    setScores(p => ({
      ...p,
      [studentIdx]: { ...p[studentIdx], [questionIdx]: { ...p[studentIdx][questionIdx], [field]: value } }
    }));
  }

  function calcStudentTotal(si: number): number {
    const qScores = selectedQuestions.map((_, qi) => scores[si]?.[qi] ?? { knowledge: 7, creativity: 7, conciseness: 7, objectivity: 7, observation: "" });
    if (qScores.length === 0) return 0;
    const sum = qScores.reduce((acc, sc) => acc + calcOralScore(sc), 0);
    return Math.round(sum / qScores.length);
  }

  function handleSave() {
    const records: PeriodicAssessment[] = classStudents.map((s, si) => {
      const total = calcStudentTotal(si);
      const questionResults: QuestionResult[] = selectedQuestions.map((q, qi) => ({
        questionId: q.id,
        text: q.text,
        difficulty: q.difficulty,
        score: Math.round(calcOralScore(scores[si]?.[qi] ?? { knowledge: 7, creativity: 7, conciseness: 7, objectivity: 7, observation: "" }) / 10),
        observation: scores[si]?.[qi]?.observation ?? "",
      }));
      const final10 = Math.round((total / 10) * 10) / 10;
      const avgScores = ORAL_CRITERIA.reduce((acc, c) => {
        const avg = Math.round(selectedQuestions.reduce((sum, _, qi) => sum + ((scores[si]?.[qi]?.[c.id] as number) ?? 7), 0) / selectedQuestions.length);
        return { ...acc, [c.id]: avg };
      }, {} as PeriodicAssessment["scores"]);
      const feedback = selectedQuestions
        .map((q, qi) => scores[si]?.[qi]?.observation?.trim() ? `Q${qi + 1}: ${scores[si][qi].observation.trim()}` : "")
        .filter(Boolean)
        .join("\n");
      return { id: `pa-${uid()}`, classId, moduleId, group, studentId: s.id, generatedExamId, questionResults, scores: avgScores, total, final10, date: todayISO(), emailSent: false, feedback };
    });
    setPeriodic(mergeLatestByKey(periodic, records, periodicAssessmentUniqueKey));
    onDone(group);
  }

  const isLastQuestion = questionIdx === selectedQuestions.length - 1;
  const isLastStudent = studentIdx === classStudents.length - 1;
  const studentTotal = calcStudentTotal(studentIdx);
  const gi = gradeInfo(studentTotal);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title={`Prova Oral — Aluno ${studentIdx + 1}/${classStudents.length}`} onBack={onBack} />

      {/* Student + question progress */}
      <div className="px-4 pt-2 pb-1 shrink-0 max-w-full overflow-hidden">
        <div className="flex items-center gap-1 mb-1">
          {classStudents.map((_, i) => <div key={i} className={`flex-1 h-1 rounded-full ${i < studentIdx ? "bg-accent" : i === studentIdx ? "bg-primary" : "bg-border"}`} />)}
        </div>
        <div className="flex items-center gap-1">
          {selectedQuestions.map((_, i) => <div key={i} className={`flex-1 h-1 rounded-full ${i < questionIdx ? "bg-primary/50" : i === questionIdx ? "bg-primary" : "bg-border"}`} />)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Student header */}
        <div className="mx-4 mt-2 bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-4 text-white max-w-full overflow-hidden">
          <div className="flex items-center gap-3 mb-2 min-w-0">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">{initials(student.name)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[15px] truncate">{student.name}</p>
              <p className="text-blue-200 text-xs truncate">{currentClass.name}</p>
              <p className="text-blue-200 text-xs truncate">{course?.name} · Módulo {mod?.order} · {todayBR()}</p>
            </div>
            <div className="text-right"><p className="text-3xl font-black">{studentTotal}</p><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gi.cls}`}>{gi.label}</span></div>
          </div>
        </div>

        {/* Question card */}
        <div className="mx-4 mt-3 bg-card rounded-2xl border-2 border-primary/20 p-4 max-w-full overflow-hidden">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-primary">Questão {questionIdx + 1} de {selectedQuestions.length}</p>
            <Badge className={question.difficulty === "easy" ? "bg-green-100 text-green-700" : question.difficulty === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"}>
              {question.difficulty === "easy" ? "Fácil" : question.difficulty === "medium" ? "Média" : "Difícil"}
            </Badge>
          </div>
          <p className="text-sm font-semibold text-foreground break-words">{question.text}</p>
          {question.answer && <p className="text-xs text-muted-foreground mt-2 italic border-t border-border pt-2"><span className="font-semibold">Gabarito:</span> {question.answer}</p>}
        </div>

        {/* Criteria scoring */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Avaliação da Resposta:</p>
          {ORAL_CRITERIA.map(criterion => {
            const val = currentScore[criterion.id] as number;
            return (
              <div key={criterion.id} className="bg-card rounded-2xl border border-border p-4 max-w-full overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div><p className="font-bold text-sm">{criterion.label}</p><Badge className="bg-primary/10 text-primary mt-0.5">Peso {criterion.weight}</Badge></div>
                  <div className="text-right"><span className="text-3xl font-black text-primary">{val}</span><span className="text-muted-foreground text-sm">/10</span></div>
                </div>
                <input type="range" min={0} max={10} step={1} value={val} onChange={e => setScore(criterion.id, parseInt(e.target.value))}
                  className="block w-full max-w-full accent-primary" style={{ height: "24px" }} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0</span><span>5</span><span>10</span></div>
              </div>
            );
          })}
          {/* Observation */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">Observação (opcional)</label>
            <textarea value={currentScore.observation} onChange={e => setScore("observation", e.target.value)} rows={2}
              placeholder="Registre observações sobre a resposta do aluno..."
              className="w-full rounded-2xl border border-border bg-input-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
        </div>
        <div className="h-4" />
      </div>

      {/* Navigation */}
      <div className="px-4 py-4 bg-card border-t border-border shrink-0">
        <div className="flex gap-2">
          {questionIdx > 0 && <Btn variant="secondary" small onClick={() => setQuestionIdx(i => i - 1)} className="flex-1"><ChevronLeft size={15} /> Anterior</Btn>}
          {!isLastQuestion ? (
            <Btn onClick={() => setQuestionIdx(i => i + 1)} className="flex-1">Próxima questão <ChevronRight size={15} /></Btn>
          ) : !isLastStudent ? (
            <Btn variant="success" onClick={() => { setStudentIdx(i => i + 1); setQuestionIdx(0); }} className="flex-1">Finalizar aluno <ChevronRight size={15} /></Btn>
          ) : (
            <Btn variant="success" onClick={handleSave} className="flex-1"><Send size={15} /> Salvar e Enviar</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Avaliação: Done ──────────────────────────────────────────────────────────

function AvaliacaoDoneScreen({ classId, moduleId, group, students, modules, periodic, onNew }: {
  classId: string; moduleId: string; group: number; students: Student[]; modules: Module[]; periodic: PeriodicAssessment[]; onNew: () => void;
}) {
  const results = periodic.filter(p => p.classId === classId && p.moduleId === moduleId && p.group === group);
  const mod = modules.find(m => m.id === moduleId);
  const avg = results.length === 0 ? 0 : Math.round(results.reduce((s, p) => s + p.total, 0) / results.length);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 size={28} className="text-green-600 shrink-0" />
        <div><p className="font-bold text-green-700">Prova oral finalizada!</p><p className="text-xs text-green-600">Relatórios gerados para os alunos</p></div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <div><p className="text-xs text-muted-foreground">Módulo {mod?.order}: {mod?.name} · Grupo {group}</p><p className="font-bold text-[16px]">Resultados</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Média da turma</p><p className="text-2xl font-black text-primary">{avg}</p></div>
      </div>
      <div className="px-4 flex flex-col gap-2 pb-4">
        {results.map(p => {
          const student = students.find(s => s.id === p.studentId);
          const gi = gradeInfo(p.total);
          return (
            <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 shadow-sm">
              <AvatarCircle name={student?.name ?? "?"} />
              <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{student?.name}</p><div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Mail size={11} /> envio pelo relatório</div></div>
              <div className="text-right shrink-0"><p className="text-2xl font-black">{p.total}</p><Badge className={gi.cls}>{gi.label}</Badge></div>
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-4"><Btn fullWidth variant="secondary" onClick={onNew}>Nova Avaliação</Btn></div>
    </div>
  );
}

// ─── Relatórios ───────────────────────────────────────────────────────────────

function RelatorioList({ role, students, classes, currentProfessorId, periodic, onSelect }: {
  role: UserRole; students: Student[]; classes: Class[]; currentProfessorId?: string; periodic: PeriodicAssessment[]; onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const accessibleClassIds = role === "professor" ? classes.filter(c => c.teacherId === currentProfessorId).map(c => c.id) : classes.map(c => c.id);
  const filtered = students
    .filter(s => role === "admin" || s.classIds.some(id => accessibleClassIds.includes(id)))
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.enrollment.includes(search));
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno ou matrícula..."
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-muted-foreground px-4 pb-2">{filtered.length} aluno{filtered.length !== 1 ? "s" : ""}</p>
        <div className="flex flex-col gap-2 px-4 pb-4">
          {filtered.map(s => {
            const sPerf = periodic.filter(p => p.studentId === s.id);
            const avg = sPerf.length === 0 ? null : Math.round(sPerf.reduce((x, p) => x + p.total, 0) / sPerf.length);
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 text-left active:scale-[0.98] transition-all shadow-sm group focus:outline-none">
                <AvatarCircle name={s.name} />
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{s.name}</p><p className="text-xs text-muted-foreground">Mat. {s.enrollment} · {s.classIds.length} turma{s.classIds.length > 1 ? "s" : ""}</p></div>
                {avg !== null ? <div className="text-right shrink-0"><p className="text-lg font-black">{avg}</p><Badge className={gradeInfo(avg).cls}>{gradeInfo(avg).label}</Badge></div> : <Badge className="bg-muted text-muted-foreground shrink-0">Sem dados</Badge>}
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AssessmentEditModal({ assessment, onSave, onClose }: { assessment: PeriodicAssessment; onSave: (p: PeriodicAssessment) => void; onClose: () => void }) {
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>(
    assessment.questionResults?.length
      ? assessment.questionResults
      : [{ questionId: "final", text: "Nota final da avaliacao", difficulty: "medium", score: assessment.final10 ?? Math.round(assessment.total / 10), observation: assessment.feedback ?? "" }]
  );

  function updateScore(index: number, score: number) {
    setQuestionResults(items => items.map((item, i) => i === index ? { ...item, score: Math.max(0, Math.min(10, score)) } : item));
  }

  function updateObservation(index: number, observation: string) {
    setQuestionResults(items => items.map((item, i) => i === index ? { ...item, observation } : item));
  }

  function save() {
    const final10 = questionResults.length === 0 ? 0 : Math.round((questionResults.reduce((sum, q) => sum + q.score, 0) / questionResults.length) * 10) / 10;
    const total = Math.round(final10 * 10);
    const feedback = questionResults.map((q, i) => q.observation.trim() ? `Q${i + 1}: ${q.observation.trim()}` : "").filter(Boolean).join("\n");
    onSave({
      ...assessment,
      questionResults: assessment.questionResults?.length ? questionResults : assessment.questionResults,
      final10,
      total,
      feedback,
      scores: { knowledge: final10, creativity: final10, objectivity: final10, conciseness: final10 },
    });
  }

  return (
    <Modal title="Editar nota" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {questionResults.map((qr, index) => (
          <div key={`${qr.questionId}-${index}`} className="rounded-2xl border border-border bg-card p-3">
            <p className="text-sm font-semibold mb-2">{qr.text}</p>
            <div className="flex items-center gap-3">
              <input type="number" min={0} max={10} step={1} value={qr.score} onChange={e => updateScore(index, Number(e.target.value))}
                className="w-20 rounded-xl border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
            <textarea value={qr.observation} onChange={e => updateObservation(index, e.target.value)} rows={2}
              placeholder="Observacao ou feedback"
              className="mt-2 w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
        ))}
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancelar</Btn>
          <Btn variant="success" onClick={save} className="flex-1"><Check size={15} /> Salvar</Btn>
        </div>
      </div>
    </Modal>
  );
}

function RelatorioDetail({ studentId, students, classes, courses, modules, periodic, setPeriodic, attendance, onBack, showToast }: {
  studentId: string; students: Student[]; classes: Class[]; courses: Course[]; modules: Module[]; periodic: PeriodicAssessment[]; setPeriodic: (p: PeriodicAssessment[]) => void; attendance: AttendanceRecord[]; onBack: () => void; showToast: (m: string) => void;
}) {
  const [editingAssessment, setEditingAssessment] = useState<PeriodicAssessment | null>(null);
  const student = students.find(s => s.id === studentId)!;
  const sPerf = periodic.filter(p => p.studentId === studentId);
  const sAtt = attendance.filter(a => a.studentId === studentId);
  const presentCount = sAtt.filter(a => a.status === "present").length;
  const attendancePct = sAtt.length === 0 ? 0 : Math.round((presentCount / sAtt.length) * 100);
  const avg = sPerf.length === 0 ? 0 : Math.round(sPerf.reduce((s, p) => s + p.total, 0) / sPerf.length);
  const gi = gradeInfo(avg);

  const GRADE_TABLE = [
    { range: "0 – 60", label: "Reprovado", cls: "bg-red-100 text-red-700" },
    { range: "61 – 69", label: "Regular", cls: "bg-orange-100 text-orange-700" },
    { range: "70 – 79", label: "Bom", cls: "bg-yellow-100 text-yellow-800" },
    { range: "80 – 89", label: "Muito Bom", cls: "bg-blue-100 text-blue-700" },
    { range: "Acima de 90", label: "Excelente", cls: "bg-green-100 text-green-700" },
  ];
  const lastFeedback = [...sPerf].reverse().find(p => p.feedback?.trim())?.feedback;

  function sendEmail() {
    setPeriodic(periodic.map(p => p.studentId === studentId ? { ...p, emailSent: true } : p));
    showToast("Relatório enviado para o e-mail cadastrado.");
  }

  function saveEditedAssessment(updated: PeriodicAssessment) {
    setPeriodic(periodic.map(p => p.id === updated.id ? updated : p));
    setEditingAssessment(null);
    showToast("Nota atualizada.");
  }

  const radarData = sPerf.length > 0 ? [
    { subject: "Domínio", A: Math.round(sPerf.reduce((s, p) => s + p.scores.knowledge, 0) / sPerf.length), fullMark: 10 },
    { subject: "Criativid.", A: Math.round(sPerf.reduce((s, p) => s + p.scores.creativity, 0) / sPerf.length), fullMark: 10 },
    { subject: "Objetivid.", A: Math.round(sPerf.reduce((s, p) => s + p.scores.objectivity, 0) / sPerf.length), fullMark: 10 },
    { subject: "Concisão", A: Math.round(sPerf.reduce((s, p) => s + p.scores.conciseness, 0) / sPerf.length), fullMark: 10 },
  ] : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Relatório do Aluno" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="bg-gradient-to-br from-primary to-blue-700 px-5 pt-4 pb-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-xl">{initials(student.name)}</div>
            <div><p className="font-black text-lg">{student.name}</p><p className="text-blue-200 text-sm">Mat. {student.enrollment}</p><p className="text-blue-200 text-xs">{student.email}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/20 rounded-xl p-3 text-center"><p className="text-2xl font-black">{avg || "—"}</p><p className="text-[11px] text-blue-100">Nota Média</p></div>
            <div className={`rounded-xl p-3 text-center ${attendancePct >= 75 ? "bg-green-500/80" : "bg-orange-400/80"}`}><p className="text-2xl font-black">{attendancePct}%</p><p className="text-[11px] text-white/90">Frequência</p></div>
            <div className="bg-white/20 rounded-xl p-3 text-center"><p className="text-2xl font-black">{sPerf.length}</p><p className="text-[11px] text-blue-100">Avaliações</p></div>
          </div>
        </div>

        {sPerf.length > 0 && (
          <>
            <div className="mx-4 mt-4 bg-card rounded-2xl border border-border p-4 flex items-center justify-between shadow-sm">
              <div><p className="text-sm text-muted-foreground">Conceito Atual</p><p className="text-3xl font-black">{avg}</p></div>
              <Badge className={`${gi.cls} text-base px-4 py-1.5`}>{gi.label}</Badge>
            </div>

            {radarData.length > 0 && (
              <div className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 shadow-sm">
                <p className="font-bold text-sm mb-2">Perfil de Competências</p>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}><PolarGrid stroke="#eef2ff" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} /><Radar name="Aluno" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} /></RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mx-4 mt-3 bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-border"><p className="font-bold text-sm">Tabela Comparativa</p></div>
              {GRADE_TABLE.map((row, i) => {
                const isCurrent = gi.label === row.label;
                return (
                  <div key={row.range} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""} ${isCurrent ? "bg-primary/5" : ""}`}>
                    <span className={`text-sm ${isCurrent ? "font-bold text-primary" : ""}`}>{row.range}</span>
                    <div className="flex items-center gap-2"><Badge className={row.cls}>{row.label}</Badge>{isCurrent && <Check size={14} className="text-primary" />}</div>
                  </div>
                );
              })}
            </div>

            <div className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 shadow-sm">
              <p className="font-bold text-sm mb-1">Feedback/observações</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{lastFeedback || "Sem observações registradas na última avaliação."}</p>
            </div>

            <div className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">E-mail cadastrado</p>
              <p className="text-sm font-semibold mb-3">{student.email}</p>
              <Btn fullWidth variant="success" onClick={sendEmail}><Mail size={16} /> Enviar relatório por e-mail</Btn>
            </div>

            <div className="mx-4 mt-3">
              <p className="font-bold text-sm mb-2">Histórico de Avaliações</p>
              <div className="flex flex-col gap-2">
                {sPerf.map(p => {
                  const mod = modules.find(m => m.id === p.moduleId);
                  const gi2 = gradeInfo(p.total);
                  return (
                    <div key={p.id} className="bg-card rounded-2xl border border-border px-4 py-3 shadow-sm">
                      <div className="flex-1"><p className="text-sm font-semibold">Módulo {mod?.order} · Grupo {p.group}</p><p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("pt-BR")}</p>{p.emailSent && <div className="flex items-center gap-1 text-xs text-green-600 mt-0.5"><Mail size={10} /> e-mail enviado</div>}</div>
                      <div className="text-right"><p className="text-2xl font-black">{p.total}</p><Badge className={gi2.cls}>{gi2.label}</Badge></div>
                      <button onClick={() => setEditingAssessment(p)} className="mt-3 w-full rounded-xl bg-blue-50 text-primary px-3 py-2 text-xs font-bold active:scale-[0.98]">
                        Editar nota
                      </button>
                      {editingAssessment?.id === p.id && <AssessmentEditModal assessment={editingAssessment} onSave={saveEditedAssessment} onClose={() => setEditingAssessment(null)} />}
                      {p.questionResults && p.questionResults.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {p.questionResults.map((qr, idx) => (
                            <div key={`${p.id}-${qr.questionId}-${idx}`} className="rounded-xl bg-muted/40 border border-border px-3 py-2">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-bold text-muted-foreground mt-0.5">Q{idx + 1}</span>
                                <div className="flex-1">
                                  <p className="text-xs font-medium">{qr.text}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Dificuldade: {qr.difficulty === "easy" ? "Facil" : qr.difficulty === "medium" ? "Media" : "Dificil"} · Nota: {qr.score}/10</p>
                                  {qr.observation && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">Obs.: {qr.observation}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {sPerf.length === 0 && <div className="mx-4 mt-8 text-center"><Award size={40} className="text-muted-foreground mx-auto mb-3" /><p className="font-semibold">Sem avaliações ainda</p><p className="text-sm text-muted-foreground mt-1">As avaliações periódicas aparecerão aqui</p></div>}
      </div>
    </div>
  );
}

// ─── Admin Menu ───────────────────────────────────────────────────────────────



// ─── 6. Admin: Turmas CRUD ────────────────────────────────────────────────────

function AdminTurmasScreen({ classes, setClasses, students, setStudents, courses, modules, professors, onBack }: {
  classes: Class[]; setClasses: (c: Class[]) => void; students: Student[]; setStudents: (s: Student[]) => void; courses: Course[]; modules: Module[]; professors: Professor[]; onBack?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; data: Partial<Class> } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const filtered = classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const activeProfessors = professors.filter(p => p.status === "ativo");

  const emptyForm = (): Partial<Class> => ({ name: "", courseId: "", teacherId: "", studentIds: [], conductedLessons: [], schedule: "", status: "ativo" });

  function save() {
    if (!modal) return;
    const d = modal.data;
    if (!d.name?.trim()) { setFormError("Informe o nome da turma."); return; }
    if (!d.courseId) { setFormError("Selecione um curso."); return; }
    if (!d.teacherId) { setFormError("Selecione um professor."); return; }
    if (!d.studentIds || d.studentIds.length < 1) { setFormError("Selecione pelo menos 1 aluno."); return; }
    if (d.studentIds.length > 10) { setFormError("A turma pode ter no máximo 10 alunos."); return; }
    const id = d.id ?? `t-${uid()}`;
    const nextClass = { ...emptyForm(), ...d, id } as Class;
    if (modal.mode === "create") {
      setClasses([...classes, nextClass]);
    } else {
      setClasses(classes.map(c => c.id === id ? nextClass : c));
    }
    setStudents(students.map(s => {
      const withoutClass = s.classIds.filter(cid => cid !== id);
      return (d.studentIds ?? []).includes(s.id) ? { ...s, classIds: unique([...withoutClass, id]) } : { ...s, classIds: withoutClass };
    }));
    setFormError("");
    setModal(null);
  }

  function del(id: string) {
    setClasses(classes.filter(c => c.id !== id));
    setStudents(students.map(s => ({ ...s, classIds: s.classIds.filter(cid => cid !== id) })));
    setConfirm(null);
  }

  const f = modal?.data ?? {};

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Turmas" onBack={onBack}
        rightSlot={<button onClick={() => { setModal({ mode: "create", data: emptyForm() }); setFormError(""); }} className="p-2 rounded-xl bg-primary text-white active:scale-90 transition-all"><Plus size={18} /></button>} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar turma..." className="w-full rounded-2xl border border-border bg-card pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="px-4 flex flex-col gap-2 pb-4">
          {filtered.map(cl => {
            const course = courses.find(c => c.id === cl.courseId);
            const pct = Math.round((cl.conductedLessons.length / 180) * 100);
            return (
              <div key={cl.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Users size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{cl.name}</p>
                    <p className="text-xs text-muted-foreground">{course?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{professors.find(p => p.id === cl.teacherId)?.name ?? "Sem professor"}</p>
                    <p className="text-xs text-muted-foreground">{cl.studentIds.length} alunos · {cl.schedule || "Sem horário"}</p>
                    <Badge className={cl.status === "ativo" ? "bg-green-100 text-green-700 mt-1" : "bg-muted text-muted-foreground mt-1"}>{cl.status}</Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setModal({ mode: "edit", data: { ...cl } }); setFormError(""); }} className="p-2 rounded-xl active:bg-muted transition-colors" aria-label="Editar"><Pencil size={14} className="text-muted-foreground" /></button>
                    <button onClick={() => setConfirm(cl.id)} className="p-2 rounded-xl active:bg-red-50 transition-colors" aria-label="Excluir"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs text-muted-foreground">{pct}%</span></div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhuma turma encontrada</p>}
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Nova Turma" : "Editar Turma"} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Nome da turma" value={f.name ?? ""} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, name: v } }))} placeholder="Ex: Dev Web — Turma A" required />
            <SelField label="Curso vinculado" value={f.courseId ?? ""} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, courseId: v, currentModuleId: "" } }))} options={courses.map(c => ({ value: c.id, label: c.name }))} required />
            <SelField label="Módulo atual" value={f.currentModuleId ?? ""} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, currentModuleId: v } }))} options={modules.filter(m => m.courseId === f.courseId).map(m => ({ value: m.id, label: `Módulo ${m.order}: ${m.name}` }))} disabled={!f.courseId} />
            <SelField label="Professor responsável" value={f.teacherId ?? ""} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, teacherId: v } }))}
              options={activeProfessors.map(p => ({ value: p.id, label: p.name }))} required />
            <Field label="Horário" value={f.schedule ?? ""} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, schedule: v } }))} placeholder="Ex: Seg/Qua 08h–10h" />
            <SelField label="Status" value={f.status ?? "ativo"} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, status: v } }))}
              options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "concluido", label: "Concluído" }]} />
            <div>
              <label className="block text-sm font-semibold mb-2">Alunos vinculados <span className="text-red-500">*</span></label>
              <div className="bg-muted/40 rounded-2xl border border-border overflow-hidden max-h-48 overflow-y-auto">
                {students.map((student, i) => {
                  const linked = (f.studentIds ?? []).includes(student.id);
                  return (
                    <button key={student.id} type="button" onClick={() => {
                      const cur = f.studentIds ?? [];
                      const next = linked ? cur.filter(id => id !== student.id) : [...cur, student.id];
                      setModal(m => m && ({ ...m, data: { ...m.data, studentIds: next } }));
                      setFormError("");
                    }} className={`flex items-center gap-3 w-full px-4 py-3 text-left ${i > 0 ? "border-t border-border" : ""} ${linked ? "bg-blue-50" : ""}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${linked ? "bg-primary border-primary" : "border-border"}`}>{linked && <Check size={12} className="text-white" />}</div>
                      <span className={`text-sm flex-1 ${linked ? "font-semibold text-primary" : ""}`}>{student.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{(f.studentIds ?? []).length}/10 alunos selecionados</p>
            </div>
            {formError && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm"><AlertTriangle size={14} /> {formError}</div>}
            <div className="flex gap-2 mt-2">
              <Btn variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancelar</Btn>
              <Btn variant="success" onClick={save} className="flex-1"><Check size={15} /> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmModal message="Deseja excluir esta turma? Esta ação não pode ser desfeita." onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── 7+8. Admin: Alunos CRUD ──────────────────────────────────────────────────

function AdminAlunosScreen({ students, setStudents, classes, setClasses, courses, onBack, showToast }: {
  students: Student[]; setStudents: (s: Student[]) => void; classes: Class[]; setClasses: (c: Class[]) => void; courses: Course[]; onBack?: () => void; showToast: (m: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; data: Partial<Student> } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.enrollment.includes(search) || s.email.includes(search));

  const emptyForm = (): Partial<Student> => ({ name: "", email: "", enrollment: "", classIds: [], status: "ativo" });

  function save() {
    if (!modal) return;
    const d = modal.data;
    if (!d.name?.trim()) { setFormError("Nome obrigatório."); return; }
    if (!d.email?.trim()) { setFormError("E-mail obrigatório."); return; }
    if (!d.enrollment?.trim()) { setFormError("Matrícula obrigatória."); return; }
    setFormError("");
    const id = d.id ?? `s-${uid()}`;
    if (modal.mode === "create") {
      const newStudent: Student = { id, name: d.name, email: d.email, enrollment: d.enrollment, classIds: d.classIds ?? [], status: d.status ?? "ativo" };
      setStudents([...students, newStudent]);
      showToast("✓ Aluno cadastrado com sucesso!");
    } else {
      setStudents(students.map(s => s.id === d.id ? { ...s, ...d } as Student : s));
      showToast("✓ Aluno atualizado!");
    }
    setClasses(classes.map(c => {
      const withoutStudent = c.studentIds.filter(sid => sid !== id);
      return (d.classIds ?? []).includes(c.id) ? { ...c, studentIds: unique([...withoutStudent, id]).slice(0, 10) } : { ...c, studentIds: withoutStudent };
    }));
    setModal(null);
  }

  function del(id: string) {
    setStudents(students.filter(s => s.id !== id));
    setClasses(classes.map(c => ({ ...c, studentIds: c.studentIds.filter(sid => sid !== id) })));
    setConfirm(null);
    showToast("Aluno removido.");
  }

  const f = modal?.data ?? {};

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Alunos" onBack={onBack}
        rightSlot={<button onClick={() => { setModal({ mode: "create", data: emptyForm() }); setFormError(""); }} className="p-2 rounded-xl bg-primary text-white active:scale-90 transition-all"><Plus size={18} /></button>} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou matrícula..." className="w-full rounded-2xl border border-border bg-card pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-4 pb-2">{filtered.length} aluno{filtered.length !== 1 ? "s" : ""}</p>
        <div className="px-4 flex flex-col gap-2 pb-4">
          {filtered.map(s => {
            const sClasses = classes.filter(c => s.classIds.includes(c.id));
            return (
              <div key={s.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <AvatarCircle name={s.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                    <p className="text-xs text-muted-foreground">Mat. {s.enrollment}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sClasses.map(c => <Badge key={c.id} className="bg-blue-50 text-blue-700 text-[10px]">{c.name.split("—")[0].trim()}</Badge>)}
                      <Badge className={s.status === "ativo" ? "bg-green-100 text-green-700 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{s.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setModal({ mode: "edit", data: { ...s } }); setFormError(""); }} className="p-2 rounded-xl active:bg-muted transition-colors"><Pencil size={14} className="text-muted-foreground" /></button>
                    <button onClick={() => setConfirm(s.id)} className="p-2 rounded-xl active:bg-red-50 transition-colors"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum aluno encontrado</p>}
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Novo Aluno" : "Editar Aluno"} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Nome completo" value={f.name ?? ""} onChange={v => { setModal(m => m && ({ ...m, data: { ...m.data, name: v } })); setFormError(""); }} placeholder="Ex: João da Silva" required />
            <Field label="E-mail" value={f.email ?? ""} onChange={v => { setModal(m => m && ({ ...m, data: { ...m.data, email: v } })); setFormError(""); }} placeholder="joao@email.com" type="email" required />
            <Field label="Matrícula" value={f.enrollment ?? ""} onChange={v => { setModal(m => m && ({ ...m, data: { ...m.data, enrollment: v } })); setFormError(""); }} placeholder="2024XXX" required />
            <SelField label="Status" value={f.status ?? "ativo"} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, status: v } }))}
              options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "trancado", label: "Trancado" }]} />
            <div>
              <label className="block text-sm font-semibold mb-2">Turmas vinculadas</label>
              <div className="bg-muted/40 rounded-2xl border border-border overflow-hidden max-h-40 overflow-y-auto">
                {classes.map((cl, i) => {
                  const linked = (f.classIds ?? []).includes(cl.id);
                  return (
                    <button key={cl.id} type="button" onClick={() => {
                      const cur = f.classIds ?? [];
                      const next = linked ? cur.filter(id => id !== cl.id) : [...cur, cl.id];
                      setModal(m => m && ({ ...m, data: { ...m.data, classIds: next } }));
                    }} className={`flex items-center gap-3 w-full px-4 py-3 text-left ${i > 0 ? "border-t border-border" : ""} ${linked ? "bg-blue-50" : ""}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${linked ? "bg-primary border-primary" : "border-border"}`}>{linked && <Check size={12} className="text-white" />}</div>
                      <span className={`text-sm flex-1 ${linked ? "font-semibold text-primary" : ""}`}>{cl.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {formError && <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm"><AlertTriangle size={14} /> {formError}</div>}
            <div className="flex gap-2 mt-2">
              <Btn variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancelar</Btn>
              <Btn variant="success" onClick={save} className="flex-1"><Check size={15} /> Salvar Aluno</Btn>
            </div>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmModal message="Deseja excluir este aluno? Esta ação não pode ser desfeita." onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── Admin: Professores CRUD ─────────────────────────────────────────────────

function AdminProfessoresScreen({ professors, setProfessors, classes, setClasses, onBack, showToast }: {
  professors: Professor[]; setProfessors: (p: Professor[]) => void; classes: Class[]; setClasses: (c: Class[]) => void; onBack?: () => void; showToast: (m: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; data: Partial<Professor> } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState("");

  const filtered = professors.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
  );

  const emptyForm = (): Partial<Professor> => ({ name: "", email: "", password: "", status: "ativo", classIds: [] });

  function save() {
    if (!modal) return;
    const d = modal.data;
    if (!d.name?.trim()) { setFormError("Nome obrigatório."); return; }
    if (!d.email?.trim()) { setFormError("E-mail obrigatório."); return; }
    if (modal.mode === "create" && !d.password?.trim()) { setFormError("Senha provisória obrigatória."); return; }
    setFormError("");
    if (modal.mode === "create") {
      const newId = `prof-${uid()}`;
      const newProf: Professor = { id: newId, name: d.name, email: d.email, password: d.password ?? "", status: d.status ?? "ativo", classIds: d.classIds ?? [] };
      setProfessors([...professors, newProf]);
      setClasses(classes.map(c => (d.classIds ?? []).includes(c.id) ? { ...c, teacherId: newId } : c));
      showToast("✓ Professor cadastrado com sucesso!");
    } else {
      setProfessors(professors.map(p => p.id === d.id ? { ...p, ...d } as Professor : p));
      setClasses(classes.map(c => (d.classIds ?? []).includes(c.id) ? { ...c, teacherId: d.id! } : c.teacherId === d.id ? { ...c, teacherId: "" } : c));
      showToast("✓ Professor atualizado!");
    }
    setModal(null);
  }

  function del(id: string) { setProfessors(professors.filter(p => p.id !== id)); setConfirm(null); showToast("Professor removido."); }

  const f = modal?.data ?? {};

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Professores" onBack={onBack}
        rightSlot={<button onClick={() => { setModal({ mode: "create", data: emptyForm() }); setFormError(""); setShowPass(false); }} className="p-2 rounded-xl bg-primary text-white active:scale-90 transition-all"><Plus size={18} /></button>} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..."
              className="w-full rounded-2xl border border-border bg-card pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-4 pb-2">{filtered.length} professor{filtered.length !== 1 ? "es" : ""}</p>
        <div className="px-4 flex flex-col gap-2 pb-4">
          {filtered.map(prof => {
            const profClasses = classes.filter(c => prof.classIds.includes(c.id));
            return (
              <div key={prof.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${prof.status === "ativo" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
                    {initials(prof.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{prof.name}</p>
                    <p className="text-xs text-muted-foreground">{prof.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge className={prof.status === "ativo" ? "bg-green-100 text-green-700 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{prof.status}</Badge>
                      {profClasses.length > 0
                        ? profClasses.map(c => <Badge key={c.id} className="bg-blue-50 text-blue-700 text-[10px]">{c.name.split("—")[0].trim()}</Badge>)
                        : <Badge className="bg-muted text-muted-foreground text-[10px]">Sem turma</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setModal({ mode: "edit", data: { ...prof } }); setFormError(""); setShowPass(false); }} className="p-2 rounded-xl active:bg-muted transition-colors"><Pencil size={14} className="text-muted-foreground" /></button>
                    <button onClick={() => setConfirm(prof.id)} className="p-2 rounded-xl active:bg-red-50 transition-colors"><Trash2 size={14} className="text-red-500" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum professor encontrado</p>}
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Novo Professor" : "Editar Professor"} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Nome completo" value={f.name ?? ""} onChange={v => { setModal(m => m && ({ ...m, data: { ...m.data, name: v } })); setFormError(""); }} placeholder="Ex: Carlos Silva" required />
            <Field label="E-mail de acesso" value={f.email ?? ""} onChange={v => { setModal(m => m && ({ ...m, data: { ...m.data, email: v } })); setFormError(""); }} placeholder="prof@aprender.edu.br" type="email" required />

            {/* Password with toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Senha provisória {modal.mode === "create" && <span className="text-red-500">*</span>}</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={f.password ?? ""} onChange={e => { setModal(m => m && ({ ...m, data: { ...m.data, password: e.target.value } })); setFormError(""); }}
                  placeholder={modal.mode === "edit" ? "Deixe em branco para manter" : "Mínimo 8 caracteres"}
                  className="w-full rounded-2xl border border-border bg-input-background px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/40 pr-10" />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {f.password && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <KeyRound size={12} />
                  <span>O professor usará esta senha para fazer login</span>
                </div>
              )}
            </div>

            <SelField label="Status" value={f.status ?? "ativo"} onChange={v => setModal(m => m && ({ ...m, data: { ...m.data, status: v } }))}
              options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />

            {/* Turmas vinculadas (multi-select checkboxes) */}
            <div>
              <label className="block text-sm font-semibold mb-2">Turmas vinculadas</label>
              <div className="bg-muted/40 rounded-2xl border border-border overflow-hidden max-h-40 overflow-y-auto">
                {classes.length === 0 && <p className="text-xs text-muted-foreground px-4 py-3">Nenhuma turma cadastrada</p>}
                {classes.map((cl, i) => {
                  const linked = (f.classIds ?? []).includes(cl.id);
                  return (
                    <button key={cl.id} type="button" onClick={() => {
                      const cur = f.classIds ?? [];
                      const next = linked ? cur.filter(id => id !== cl.id) : [...cur, cl.id];
                      setModal(m => m && ({ ...m, data: { ...m.data, classIds: next } }));
                    }} className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-all ${i > 0 ? "border-t border-border" : ""} ${linked ? "bg-blue-50" : ""}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${linked ? "bg-primary border-primary" : "border-border"}`}>
                        {linked && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                      <span className={`text-sm flex-1 ${linked ? "font-semibold text-primary" : ""}`}>{cl.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm">
                <AlertTriangle size={14} /> {formError}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <Btn variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancelar</Btn>
              <Btn variant="success" onClick={save} className="flex-1"><Check size={15} /> Salvar Professor</Btn>
            </div>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmModal message="Deseja excluir este professor? Esta ação não pode ser desfeita." onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── 9+10. Admin: Cursos e Módulos CRUD ──────────────────────────────────────

function AdminCursosScreen({ courses, setCourses, modules, setModules, questions, setQuestions, onBack }: {
  courses: Course[]; setCourses: (c: Course[]) => void; modules: Module[]; setModules: (m: Module[]) => void;
  questions: Question[]; setQuestions: (q: Question[]) => void; onBack?: () => void;
}) {
  const [view, setView] = useState<"cursos" | "questoes">("cursos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [courseModal, setCourseModal] = useState<{ mode: "create" | "edit"; data: Partial<Course> } | null>(null);
  const [modModal, setModModal] = useState<{ mode: "create" | "edit"; courseId: string; data: Partial<Module> } | null>(null);
  const [confirm, setConfirm] = useState<{ type: "course" | "module"; id: string } | null>(null);

  const emptyCourse = (): Partial<Course> => ({ name: "", area: "" });
  const emptyMod = (courseId: string): Partial<Module> => ({ courseId, name: "", order: modules.filter(m => m.courseId === courseId).length + 1, lessonCount: 18, status: "ativo" });

  function saveCourse() {
    if (!courseModal) return;
    const d = courseModal.data;
    if (!d.name?.trim()) return;
    if (courseModal.mode === "create") {
      setCourses([...courses, { id: `c-${uid()}`, name: d.name, area: d.area ?? "Profissionalizante" }]);
    } else {
      setCourses(courses.map(c => c.id === d.id ? { ...c, ...d } as Course : c));
    }
    setCourseModal(null);
  }

  function saveMod() {
    if (!modModal) return;
    const d = modModal.data;
    if (!d.name?.trim()) return;
    if (modModal.mode === "create") {
      setModules([...modules, { id: `mod-${uid()}`, courseId: modModal.courseId, name: d.name, order: d.order ?? 1, lessonCount: d.lessonCount ?? 18, status: d.status ?? "ativo" }]);
    } else {
      setModules(modules.map(m => m.id === d.id ? { ...m, ...d } as Module : m));
    }
    setModModal(null);
  }

  function delMod(id: string) { setModules(modules.filter(m => m.id !== id)); setConfirm(null); }
  function delCourse(id: string) {
    setCourses(courses.filter(c => c.id !== id));
    setModules(modules.filter(m => m.courseId !== id));
    setQuestions(questions.filter(q => q.courseId !== id));
    setConfirm(null);
  }

  const mf = modModal?.data ?? {};
  const cf = courseModal?.data ?? {};

  if (view === "questoes") {
    return <AdminQuestoesScreen questions={questions} setQuestions={setQuestions} courses={courses} modules={modules} onBack={() => setView("cursos")} />;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar title="Cursos e Módulos" onBack={onBack} rightSlot={<button onClick={() => setCourseModal({ mode: "create", data: emptyCourse() })} className="p-2 rounded-xl bg-primary text-white active:scale-90"><Plus size={18} /></button>} />
      {/* Toggle between Módulos and Questões */}
      <div className="flex gap-2 px-4 pt-3 pb-0 shrink-0">
        <button onClick={() => setView("cursos")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-primary text-white"><BookOpen size={14} /> Cursos</button>
        <button onClick={() => setView("questoes")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-muted text-muted-foreground"><Database size={14} /> Questões</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2 pb-4">
          {courses.map(course => {
            const mods = modules.filter(m => m.courseId === course.id);
            const isExp = expanded === course.id;
            return (
              <div key={course.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-4">
                  <button onClick={() => setExpanded(isExp ? null : course.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left active:bg-muted/40 transition-colors rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"><BookOpen size={18} /></div>
                    <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{course.name}</p><p className="text-xs text-muted-foreground">{course.area} · {mods.length} módulo{mods.length !== 1 ? "s" : ""}</p></div>
                    <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isExp ? "rotate-180" : ""}`} />
                  </button>
                  <button onClick={() => setCourseModal({ mode: "edit", data: { ...course } })} className="p-2 rounded-xl active:bg-muted"><Pencil size={13} className="text-muted-foreground" /></button>
                  <button onClick={() => setConfirm({ type: "course", id: course.id })} className="p-2 rounded-xl active:bg-red-50"><Trash2 size={13} className="text-red-500" /></button>
                </div>
                {isExp && (
                  <>
                    {mods.map((m, i) => (
                      <div key={m.id} className={`flex items-center gap-3 px-4 py-3 bg-muted/20 ${i >= 0 ? "border-t border-border" : ""}`}>
                        <div className="w-7 h-7 rounded-lg bg-white border border-border flex items-center justify-center text-xs font-bold">{m.order}</div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.name}</p><p className="text-xs text-muted-foreground">{m.lessonCount} lições · <Badge className={m.status === "ativo" ? "bg-green-100 text-green-700 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{m.status}</Badge></p></div>
                        <button onClick={() => setModModal({ mode: "edit", courseId: course.id, data: { ...m } })} className="p-2 rounded-xl active:bg-muted"><Pencil size={13} className="text-muted-foreground" /></button>
                        <button onClick={() => setConfirm({ type: "module", id: m.id })} className="p-2 rounded-xl active:bg-red-50"><Trash2 size={13} className="text-red-500" /></button>
                      </div>
                    ))}
                    <button onClick={() => setModModal({ mode: "create", courseId: course.id, data: emptyMod(course.id) })}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-primary font-semibold border-t border-border w-full active:bg-blue-50 transition-colors">
                      <Plus size={15} /> Adicionar Módulo
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modModal && (
        <Modal title={modModal.mode === "create" ? "Novo Módulo" : "Editar Módulo"} onClose={() => setModModal(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Nome do módulo" value={mf.name ?? ""} onChange={v => setModModal(m => m && ({ ...m, data: { ...m.data, name: v } }))} placeholder="Ex: Fundamentos de HTML5" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ordem" value={String(mf.order ?? "")} onChange={v => setModModal(m => m && ({ ...m, data: { ...m.data, order: parseInt(v) || 1 } }))} type="number" />
              <Field label="Qtd. de Lições" value={String(mf.lessonCount ?? 18)} onChange={v => setModModal(m => m && ({ ...m, data: { ...m.data, lessonCount: parseInt(v) || 18 } }))} type="number" />
            </div>
            <SelField label="Status" value={mf.status ?? "ativo"} onChange={v => setModModal(m => m && ({ ...m, data: { ...m.data, status: v } }))}
              options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />
            <div className="flex gap-2 mt-2">
              <Btn variant="secondary" onClick={() => setModModal(null)} className="flex-1">Cancelar</Btn>
              <Btn variant="success" onClick={saveMod} disabled={!mf.name?.trim()} className="flex-1"><Check size={15} /> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {courseModal && (
        <Modal title={courseModal.mode === "create" ? "Novo Curso" : "Editar Curso"} onClose={() => setCourseModal(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Nome do curso" value={cf.name ?? ""} onChange={v => setCourseModal(m => m && ({ ...m, data: { ...m.data, name: v } }))} placeholder="Ex: Informática Profissional" required />
            <Field label="Área" value={cf.area ?? ""} onChange={v => setCourseModal(m => m && ({ ...m, data: { ...m.data, area: v } }))} placeholder="Ex: Tecnologia" />
            <div className="flex gap-2 mt-2">
              <Btn variant="secondary" onClick={() => setCourseModal(null)} className="flex-1">Cancelar</Btn>
              <Btn variant="success" onClick={saveCourse} disabled={!cf.name?.trim()} className="flex-1"><Check size={15} /> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {confirm?.type === "module" && <ConfirmModal message="Deseja excluir este módulo? Esta ação não pode ser desfeita." onConfirm={() => delMod(confirm.id)} onCancel={() => setConfirm(null)} />}
      {confirm?.type === "course" && <ConfirmModal message="Deseja excluir este curso e seus módulos? Esta ação não pode ser desfeita." onConfirm={() => delCourse(confirm.id)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── Admin: Banco de Questões ─────────────────────────────────────────────────

function AdminQuestoesScreen({ questions, setQuestions, courses, modules, onBack }: {
  questions: Question[]; setQuestions: (q: Question[]) => void; courses: Course[]; modules: Module[]; onBack: () => void;
}) {
  const [search, setSearch] = useState(""); const [filterDiff, setFilterDiff] = useState(""); const [filterCourse, setFilterCourse] = useState(""); const [filterModule, setFilterModule] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newQ, setNewQ] = useState({ courseId: "", moduleId: "", lessonId: "", text: "", difficulty: "easy" as Question["difficulty"], answer: "", status: "ativa" as Question["status"] });
  const filtered = questions.filter(q =>
    (!filterDiff || q.difficulty === filterDiff) &&
    (!filterCourse || q.courseId === filterCourse) &&
    (!filterModule || q.moduleId === filterModule) &&
    (!search || q.text.toLowerCase().includes(search.toLowerCase()))
  );
  const newMods = modules.filter(m => m.courseId === newQ.courseId);
  const newLessons = generateLessons(newMods.filter(m => m.id === newQ.moduleId));
  const diffColors: Record<string, string> = { easy: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-800", hard: "bg-red-100 text-red-700" };
  const diffLabels: Record<string, string> = { easy: "Fácil", medium: "Média", hard: "Difícil" };

  function handleAdd() {
    if (!newQ.text || !newQ.lessonId) return;
    setQuestions([...questions, { ...newQ, id: `q-${uid()}` }]);
    setNewQ({ courseId: "", moduleId: "", lessonId: "", text: "", difficulty: "easy", answer: "", status: "ativa" });
    setShowForm(false);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Banco de Questões" onBack={onBack} rightSlot={<button onClick={() => setShowForm(v => !v)} className="p-2 rounded-xl bg-primary text-white active:scale-90"><Plus size={18} /></button>} />
      <div className="flex-1 overflow-y-auto">
        {showForm && (
          <div className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 shadow-sm">
            <p className="font-bold text-sm mb-3">Nova Questão</p>
            <div className="flex flex-col gap-3">
              <SelField value={newQ.courseId} onChange={v => setNewQ(q => ({ ...q, courseId: v, moduleId: "", lessonId: "" }))} options={courses.map(c => ({ value: c.id, label: c.name }))} label="Curso" required />
              <SelField value={newQ.moduleId} onChange={v => setNewQ(q => ({ ...q, moduleId: v, lessonId: "" }))} options={newMods.map(m => ({ value: m.id, label: `Módulo ${m.order}: ${m.name}` }))} label="Módulo" required disabled={!newQ.courseId} />
              <SelField value={newQ.lessonId} onChange={v => setNewQ(q => ({ ...q, lessonId: v }))} options={newLessons.map(l => ({ value: l.id, label: `L${l.order}: ${l.name}` }))} label="Lição" required disabled={!newQ.moduleId} />
              <SelField value={newQ.difficulty} onChange={v => setNewQ(q => ({ ...q, difficulty: v as Question["difficulty"] }))} options={[{ value: "easy", label: "🟢 Fácil" }, { value: "medium", label: "🟡 Média" }, { value: "hard", label: "🔴 Difícil" }]} label="Dificuldade" required />
              <SelField value={newQ.status} onChange={v => setNewQ(q => ({ ...q, status: v as Question["status"] }))} options={[{ value: "ativa", label: "Ativa" }, { value: "inativa", label: "Inativa" }]} label="Status" required />
              <div>
                <label className="block text-sm font-semibold mb-1.5">Enunciado <span className="text-red-500">*</span></label>
                <textarea value={newQ.text} onChange={e => setNewQ(q => ({ ...q, text: e.target.value }))} rows={3} placeholder="Digite a questão..." className="w-full rounded-2xl border border-border bg-input-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>
              <Field label="Gabarito" value={newQ.answer} onChange={v => setNewQ(q => ({ ...q, answer: v }))} placeholder="Resposta esperada..." />
              <div className="flex gap-2">
                <Btn variant="success" small className="flex-1" onClick={handleAdd}><Check size={14} /> Salvar</Btn>
                <Btn variant="secondary" small onClick={() => setShowForm(false)}>Cancelar</Btn>
              </div>
            </div>
          </div>
        )}
        <div className="px-4 pt-3 pb-2 flex gap-2">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full rounded-2xl border border-border bg-card pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" /></div>
          <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none appearance-none">
            <option value="">Todos</option><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option>
          </select>
        </div>
        <div className="px-4 pb-2 grid grid-cols-2 gap-2">
          <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterModule(""); }} className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none">
            <option value="">Todos os cursos</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterModule} onChange={e => setFilterModule(e.target.value)} disabled={!filterCourse} className="rounded-2xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50">
            <option value="">Todos os módulos</option>{modules.filter(m => m.courseId === filterCourse).map(m => <option key={m.id} value={m.id}>Módulo {m.order}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground px-4 pb-1">{filtered.length} questão{filtered.length !== 1 ? "ões" : ""}</p>
        <div className="px-4 flex flex-col gap-2 pb-4">
          {filtered.map((q, i) => {
            const lesson = generateLessons(modules).find(l => l.id === q.lessonId);
            const mod = modules.find(m => m.id === q.moduleId);
            return (
              <div key={q.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-start gap-2 mb-2"><span className="text-xs text-muted-foreground font-bold mt-0.5 shrink-0">{i + 1}.</span><p className="text-sm flex-1">{q.text}</p></div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1"><Badge className={diffColors[q.difficulty]}>{diffLabels[q.difficulty]}</Badge><Badge className="bg-muted text-muted-foreground text-[10px]">M{mod?.order}·L{lesson?.order}</Badge><Badge className={q.status === "ativa" ? "bg-green-100 text-green-700 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{q.status}</Badge></div>
                  <button onClick={() => setQuestions(questions.filter(x => x.id !== q.id))} className="p-2 rounded-xl active:bg-red-50"><Trash2 size={14} className="text-red-500" /></button>
                </div>
                {q.answer && <p className="text-xs text-green-700 mt-2 bg-green-50 rounded-xl px-3 py-1.5"><span className="font-semibold">R:</span> {q.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function AdminPessoasScreen({ professors, setProfessors, students, setStudents, classes, setClasses, courses, showToast }: {
  professors: Professor[]; setProfessors: (p: Professor[]) => void; students: Student[]; setStudents: (s: Student[]) => void;
  classes: Class[]; setClasses: (c: Class[]) => void; courses: Course[]; showToast: (m: string) => void;
}) {
  const [view, setView] = useState<"professores" | "alunos" | null>(null);
  if (view === "professores") {
    return <AdminProfessoresScreen professors={professors} setProfessors={setProfessors} classes={classes} setClasses={setClasses} onBack={() => setView(null)} showToast={showToast} />;
  }
  if (view === "alunos") {
    return <AdminAlunosScreen students={students} setStudents={setStudents} classes={classes} setClasses={setClasses} courses={courses} onBack={() => setView(null)} showToast={showToast} />;
  }
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Pessoas" />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <button onClick={() => setView("professores")} className="bg-card rounded-2xl border border-border p-4 text-left shadow-sm flex items-center gap-3 active:scale-[0.98]">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><UserCheck size={22} /></div>
          <div className="flex-1"><p className="font-bold text-sm">Professores</p><p className="text-xs text-muted-foreground">{professors.length} cadastro{professors.length !== 1 ? "s" : ""}</p></div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={() => setView("alunos")} className="bg-card rounded-2xl border border-border p-4 text-left shadow-sm flex items-center gap-3 active:scale-[0.98]">
          <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center"><GraduationCap size={22} /></div>
          <div className="flex-1"><p className="font-bold text-sm">Alunos</p><p className="text-xs text-muted-foreground">{students.length} cadastro{students.length !== 1 ? "s" : ""}</p></div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [initialData] = useState<AppData>(() => loadAppData());
  const [role, setRole] = useState<UserRole | null>(initialData.role);
  const [currentProfessorId, setCurrentProfessorId] = useState(initialData.currentProfessorId);
  const [tab, setTab] = useState<Tab>("home");
  const [subView, setSubView] = useState<SubView | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: "success" | "error" } | null>(null);

  // Shared mutable state — single source of truth
  const [courses, setCourses] = useState<Course[]>(initialData.courses);
  const [modules, setModules] = useState<Module[]>(initialData.modules);
  const lessons = useMemo(() => generateLessons(modules), [modules]);
  const [classes, setClasses] = useState<Class[]>(initialData.classes);
  const [students, setStudents] = useState<Student[]>(initialData.students);
  const [professors, setProfessors] = useState<Professor[]>(initialData.professors);
  const [questions, setQuestions] = useState<Question[]>(initialData.questions);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(initialData.attendance);
  const [dailyAssessments, setDailyAssessments] = useState<DailyAssessment[]>(initialData.dailyAssessments);
  const [periodic, setPeriodic] = useState<PeriodicAssessment[]>(initialData.periodic);
  const [generatedExams, setGeneratedExams] = useState<GeneratedExam[]>(initialData.generatedExams);

  useEffect(() => {
    saveAppData({ role, currentProfessorId, courses, modules, classes, students, professors, questions, attendance, dailyAssessments, periodic, generatedExams });
  }, [role, currentProfessorId, courses, modules, classes, students, professors, questions, attendance, dailyAssessments, periodic, generatedExams]);

  function showToast(msg: string, type: "success" | "error" = "success") { setToast({ msg, type }); }
  function clearSub() { setSubView(null); }
  function changeTab(t: Tab) { setTab(t); setSubView(null); }
  const showBottomNav = subView === null;

  function renderContent() {
    // SubViews (push navigation) — used only by Professor flow
    if (subView) {
      switch (subView.type) {
        case "chamada-lesson":
          return <ChamadaLessonScreen classId={subView.classId} classes={classes} courses={courses} lessons={lessons}
            onSelect={lessonIds => setSubView({ type: "chamada-register", classId: subView.classId, lessonIds })} onBack={clearSub} />;
        case "chamada-register":
          return <ChamadaRegisterScreen classId={subView.classId} lessonIds={subView.lessonIds} date={subView.date}
            classes={classes} students={students} lessons={lessons} courses={courses}
            existingAttendance={attendance} existingDailyAssessments={dailyAssessments}
            onSave={(att, daily) => {
              const callDate = subView.date ?? todayISO();
              const callLessonId = lessonGroupId(subView.lessonIds);
              setAttendance(p => [...p.filter(a => !(a.classId === subView.classId && lessonGroupId(getRecordLessonIds(a)) === callLessonId && a.date === callDate)), ...att]);
              setDailyAssessments(p => [...p.filter(a => !(a.classId === subView.classId && lessonGroupId(getRecordLessonIds(a)) === callLessonId && a.date === callDate)), ...daily]);
              setClasses(p => p.map(c => c.id === subView.classId ? { ...c, conductedLessons: unique([...c.conductedLessons, ...subView.lessonIds]) } : c));
              clearSub();
              showToast("✓ Chamada registrada com sucesso!");
            }}
            onBack={() => setSubView({ type: "chamada-lesson", classId: subView.classId })} />;
        case "prof-questoes": {
          const scopeClasses = role === "professor" ? classes.filter(c => c.teacherId === currentProfessorId) : classes;
          const courseIds = unique(scopeClasses.map(c => c.courseId));
          const scopedCourses = courses.filter(c => courseIds.includes(c.id));
          const scopedModules = modules.filter(m => courseIds.includes(m.courseId));
          const scopedQuestions = questions.filter(q => courseIds.includes(q.courseId));
          return <AdminQuestoesScreen questions={scopedQuestions} courses={scopedCourses} modules={scopedModules} onBack={clearSub}
            setQuestions={nextScoped => setQuestions(current => [...current.filter(q => !courseIds.includes(q.courseId)), ...nextScoped])} />;
        }
        case "avaliacao-config":
          return <AvaliacaoConfigScreen classId={subView.classId} moduleId={subView.moduleId}
            classes={classes} modules={modules} courses={courses} questions={questions}
            onStart={(selectedQuestions, counts, lessonIds) => {
              const group = Math.min(3, Math.floor(classes.find(c => c.id === subView.classId)!.conductedLessons.filter(l => l.startsWith(subView.moduleId)).length / 6)) || 1;
              const generatedExam: GeneratedExam = { id: `exam-${uid()}`, classId: subView.classId, moduleId: subView.moduleId, group, questionIds: selectedQuestions.map(q => q.id), counts, lessonIds, date: todayISO() };
              setGeneratedExams(p => mergeLatestByKey(p, [generatedExam], generatedExamUniqueKey));
              setSubView({ type: "avaliacao-summary", classId: subView.classId, moduleId: subView.moduleId, selectedQuestions, counts, lessonIds, generatedExamId: generatedExam.id });
            }}
            onBack={clearSub} />;
        case "avaliacao-summary":
          return <AvaliacaoSummaryScreen classId={subView.classId} moduleId={subView.moduleId}
            selectedQuestions={subView.selectedQuestions} counts={subView.counts} lessonIds={subView.lessonIds}
            classes={classes} courses={courses} modules={modules} lessons={lessons}
            onStart={() => setSubView({ type: "avaliacao-conduct", classId: subView.classId, moduleId: subView.moduleId, selectedQuestions: subView.selectedQuestions, generatedExamId: subView.generatedExamId })}
            onBack={() => setSubView({ type: "avaliacao-config", classId: subView.classId, moduleId: subView.moduleId })} />;
        case "avaliacao-conduct":
          return <AvaliacaoConductScreen classId={subView.classId} moduleId={subView.moduleId}
            selectedQuestions={subView.selectedQuestions} generatedExamId={subView.generatedExamId} classes={classes} courses={courses} modules={modules} students={students}
            periodic={periodic} setPeriodic={setPeriodic}
            onDone={group => { setSubView({ type: "avaliacao-done", classId: subView.classId, moduleId: subView.moduleId, group }); showToast("✓ Relatórios gerados com sucesso!"); }}
            onBack={() => setSubView({ type: "avaliacao-config", classId: subView.classId, moduleId: subView.moduleId })} />;
        case "avaliacao-done":
          return <AvaliacaoDoneScreen classId={subView.classId} moduleId={subView.moduleId} group={subView.group}
            students={students} modules={modules} periodic={periodic} onNew={clearSub} />;
        case "student-report":
          return <RelatorioDetail studentId={subView.studentId} students={students} classes={classes}
            courses={courses} modules={modules} periodic={periodic} setPeriodic={setPeriodic} attendance={attendance} onBack={clearSub} showToast={showToast} />;
      }
    }

    // ── Professor tabs ────────────────────────────────────────────────────────
    if (role === "professor") {
      switch (tab as ProfTab) {
        case "home":
          return <HomeScreen role="professor" courses={courses} classes={classes} students={students} periodic={periodic} professors={professors} currentProfessorId={currentProfessorId} onLogout={() => setRole(null)} />;
        case "chamada":
          return <ChamadaHomeScreen role="professor" classes={classes} courses={courses} students={students} professors={professors} lessons={lessons} attendance={attendance} dailyAssessments={dailyAssessments} currentProfessorId={currentProfessorId} onSelectClass={classId => setSubView({ type: "chamada-lesson", classId })} onEditCall={(classId, lessonIds, date) => setSubView({ type: "chamada-register", classId, lessonIds, date })} onDeleteCall={(classId, lessonIds, date) => {
            const callLessonId = lessonGroupId(lessonIds);
            setAttendance(p => p.filter(a => !(a.classId === classId && lessonGroupId(getRecordLessonIds(a)) === callLessonId && a.date === date)));
            setDailyAssessments(p => p.filter(a => !(a.classId === classId && lessonGroupId(getRecordLessonIds(a)) === callLessonId && a.date === date)));
          }} />;
        case "avaliacao":
          return (
            <div className="flex flex-col flex-1 overflow-hidden">
              <TopBar title="Avaliação Periódica" />
              <AvaliacaoHome role="professor" classes={classes} courses={courses} modules={modules} students={students} periodic={periodic}
                currentProfessorId={currentProfessorId}
                onStart={(classId, moduleId) => setSubView({ type: "avaliacao-config", classId, moduleId })}
                onManageQuestions={() => setSubView({ type: "prof-questoes" })} />
            </div>
          );
        case "relatorios":
          return (
            <div className="flex flex-col flex-1 overflow-hidden">
              <TopBar title="Relatórios" />
              <RelatorioList role="professor" students={students} classes={classes} currentProfessorId={currentProfessorId} periodic={periodic} onSelect={studentId => setSubView({ type: "student-report", studentId })} />
            </div>
          );
      }
    }

    // ── Admin tabs — each tab IS the screen, no subView needed ────────────────
    if (role === "admin" && (tab === "chamada" || tab === "avaliacao" || tab === "relatorios")) {
      switch (tab as ProfTab) {
        case "chamada":
          return (
            <div className="flex flex-col flex-1 overflow-hidden">
              <TopBar title="Operação Pedagógica" onBack={() => changeTab("home")} rightSlot={<span className="text-xs text-muted-foreground">{todayBR()}</span>} />
              <ChamadaHomeScreen role="admin" classes={classes} courses={courses} students={students} professors={professors} lessons={lessons} attendance={attendance} dailyAssessments={dailyAssessments} onSelectClass={classId => setSubView({ type: "chamada-lesson", classId })} onEditCall={(classId, lessonIds, date) => setSubView({ type: "chamada-register", classId, lessonIds, date })} onDeleteCall={(classId, lessonIds, date) => {
                const callLessonId = lessonGroupId(lessonIds);
                setAttendance(p => p.filter(a => !(a.classId === classId && lessonGroupId(getRecordLessonIds(a)) === callLessonId && a.date === date)));
                setDailyAssessments(p => p.filter(a => !(a.classId === classId && lessonGroupId(getRecordLessonIds(a)) === callLessonId && a.date === date)));
              }} />
            </div>
          );
        case "avaliacao":
          return (
            <div className="flex flex-col flex-1 overflow-hidden">
              <TopBar title="Provas Pedagógicas" onBack={() => changeTab("home")} />
              <AvaliacaoHome role="admin" classes={classes} courses={courses} modules={modules} students={students} periodic={periodic}
                onStart={(classId, moduleId) => setSubView({ type: "avaliacao-config", classId, moduleId })} />
            </div>
          );
        case "relatorios":
          return (
            <div className="flex flex-col flex-1 overflow-hidden">
              <TopBar title="Relatórios Gerais" onBack={() => changeTab("home")} />
              <RelatorioList role="admin" students={students} classes={classes} periodic={periodic} onSelect={studentId => setSubView({ type: "student-report", studentId })} />
            </div>
          );
      }
    }

    switch (tab as AdminTab) {
      case "home":
        return <HomeScreen role="admin" courses={courses} classes={classes} students={students} periodic={periodic} professors={professors} onLogout={() => setRole(null)} onGoPedagogic={changeTab} />;
      case "admin-turmas":
        return <AdminTurmasScreen classes={classes} setClasses={setClasses} students={students} setStudents={setStudents} courses={courses} modules={modules} professors={professors} onBack={undefined} />;
      case "admin-pessoas":
        return <AdminPessoasScreen professors={professors} setProfessors={setProfessors} students={students} setStudents={setStudents} classes={classes} setClasses={setClasses} courses={courses} showToast={showToast} />;
      case "admin-cursos":
        return <AdminCursosScreen courses={courses} setCourses={setCourses} modules={modules} setModules={setModules} questions={questions} setQuestions={setQuestions} onBack={undefined} />;
      case "admin-questoes":
        return <AdminQuestoesScreen questions={questions} setQuestions={setQuestions} courses={courses} modules={modules} onBack={() => changeTab("home")} />;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center overflow-x-hidden" style={{ fontFamily: "'Figtree', sans-serif" }}>
      <style>{`
        @keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { -webkit-tap-highlight-color: transparent; }
        input[type=range] { cursor: pointer; }
      `}</style>

      <div className="relative w-full sm:w-[390px] h-screen sm:h-[844px] bg-background sm:rounded-[44px] overflow-hidden sm:shadow-2xl sm:shadow-black/60 sm:border-4 sm:border-slate-700 flex flex-col max-w-full">
        {/* Dynamic Island */}
        <div className="hidden sm:flex absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-full z-50 items-center justify-center gap-1.5">
          <div className="w-[10px] h-[10px] rounded-full bg-slate-800 border border-slate-700" />
          <div className="w-[18px] h-[18px] rounded-full bg-slate-800 border border-slate-700" />
        </div>

        <div className="shrink-0 sm:pt-8 pt-0"><StatusBar /></div>

        {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

        {!role ? (
          <LoginScreen professors={professors} onLogin={(r, userId) => { setRole(r); if (userId) setCurrentProfessorId(userId); setTab("home"); setSubView(null); }} />
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {renderContent()}
            {showBottomNav && <BottomNav role={role} tab={tab} setTab={changeTab} />}
          </div>
        )}

        <div className="hidden sm:flex h-7 shrink-0 items-end justify-center pb-2 bg-background">
          <div className="w-[130px] h-[5px] bg-foreground/20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
