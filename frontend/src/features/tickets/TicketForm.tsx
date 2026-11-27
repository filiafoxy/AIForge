import { useEffect, useId, useRef } from "react";
import { Button } from "../../components/Button";
import type { Manual } from "../../config/manuals";
import type { TicketUrgency } from "../../types/ticket";
import { PriorityReasons } from "./PriorityReasons";
import { URGENCY_TEXT } from "./priority";
import type { PriorityAssessment } from "./priority";
import { MAX_TEXT_LENGTH } from "./ticketDraft";
import type { DraftErrors, ReferenceDraft, TicketDraft } from "./ticketDraft";
import styles from "./TicketCard.module.css";

interface TicketFormProps {
  draft: TicketDraft;
  errors: DraftErrors;
  /** Руководства на двигатель машины: сослаться можно только на них. */
  manuals: readonly Manual[];
  assessment: PriorityAssessment;
  /** Меняется, когда проверка формы нашла ошибки: фокус переходит на первое поле с ошибкой. */
  focusErrorSignal: number;
  onChange: (draft: TicketDraft) => void;
  /** Механик закончил правки и хочет увидеть итоговый состав. */
  onSubmit: () => void;
  onCancel: () => void;
}

const URGENCY_OPTIONS: readonly TicketUrgency[] = ["low", "medium", "high"];

