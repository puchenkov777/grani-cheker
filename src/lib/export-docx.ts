import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ISectionOptions,
} from "docx";
import { saveAs } from "file-saver";

interface Fact { fact: string; conclusion: string; source: string }
interface IdeaFields { name: string; concept: string; audience: string; how_it_works: string; benefit: string }
interface Step { step: string; timeframe: string; expected_result: string }
interface Resource { resource: string; cost: string; source: string }

interface DraftData {
  name: string;
  mentor: string;
  challenge?: string;
  caseTitle: string;
  facts: Fact[];
  generalConclusion: string;
  ideaFields: IdeaFields;
  steps: Step[];
  resources: Resource[];
}

const B = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
} as const;

const hCell = (t: string) =>
  new TableCell({
    borders: B,
    shading: { fill: "FF8F0F" },
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: "FFFFFF", size: 20, font: "Arial" })] })],
  });

const tCell = (t: string) =>
  new TableCell({
    borders: B,
    children: [new Paragraph({ children: [new TextRun({ text: t || "—", size: 20, font: "Arial" })] })],
  });

const h1 = (t: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: t, bold: true, size: 28, font: "Arial", color: "FF8F0F" })] });

const h2 = (t: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: t, bold: true, size: 22, font: "Arial", color: "555555" })] });

const p = (t: string) =>
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t || "—", size: 20, font: "Arial" })] });

const spacer = () => new Paragraph({ spacing: { after: 50 }, children: [] });

export async function exportToDocx(draft: DraftData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  // Title
  content.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Решение кейса", bold: true, size: 36, font: "Arial", color: "FF8F0F" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `«${draft.caseTitle || "Без названия"}»`, bold: true, size: 28, font: "Arial" })],
    }),
    h2("Участник:"), p(draft.name || "—"),
    h2("Ментор:"), p(draft.mentor || "—"),
    spacer(),
  );

  // --- Section 1: Analytics ---
  content.push(h1("1. Погрузись в тему (Аналитика)"));

  const filledFacts = draft.facts.filter((f) => f.fact.trim());
  if (filledFacts.length > 0) {
    content.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hCell("№"), hCell("Факт"), hCell("Вывод"), hCell("Источник")] }),
          ...filledFacts.map((f, i) =>
            new TableRow({ children: [tCell(String(i + 1)), tCell(f.fact), tCell(f.conclusion), tCell(f.source)] })
          ),
        ],
      })
    );
  } else {
    content.push(p("Факты не заполнены."));
  }

  content.push(spacer(), h2("Общий вывод:"), p(draft.generalConclusion));

  // --- Section 2: Idea ---
  content.push(h1("2. Придумай решение (Идея)"));
  content.push(h2("Название проекта:"), p(draft.ideaFields.name));
  content.push(h2("Общая концепция:"), p(draft.ideaFields.concept));
  content.push(h2("Целевая аудитория:"), p(draft.ideaFields.audience));
  content.push(h2("Как работает идея:"), p(draft.ideaFields.how_it_works));
  content.push(h2("Какая польза:"), p(draft.ideaFields.benefit));

  // --- Section 3: Steps ---
  content.push(h1("3. Придумай шаги (Шаги)"));

  const filledSteps = draft.steps.filter((s) => s.step.trim());
  if (filledSteps.length > 0) {
    content.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hCell("№"), hCell("Шаг"), hCell("Время"), hCell("Ожидаемый результат")] }),
          ...filledSteps.map((s, i) =>
            new TableRow({ children: [tCell(String(i + 1)), tCell(s.step), tCell(s.timeframe), tCell(s.expected_result)] })
          ),
        ],
      })
    );
  } else {
    content.push(p("Шаги не заполнены."));
  }

  // --- Section 4: Budget ---
  content.push(h1("4. Рассчитай бюджет (Бюджет)"));

  const filledResources = draft.resources.filter((r) => r.resource.trim());
  if (filledResources.length > 0) {
    content.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hCell("Ресурс"), hCell("Стоимость"), hCell("Источник")] }),
          ...filledResources.map((r) =>
            new TableRow({ children: [tCell(r.resource), tCell(r.cost), tCell(r.source)] })
          ),
        ],
      })
    );
  } else {
    content.push(p("Бюджет не заполнен."));
  }

  // --- Footer ---
  content.push(
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300 },
      children: [new TextRun({ text: "Сформировано в Грани Чекер", size: 16, font: "Arial", color: "999999", italics: true })],
    })
  );

  const doc = new Document({
    sections: [{ children: content } as ISectionOptions],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Кейс_${draft.caseTitle || "черновик"}.docx`);
}
