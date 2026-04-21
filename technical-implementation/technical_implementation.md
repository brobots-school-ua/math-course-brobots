# Технічна реалізація: Платформа «Прикладна математика»

> Документ описує архітектуру, стек, схему бази даних, ключові алгоритми та інтеграції.
> Призначений для розробника і автора курсу — щоб обидва розуміли, як і чому побудована система.

---

## 1. Загальна архітектура

### Що ми будуємо
Веб-застосунок із двома ролями (учень і вчитель), який:
- Веде учня через модулі курсу (теорія → квіз → практика → офлайн-завдання)
- Автоматично перевіряє відповіді і дає зворотний зв'язок
- Оцінює фотографії рукописних завдань через OCR + локальний ШІ
- Відстежує прогрес і запускає інтервальне повторення
- Надає вчителю дашборд без необхідності ручної перевірки рутинних завдань

### Стек технологій

| Рівень | Технологія | Чому |
|--------|-----------|------|
| Frontend | Next.js 14 (App Router) + React | SSR для SEO і швидкого першого завантаження; один репозиторій для UI і API |
| Стилі | Tailwind CSS + shadcn/ui | Швидка розробка, консистентний UI, компоненти без зайвих залежностей |
| База даних | PostgreSQL | Реляційна модель добре підходить для прогресу і зв'язків задача↔учень↔спроба |
| ORM | Prisma 6 | Типобезпечні запити, зручні міграції |
| Авторизація | NextAuth.js v5 | Підтримка ролей, сесії, простий деплой |
| OCR (числа) | Tesseract.js | Open-source, без зовнішнього API, достатній для поля [ВІДПОВІДЬ] з числами |
| ШІ (локально) | Ollama + Qwen2-VL (7B) | Мультимодальна модель: читає зображення рукопису напряму, нульова вартість токенів |
| Інтервальне повторення | ts-fsrs | FSRS-алгоритм — точніший за SM-2, є готова TypeScript-бібліотека |
| Черга завдань | BullMQ + Redis | Асинхронна обробка фото (OCR + ШІ) без блокування UI |
| Файли | Local filesystem / MinIO (S3-сумісний) | Зберігання фотографій завдань |
| Деплой | Docker Compose на VPS | Один сервер, всі сервіси в контейнерах |

### Монорепо або мікросервіси?
**Монорепо, один Next.js застосунок.** На поточному масштабі (одна школа, десятки учнів) мікросервіси — надмірне ускладнення. Next.js API Routes вистачить для всього backend. Окремо запускається лише:
- Redis + BullMQ (черга фото-завдань)
- Ollama (локальна модель ШІ)
- PostgreSQL

---

## 2. Структура проєкту

```
/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Логін, реєстрація
│   ├── (student)/              # Сторінки учня
│   │   ├── dashboard/          # Тижневий прогрес, модулі
│   │   ├── module/[id]/        # Сторінка модуля
│   │   ├── lesson/[id]/        # Конкретне заняття (теорія + квіз + практика)
│   │   └── submit/[taskId]/    # Завантаження фото офлайн-завдання
│   ├── (teacher)/              # Сторінки вчителя
│   │   ├── dashboard/          # Огляд класу
│   │   ├── student/[id]/       # Профіль учня
│   │   └── tasks/              # Редактор завдань
│   └── api/                    # API endpoints
│       ├── auth/               # NextAuth
│       ├── lessons/            # CRUD занять
│       ├── submissions/        # Завантаження і оцінювання
│       ├── progress/           # Прогрес учня
│       └── ai/                 # Проксі до локального Ollama
├── prisma/
│   └── schema.prisma
├── lib/
│   ├── ocr.ts                  # Tesseract wrapper
│   ├── ai.ts                   # Ollama client
│   ├── spaced-repetition.ts    # SM-2 алгоритм
│   └── scoring.ts              # Логіка перевірки відповідей
├── components/
│   ├── quiz/                   # Компоненти квізу
│   ├── practice/               # Компоненти практики з підказками
│   ├── dashboard/              # Студентський і вчительський дашборди
│   └── gamification/           # Бейджі, прогрес-бар
└── workers/
    └── photo-evaluation.ts     # BullMQ worker для обробки фото
```