/** Форма заявки: всё, что механик может поправить перед предпросмотром. */
export function TicketForm({
  draft,
  errors,
  manuals,
  assessment,
  focusErrorSignal,
  onChange,
  onSubmit,
  onCancel,
}: TicketFormProps) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (focusErrorSignal === 0) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [focusErrorSignal]);

  function changeReference(rowId: number, change: Partial<ReferenceDraft>) {
    onChange({
      ...draft,
      references: draft.references.map((row) =>
        row.id === rowId ? { ...row, ...change } : row,
      ),
    });
  }

  function addReference() {
    const nextId = Math.max(-1, ...draft.references.map((row) => row.id)) + 1;
    onChange({
      ...draft,
      references: [
        ...draft.references,
        { id: nextId, manual: manuals[0]?.name ?? "", page: "" },
      ],
    });
  }

  function removeReference(rowId: number) {
    onChange({
      ...draft,
      references: draft.references.filter((row) => row.id !== rowId),
    });
  }

  return (
    <form
      ref={formRef}
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.field}>
        <label htmlFor={`${id}-conclusion`} className={styles.label}>
          Заключение
        </label>
        <textarea
          id={`${id}-conclusion`}
          className={`${styles.input} ${styles.textarea}`}
          rows={4}
          maxLength={MAX_TEXT_LENGTH}
          value={draft.conclusion}
          aria-invalid={errors.conclusion !== undefined}
          aria-describedby={
            errors.conclusion !== undefined
              ? `${id}-conclusion-error`
              : undefined
          }
          onChange={(event) =>
            onChange({ ...draft, conclusion: event.target.value })
          }
        />
        {errors.conclusion !== undefined && (
          <p id={`${id}-conclusion-error`} className={styles.error}>
            {errors.conclusion}
          </p>
        )}
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.label}>Приоритет</legend>
        <div className={styles.options}>
          {URGENCY_OPTIONS.map((urgency) => (
            <label key={urgency} className={styles.option}>
              <input
                type="radio"
                className={styles.radio}
                name={`${id}-urgency`}
                value={urgency}
                checked={draft.urgency === urgency}
                onChange={() => onChange({ ...draft, urgency })}
              />
              {URGENCY_TEXT[urgency]}
            </label>
          ))}
        </div>
        <PriorityReasons urgency={draft.urgency} assessment={assessment} />
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={`${id}-operations`} className={styles.label}>
          Работы
        </label>
        <p id={`${id}-operations-hint`} className={styles.hint}>
          Каждая работа — с новой строки. Порядок ремонта берите из руководства
          или из ответов помощника.
        </p>
        <textarea
          id={`${id}-operations`}
          className={`${styles.input} ${styles.textarea}`}
          rows={3}
          maxLength={MAX_TEXT_LENGTH}
          value={draft.operations}
          aria-invalid={errors.operations !== undefined}
          aria-describedby={
            errors.operations !== undefined
              ? `${id}-operations-error ${id}-operations-hint`
              : `${id}-operations-hint`
          }
          onChange={(event) =>
            onChange({ ...draft, operations: event.target.value })
          }
        />
        {errors.operations !== undefined && (
          <p id={`${id}-operations-error`} className={styles.error}>
            {errors.operations}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-parts`} className={styles.label}>
          Запчасти
        </label>
        <p id={`${id}-parts-hint`} className={styles.hint}>
          Каждая запчасть — с новой строки. Можно оставить пустым.
        </p>
        <textarea
          id={`${id}-parts`}
          className={`${styles.input} ${styles.textarea}`}
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={draft.spareParts}
          aria-describedby={`${id}-parts-hint`}
          onChange={(event) =>
            onChange({ ...draft, spareParts: event.target.value })
          }
        />
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.label}>Источники</legend>
        <p className={styles.hint}>
          Руководство и страница PDF, на которые опирается заявка. Номер
          страницы берите из ответа помощника или из самого руководства и
          сверяйте его с документом.
        </p>

        {draft.references.map((row, index) => {
          const rowError = errors.referenceRows[row.id];
          const errorId = `${id}-reference-${row.id}-error`;
          const pageCount = manuals.find(
            (manual) => manual.name === row.manual,
          )?.pageCount;

          return (
            <div
              key={row.id}
              className={styles.reference}
              role="group"
              aria-label={`Источник ${index + 1}`}
            >
              {manuals.length === 1 ? (
                // Выбирать не из чего: руководство у двигателя одно. Текстом его название видно целиком.
                <div className={styles.field}>
                  <span className={styles.label}>Руководство</span>
                  <span>{manuals[0].name}</span>
                </div>
              ) : (
                <div className={styles.field}>
                  <label
                    htmlFor={`${id}-reference-${row.id}-manual`}
                    className={styles.label}
                  >
                    Руководство
                  </label>
                  <select
                    id={`${id}-reference-${row.id}-manual`}
                    className={styles.input}
                    value={row.manual}
                    onChange={(event) =>
                      changeReference(row.id, { manual: event.target.value })
                    }
                  >
                    {manuals.map((manual) => (
                      <option key={manual.name} value={manual.name}>
                        {manual.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.field}>
                <label
                  htmlFor={`${id}-reference-${row.id}-page`}
                  className={styles.label}
                >
                  Страница{pageCount !== undefined && ` (1–${pageCount})`}
                </label>
                <input
                  id={`${id}-reference-${row.id}-page`}
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={32}
                  value={row.page}
                  aria-invalid={rowError !== undefined}
                  aria-describedby={
                    rowError !== undefined ? errorId : undefined
                  }
                  onChange={(event) =>
                    changeReference(row.id, { page: event.target.value })
                  }
                />
              </div>
              {rowError !== undefined && (
                <p
                  id={errorId}
                  className={`${styles.error} ${styles.referenceError}`}
                >
                  {rowError}
                </p>
              )}
              {draft.references.length > 1 && (
                <div className={styles.referenceRemove}>
                  <Button
                    aria-label={`Удалить источник ${index + 1}`}
                    onClick={() => removeReference(row.id)}
                  >
                    Удалить
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {errors.references !== undefined && (
          <p className={styles.error}>{errors.references}</p>
        )}
        <div className={styles.actions}>
          <Button onClick={addReference} disabled={manuals.length === 0}>
            Добавить источник
          </Button>
        </div>
      </fieldset>

      <div className={styles.actions}>
        <Button type="submit" variant="primary">
          К предпросмотру
        </Button>
        <Button onClick={onCancel}>Отменить заявку</Button>
      </div>
    </form>
  );
}
