# ОГЭ Английский · React + PocketBase

Текущая версия: `1.0.1`

Приложение читает результаты из Excel, нормализует их в две коллекции PocketBase и показывает отчёты по ученикам в React-интерфейсе. Начиная с `1.0.1`, обновление источника идёт из самого свежего `xlsx` в корне проекта.

## Быстрый сценарий

Если вы обновляете данные через Finder:

1. Положите самый свежий `xlsx` в корень проекта
2. Запустите:

```bash
npm run refresh:reports
```

Скрипт сам возьмёт самый новый Excel-файл из корня проекта, обновит PocketBase и пересчитает отчёты для фронтенда.
Если у вас уже запущен `npm start` или `launchd`-агент, новый `xlsx` в корне подхватится автоматически в фоне.

## Что внутри

- `scripts/import-excel.mjs` читает корневой `xlsx`, режет данные по листам и загружает:
  - `student_summaries` — одна запись на ученика с агрегатами и рекомендациями
  - `student_results` — одна запись на ученика на каждый тест
- `src/` содержит адаптивный дашборд с карточками, таблицами и SVG-графиком
- `pocketbase/` содержит локальный бинарник PocketBase `0.36.6` для macOS ARM64

## Коллекции PocketBase

Создай две `Base`-коллекции в PocketBase и открой для них `List/View` rules на чтение для фронтенда.

### `student_summaries`

Поля:

- `studentKey` — `text`, unique
- `fullName` — `text`
- `groupName` — `text`
- `latestScore` — `number`
- `latestPercent` — `number`
- `averagePercent` — `number`
- `bestPercent` — `number`
- `trendDelta` — `number`
- `testsCount` — `number`
- `colorA` — `text`
- `colorB` — `text`
- `strengths` — `text`
- `growthAreas` — `text`
- `trendText` — `text`
- `recommendation` — `text`
- `sectionListening` — `number`
- `sectionReading` — `number`
- `sectionGrammar` — `number`
- `sectionVocabulary` — `number`
- `sectionWriting` — `number`

### `student_results`

Поля:

- `resultKey` — `text`, unique
- `studentKey` — `text`
- `fullName` — `text`
- `groupName` — `text`
- `sheetName` — `text`
- `label` — `text`
- `sortOrder` — `number`
- `part1Score` — `number`
- `part1Percent` — `number`
- `part2Score` — `number`
- `part2Percent` — `number`
- `writtenScore` — `number`
- `writtenPercent` — `number`
- `listeningPercent` — `number`
- `readingPercent` — `number`
- `grammarPercent` — `number`
- `vocabularyPercent` — `number`
- `writingPercent` — `number`

## Локальный запуск

1. Скопируй `.env.example` в `.env`
2. Заполни:
   - `PB_URL`
   - `PB_ADMIN_EMAIL`
   - `PB_ADMIN_PASSWORD`
   - `PB_XLSX_FILE`, только если нужно явно переопределить файл
3. Установи зависимости:

```bash
npm install --cache .npm-cache
```

4. Запусти всё сразу:

```bash
npm start
```

Это одновременно:
- PocketBase на `http://127.0.0.1:8091`
- Vite dev server на `http://127.0.0.1:5173`
- watcher, который следит за новым `xlsx` в корне и автоматически обновляет PocketBase и отчёты
- перед стартом сгенерирует `public/report-data.json` из актуального `xlsx`

Если нужен только PocketBase, используй:

```bash
npm run pb:serve
```

При первом запуске PocketBase попросит создать первого администратора. После этого создай коллекции по схеме выше.

5. При необходимости можно импортировать Excel и вручную:

```bash
npm run import:excel
```

Проверка только парсинга без записи в БД:

```bash
node scripts/import-excel.mjs --dry-run
```

6. Если нужен только фронтенд:

```bash
npm run dev
```

## Что уже учтено из инструкции

- Листы `шаблон*` пропускаются
- Хронология инвертируется через `reverse()`
- `ЭКЗАМЕН` и `ЭКЗАМЕН (отработка)` идут как обычные тесты
- Группы определяются по сбросу нумерации
- Рекомендации и зоны роста собираются по правилам из `md`
- Цвета учеников выдаются в порядке `9.1 -> 9.2 -> 9.3`