---

## 3. База даних (Prisma schema)

### Ключові моделі

```prisma
// Користувач (учень або вчитель)
model User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  name          String
  role          Role      @default(STUDENT)
  classId       Int?
  class         Class?    @relation(fields: [classId], references: [id])
  progress      StudentProgress[]
  submissions   Submission[]
  repetitions   RepetitionCard[]
  createdAt     DateTime  @default(now())
}

enum Role { STUDENT TEACHER }

model Class {
  id        Int     @id @default(autoincrement())
  name      String  // "8-А", "9-Б"
  teacher   User    @relation(...)
  students  User[]
}

// Структура курсу
model Module {
  id          Int      @id @default(autoincrement())
  order       Int      // Порядок у курсі
  title       String
  objectives  String[] // Цілі навчання (масив рядків)
  lessons     Lesson[]
}

model Lesson {
  id          Int      @id @default(autoincrement())
  moduleId    Int
  module      Module   @relation(...)
  order       Int
  title       String
  theoryMd    String   // Markdown теорії (рендериться на клієнті)
  tasks       Task[]
}

// Задача (може бути квіз, практика або офлайн-завдання)
model Task {
  id          Int        @id @default(autoincrement())
  lessonId    Int
  lesson      Lesson     @relation(...)
  type        TaskType
  content     Json       // Структура залежить від type (див. нижче)
  answer      Json       // Еталонна відповідь (числова або варіант)
  tolerance   Float?     // Допуск для числових відповідей (наприклад, 0.02 = ±2%)
  hints       String[]   // Підказки — масив рядків, відкриваються по одній
  difficulty  Difficulty @default(STANDARD)
  isActive    Boolean    @default(true)
  submissions Submission[]
}

enum TaskType { QUIZ PRACTICE OFFLINE GAME }
enum Difficulty { BASIC STANDARD ADVANCED }

// Спроба учня виконати задачу
model Submission {
  id            Int              @id @default(autoincrement())
  userId        Int
  user          User             @relation(...)
  taskId        Int
  task          Task             @relation(...)
  answer        String           // Відповідь учня (рядок або JSON)
  isCorrect     Boolean?         // null = ще не перевірено
  errorType     ErrorType?       // Тип помилки (від ШІ)
  conclusionOk  Boolean?         // Оцінка поля [ВИСНОВОК]
  hintsUsed     Int              @default(0)
  timeSeconds   Int?
  photoUrl      String?          // Для офлайн-завдань
  aiResponse    String?          // Збережена відповідь ШІ (для аудиту)
  createdAt     DateTime         @default(now())
}

enum ErrorType { CALCULATION CONCEPTUAL UNITS MODEL NONE }

// Прогрес по темах (вектор компетентностей)
model StudentProgress {
  id              Int      @id @default(autoincrement())
  userId          Int
  user            User     @relation(...)
  moduleId        Int
  module          Module   @relation(...)
  masteryPercent  Int      @default(0)   // 0–100
  lastUpdated     DateTime @default(now())
  
  @@unique([userId, moduleId])
}

// Картки для інтервального повторення (FSRS)
model RepetitionCard {
  id             Int      @id @default(autoincrement())
  userId         Int
  user           User     @relation(...)
  taskId         Int
  task           Task     @relation(...)
  // FSRS-параметри (ts-fsrs)
  stability      Float    @default(0)    // Наскільки стабільна пам'ять (в днях)
  difficulty     Float    @default(5)    // Складність картки (1–10)
  elapsedDays    Int      @default(0)    // Скільки днів минуло з останнього повторення
  scheduledDays  Int      @default(0)    // На скільки днів заплановано наступне
  reps           Int      @default(0)    // Кількість успішних повторень
  lapses         Int      @default(0)    // Кількість "забувань"
  state          CardState @default(NEW) // Стан картки
  nextReviewAt   DateTime @default(now())
  lastReviewAt   DateTime?

  @@unique([userId, taskId])
}

enum CardState { NEW LEARNING REVIEW RELEARNING }
```

