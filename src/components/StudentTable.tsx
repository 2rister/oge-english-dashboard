import type { TestResult } from "../types";
import { formatPercent } from "../lib/format";

export function StudentTable({ tests }: { tests: TestResult[] }) {
  return (
    <div className="tbl-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Тест</th>
            <th>Балл</th>
            <th>%</th>
            <th>Ауд.</th>
            <th>Чтен.</th>
            <th>Грам.</th>
            <th>Слов.</th>
            <th>Письмо</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.id}>
              <td>{test.label}</td>
              <td>{test.writtenScore}</td>
              <td>{formatPercent(test.writtenPercent)}</td>
              <td>{formatPercent(test.listeningPercent)}</td>
              <td>{formatPercent(test.readingPercent)}</td>
              <td>{formatPercent(test.grammarPercent)}</td>
              <td>{formatPercent(test.vocabularyPercent)}</td>
              <td>{formatPercent(test.writingPercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
