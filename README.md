# Грани Чекер

## Основа оценки

Шкалы пяти разделов заданы в `src/lib/prompts/`. Обобщённые замечания из предоставленного владельцем проекта сборника апелляций находятся в `src/lib/knowledge/appeal-patterns.ts` и добавляются в инструкции модели при новой проверке. Они помогают искать типичные пробелы, но не дают автоматических штрафов и не заменяют шкалу раздела. Полные тексты чужих апелляций в репозиторий и запросы модели не включены.

Модель анализирует отправленную работу и выбранное условие кейса; внешнюю проверку фактов и источников приложение не выполняет. Качество ответа на конкретной работе требует проверки ментором.

Оценка разделов, связности и соответствия заданию выполняется моделью `gpt-6-luna` с уровнем рассуждения `medium`. Распознавание текста на изображениях во вложениях остаётся на `gpt-4o-mini`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