### Структура поля `content` для різних типів задач

```typescript
// TaskType.QUIZ
{
  question: "Що показує медіана вибірки?",
  options: ["A: середнє", "B: найчастіше значення", "C: серединне значення", "D: розмах"],
  correctIndex: 2
}

// TaskType.PRACTICE
{
  statement: "Лікар призначає 5 мг/кг. Дитина важить 34 кг...",
  blanks: [],          // Для задач з заповненням пропусків
  expectedType: "number"
}

// TaskType.OFFLINE
{
  pdfTemplate: "/templates/module3_task2.pdf",
  fields: {
    answer: { x: 120, y: 340, w: 200, h: 40 },         // Координати поля на PDF
    solution: { x: 50, y: 150, w: 500, h: 180 },
    conclusion: { x: 50, y: 400, w: 500, h: 80 }
  }
}
```

---

## 4. Система перевірки відповідей

### Рівні автоматизації (від дешевого до дорогого)

```
Рівень 1: Точне порівняння (0 токенів)
  → Квіз: порівняти індекс обраного варіанту з correctIndex

Рівень 2: Числова перевірка з допуском (0 токенів)
  → Практика: якщо |відповідь_учня - еталон| / еталон <= tolerance → зараховано

Рівень 3: OCR + числова перевірка (0 токенів)
  → Офлайн: розпізнати поле [ВІДПОВІДЬ] → застосувати Рівень 2

Рівень 4: ШІ оцінює хід розв'язання (токени)
  → Запускається тільки при: неправильній відповіді АБО нечитабельному OCR АБО
    для поля [ВИСНОВОК] (раз на 3–5 завдань, не щоразу)
```

### Код перевірки числової відповіді

```typescript
// lib/scoring.ts
export function checkNumericAnswer(
  studentAnswer: string,
  correctAnswer: number,
  tolerance: number = 0.02
): { isCorrect: boolean; delta: number } {
  const parsed = parseFloat(studentAnswer.replace(',', '.'));
  if (isNaN(parsed)) return { isCorrect: false, delta: Infinity };
  
  const delta = Math.abs(parsed - correctAnswer) / Math.abs(correctAnswer);
  return { isCorrect: delta <= tolerance, delta };
}
```

---

## 5. OCR та оцінювання фото

### Розподіл відповідальності між Tesseract і Qwen2-VL

Різні поля бланку обробляються різними інструментами — залежно від типу вмісту:

| Поле | Вміст | Інструмент | Причина |
|------|-------|-----------|---------|
| `[ВІДПОВІДЬ]` | Число або короткий вираз | Tesseract | Швидко, безкоштовно, достатньо для цифр |
| `[ВИСНОВОК]` | 1–3 речення рукописного тексту | Qwen2-VL (Ollama) | Читає зображення напряму, не потребує OCR |
| `[ХІД РОЗВ'ЯЗАННЯ]` | Формули, стрілки, рукопис | Qwen2-VL (Ollama) | Тільки при неправильній відповіді |

### Флоу обробки офлайн-завдання

