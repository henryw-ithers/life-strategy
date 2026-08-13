/**
 * Bounds shared by the add and edit sheets.
 *
 * A task title is a name, not a description — the description field
 * exists for the rest. The cap is here rather than inline in each sheet
 * because the row that renders the result is laid out against it: task
 * rows are a uniform height (the drag maths in `ReorderableList`
 * depends on it), so the longest possible title has to be one that
 * still fits in two lines at `TASK_ROW_HEIGHT`.
 */
export const TASK_TITLE_MAX = 60;

/** Where the sheets start showing the remaining count. Silent until
 *  the limit is close enough to matter; a counter on every field is
 *  noise on the common case, which is a five-word title. */
export const TASK_TITLE_COUNTER_AT = 10;