```
Учень фотографує бланк → завантажує через браузер
       ↓
/api/submissions/photo — зберігає файл, створює Submission (pending)
Ставить задачу в чергу BullMQ
       ↓
[Worker: photo-evaluation.ts]

  Крок 1: Вирівнювання бланку
    → Знайти 4 кутові маркери (чорні квадрати)
    → Perspective transform через sharp
    → Привести до стандартних розмірів PDF-шаблону

  Крок 2: Tesseract на полі [ВІДПОВІДЬ]
    → Whitelist: тільки цифри і ".,- "
    → Отримати text + confidence

  Крок 3: Числова перевірка
    → Якщо confidence ≥ 0.7 і відповідь правильна (±допуск):
         Submission.isCorrect = true → зберегти → готово ✓
    → Якщо confidence < 0.7 або відповідь неправильна:
         → Перейти до Кроку 4

  Крок 4: Qwen2-VL оцінює рукопис (тільки коли потрібно)
    → Вирізати поля [ХІД] і [ВИСНОВОК] як зображення
    → Надіслати в Ollama: зображення + промпт (структурований JSON)
    → Отримати: errorType, conclusionOk, feedback
    → Зберегти в Submission
       ↓
Оновити UI учня (Server-Sent Events або polling)
```

### Tesseract для числових полів

```typescript
// lib/ocr.ts
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export async function recognizeAnswerField(
  imagePath: string,
  field: { x: number; y: number; w: number; h: number }
): Promise<{ text: string; confidence: number }> {
  // Вирізати поле за координатами
  const croppedBuffer = await sharp(imagePath)
    .extract({ left: field.x, top: field.y, width: field.w, height: field.h })
    .greyscale()
    .normalize()  // Підвищити контраст
    .toBuffer();

  const result = await Tesseract.recognize(croppedBuffer, 'eng', {
    tessedit_char_whitelist: '0123456789.,- /',
    tessedit_pageseg_mode: '7',  // Один рядок тексту
  });

  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence / 100,
  };
}
```

### Qwen2-VL для рукописних полів

```typescript
// lib/ai.ts (доповнення)
export async function evaluateHandwrittenFields(params: {
  taskStatement: string;
  correctAnswer: number;
  solutionImagePath: string;   // Вирізане поле [ХІД]
  conclusionImagePath: string; // Вирізане поле [ВИСНОВОК]
}) {
  // Конвертуємо зображення в base64 для Ollama
  const solutionB64 = await imageToBase64(params.solutionImagePath);
  const conclusionB64 = await imageToBase64(params.conclusionImagePath);

  const prompt = `
Задача: ${params.taskStatement}
Правильна відповідь: ${params.correctAnswer}

На зображенні 1 — хід розв'язання учня.
На зображенні 2 — висновок учня.

Визнач:
1. errorType: CALCULATION / CONCEPTUAL / UNITS / MODEL / NONE
2. conclusionOk: true / false
3. feedback: одне речення для учня (українською, без відповіді)

JSON:`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({
      model: 'qwen2-vl:7b',
      prompt,
      images: [solutionB64, conclusionB64],  // Ollama підтримує масив зображень
      stream: false,
      format: 'json',
    }),
  });

  return JSON.parse((await response.json()).response);
}
```

### Вирівнювання бланку (кутові маркери)

На кожному PDF-бланку друкуються 4 чорних квадрати 1×1 см у кутах. Worker знаходить їх через threshold + contour detection (sharp + jimp), обчислює гомографію і приводить фото до стандартного розміру.

> **MVP-спрощення:** на першому етапі можна обійтись без маркерів — просити учня фотографувати аркуш на рівній поверхні і показувати preview з рамкою перед відправкою. Маркери додати у Фазі 3.

---

## 6. Інтеграція локального ШІ (Ollama)

### Чому Ollama
Ollama дозволяє запустити відкриту модель (Qwen2.5-7B, Llama 3.2, Mistral) локально — без API-ключів і витрат токенів. На шкільному сервері з 8–16 ГБ RAM цього достатньо для оцінювання коротких відповідей.

### Запуск

```bash
# На сервері (один раз)
ollama pull qwen2.5:7b
ollama serve  # Слухає на http://localhost:11434
```

### Клієнт у коді

```typescript
// lib/ai.ts
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function evaluateStudentWork(params: {
  taskStatement: string;
  correctAnswer: number;
  studentSolution: string;
  studentAnswer: string;
  studentConclusion: string;
}): Promise<{
  errorType: ErrorType;
  conclusionOk: boolean;
  feedback: string;  // Коротке пояснення для учня
}> {
  const prompt = `
Задача: ${params.taskStatement}
Правильна відповідь: ${params.correctAnswer}

Хід розв'язання учня: ${params.studentSolution}
Відповідь учня: ${params.studentAnswer}
Висновок учня: ${params.studentConclusion}

Визнач:
1. Тип помилки: CALCULATION (арифметична) / CONCEPTUAL (неправильна модель) / UNITS (одиниці) / NONE
2. Висновок правильний: true / false
3. Одне речення пояснення для учня (українською, без спойлерів відповіді)

Відповідь у JSON:
{"errorType": "...", "conclusionOk": true/false, "feedback": "..."}
`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({
      model: 'qwen2.5:7b',
      prompt,
      stream: false,
      format: 'json'
    })
  });

  const data = await response.json();
  return JSON.parse(data.response);
}
```

### Коли ШІ викликається — суворе правило

```
Квіз (онлайн):         НІКОЛИ — є правильний варіант
Практика (числова):    НІКОЛИ — числова перевірка
Практика (висновок):   РАЗ НА 3 ЗАВДАННЯ — якщо поле заповнене
Офлайн (відповідь ✓):  НІКОЛИ
Офлайн (відповідь ✗):  ЗАВЖДИ — знайти тип помилки
Офлайн (висновок):     РАЗ НА 5 ЗАВДАНЬ — або якщо OCR confidence < 0.7
```

Це дозволяє тримати середнє навантаження на ШІ в межах **5–15 запитів на учня на тиждень**.

---

## 7. Інтервальне повторення (FSRS)

### Чому FSRS, а не SM-2

FSRS (Free Spaced Repetition Scheduler) — алгоритм, який Anki прийняв за замовчуванням у 2022 році. На відміну від SM-2, він моделює криву забування через диференційне рівняння і підлаштовує параметри під конкретного учня з часом.

### Використання ts-fsrs

```bash
npm install ts-fsrs
```

```typescript
// lib/spaced-repetition.ts
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs';

const f = fsrs(generatorParameters({ enable_fuzz: true }));

// Rating для нашого контексту:
// Rating.Easy    = правильно, без підказок, швидко
// Rating.Good    = правильно, без підказок
// Rating.Hard    = правильно, але з підказками
// Rating.Again   = неправильно

export function scheduleCard(card: RepetitionCard, rating: Rating) {
  // Перетворити з нашої моделі БД у формат ts-fsrs
  const fsrsCard = {
    due: card.nextReviewAt,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReviewAt ?? undefined,
  };

  const result = f.repeat(fsrsCard, new Date());
  const next = result[rating].card;

  // Повернути оновлені поля для збереження в БД
  return {
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    nextReviewAt: next.due,
    lastReviewAt: new Date(),
  };
}
```

### Як повторення вбудоване в курс

У кожному занятті є дві секції задач:
1. **Нові задачі** поточного заняття
2. **Задачі на повторення** — ті, у яких `nextReviewAt <= today`

Учень не відчуває різниці — це просто задачі в одному списку. Платформа вирішує, яка задача «стара», яка «нова».

---

## 8. Гейміфікація: технічна реалізація

### Тижневий прогрес

```typescript
// Підрахунок активних днів поточного тижня
async function getWeeklyActivity(userId: number): Promise<number> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Понеділок
  
  const activeDays = await prisma.submission.groupBy({
    by: ['createdAt'],
    where: {
      userId,
      createdAt: { gte: weekStart }
    }
  });
  
  // Підрахувати унікальні дні
  const uniqueDays = new Set(
    activeDays.map(s => format(s.createdAt, 'yyyy-MM-dd'))
  );
  return uniqueDays.size; // Наприклад, 4 (з 7 можливих)
}
```

### Місячний прогрес компетентностей

Порівнюємо `masteryPercent` зараз із значенням місяць тому. Зберігаємо snapshot щотижня:

```prisma
model MasterySnapshot {
  id        Int      @id @default(autoincrement())
  userId    Int
  moduleId  Int
  mastery   Int
  takenAt   DateTime @default(now())
}
```

### Бейджі

Бейджі — це умови, які перевіряються після кожної спроби:

```typescript
const BADGE_CONDITIONS = [
  {
    id: 'no-hints-streak',
    label: 'Без підказок',
    check: async (userId: number) => {
      // Останні 3 практичні задачі — всі без підказок
      const last3 = await prisma.submission.findMany({
        where: { userId, task: { type: 'PRACTICE' } },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      return last3.length === 3 && last3.every(s => s.hintsUsed === 0);
    }
  },
  {
    id: 'error-hunter',
    label: 'Детектив',
    check: async (userId: number) => {
      // Правильно відповів на задачу типу «Знайди помилку»
      ...
    }
  }
];
```

---

## 9. API endpoints

### Студентські

```
GET  /api/lessons/[id]              → Дані заняття (теорія, задачі)
POST /api/submissions               → Відправити відповідь (квіз або практика)
POST /api/submissions/photo         → Завантажити фото офлайн-завдання
GET  /api/submissions/[id]/status   → Перевірити статус обробки фото
GET  /api/progress                  → Вектор компетентностей учня
GET  /api/repetitions/today         → Задачі на повторення сьогодні
GET  /api/gamification/weekly       → Активні дні тижня
GET  /api/gamification/badges       → Отримані бейджі
```

### Вчительські

```
GET  /api/teacher/class             → Прогрес всього класу (теплова карта)
GET  /api/teacher/alerts            → Учні з проблемами (автоматичні сповіщення)
GET  /api/teacher/student/[id]      → Детальний профіль учня
GET  /api/teacher/tasks             → Список всіх задач
PUT  /api/teacher/tasks/[id]        → Редагувати задачу
POST /api/teacher/tasks             → Додати нову задачу
PUT  /api/teacher/tasks/[id]/toggle → Активувати / деактивувати задачу
GET  /api/teacher/review-queue      → Завдання, які ШІ не зміг оцінити
POST /api/teacher/review/[id]       → Ручна оцінка (вчитель)
```

### Логіка автоматичних сповіщень вчителю

```typescript
// Запускається щоночі (cron або BullMQ repeatable job)
async function generateTeacherAlerts(classId: number) {
  const alerts = [];

  // 1. Учень не заходив >7 днів
  const inactive = await findInactiveStudents(classId, 7);
  
  // 2. Учень >30% помилок в темі за останні 10 завдань
  const struggling = await findStrugglingStudents(classId, { errorRate: 0.3, minSubmissions: 10 });
  
  // 3. Кількість підказок не зменшується за 3 тижні
  const hintDependent = await findHintDependentStudents(classId, 3);

  return [...inactive, ...struggling, ...hintDependent];
}
```

---

## 10. Дашборд учня: UI

### Головна сторінка (student/dashboard)

Компоненти:
- **WeeklyProgress** — горизонтальний ряд з 7 кружечками (дні тижня). Заповнені = були заняття.
- **MonthlyMasteryChart** — лінійний графік росту компетентностей за останні 4 тижні (recharts)
- **ModuleGrid** — картки модулів з прогрес-барами `masteryPercent`
- **TodayReview** — блок «Повторення сьогодні: 4 задачі» (якщо є)
- **BadgeShelf** — останні 3 отримані бейджі

### Сторінка заняття (student/lesson/[id])

Послідовність секцій (state machine):

```
THEORY → QUIZ → PRACTICE → OFFLINE_TASK → COMPLETION
```

Перехід між секціями — тільки після виконання поточної. Стан зберігається в БД (щоб не губився при перезавантаженні).

---

## 11. Дашборд вчителя: UI

### Теплова карта класу

Таблиця: рядки = учні, стовпці = модулі, колір = `masteryPercent` (зелений → жовтий → червоний).

```typescript
// Простий компонент
function MasteryHeatmap({ data }: { data: StudentModuleProgress[] }) {
  return (
    <table>
      {data.map(student => (
        <tr key={student.id}>
          <td>{student.name}</td>
          {student.modules.map(m => (
            <td
              key={m.moduleId}
              style={{ background: masteryToColor(m.masteryPercent) }}
              title={`${m.masteryPercent}%`}
            />
          ))}
        </tr>
      ))}
    </table>
  );
}

function masteryToColor(pct: number): string {
  if (pct >= 75) return '#4ade80';  // Зелений
  if (pct >= 40) return '#facc15';  // Жовтий
  return '#f87171';                 // Червоний
}
```

---

## 12. Генерація PDF-бланків

Для кожного офлайн-завдання потрібен друкований PDF із чіткими полями.

**Бібліотека:** `pdf-lib` (Node.js)

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function generateOfflineTemplate(task: Task): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  
  // Умова задачі
  page.drawText(task.content.statement, { x: 50, y: 750, size: 12, font });
  
  // Поле для ходу розв'язання
  drawLabeledBox(page, '[ХІД РОЗВ\'ЯЗАННЯ]', 50, 550, 500, 180, font);
  
  // Поле відповіді
  drawLabeledBox(page, '[ВІДПОВІДЬ: _______]', 50, 490, 200, 40, font);
  
  // Поле висновку
  drawLabeledBox(page, '[ВИСНОВОК / ІНТЕРПРЕТАЦІЯ]', 50, 390, 500, 80, font);
  
  // Зберегти координати полів у метадані (для OCR worker)
  // ...
  
  return Buffer.from(await pdf.save());
}
```

---

## 13. Деплой (Docker Compose)

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "80:3000"
    env_file: .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: math_course
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_models:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped
    # Якщо є GPU: додати deploy.resources.reservations.devices

volumes:
  pgdata:
  ollama_models:
```

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 14. Послідовність розробки (MVP → повна версія)

### Фаза 1 — MVP (мінімальний робочий продукт)
- [ ] Next.js проєкт, авторизація, ролі (Student/Teacher)
- [ ] Перший модуль (Модуль 1): теорія в Markdown + квіз
- [ ] Перевірка квізу, збереження прогресу в БД
- [ ] Дашборд учня: список модулів, прогрес-бар

### Фаза 2 — Практика і офлайн
- [ ] Задачі практики з підказками
- [ ] Генерація PDF-бланків
- [ ] Завантаження фото + Tesseract OCR
- [ ] BullMQ worker для обробки фото

### Фаза 3 — ШІ і повторення
- [ ] Інтеграція Ollama (оцінювання помилок)
- [ ] SM-2 алгоритм + задачі на повторення
- [ ] Профіль компетентностей учня

### Фаза 4 — Вчитель і гейміфікація
- [ ] Дашборд вчителя (теплова карта, алерти)
- [ ] Редактор задач
- [ ] Тижневий/місячний прогрес, бейджі

### Фаза 5 — Повний курс
- [ ] Всі 12 модулів з контентом
- [ ] Інтеграційний проєкт (Модуль 10)
- [ ] Міні-ігри
- [ ] Звіти для вчителя (PDF)

---

## 15. Відкриті питання для обговорення

1. **Контент задач** — хто і в якому форматі вводить задачі? Ручний JSON через адмін-панель, або Markdown-файли в репозиторії?
2. **Ollama на якому сервері?** — якщо шкільний сервер слабкий, можна розглянути Anthropic API з кешуванням промптів (суттєво дешевше ніж звичайний виклик).
3. **Як учні входять?** — Google OAuth (одним кліком), або логін/пароль, або через шкільну систему?
4. **Офлайн-режим** — чи потрібен PWA (щоб застосунок частково працював без інтернету)?
5. **Мобільний вигляд** — учні переважно з телефону чи ноутбука?

---

*Версія 1.0 — Технічна специфікація*
*Дата: квітень 2026*
