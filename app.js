const THEME_KEY = "sqlite-review-theme";
const WORKSPACE_SPLIT_KEY = "sqlite-review-workspace-split";
const WORKSPACE_SQL_KEY = "sqlite-review-sql";
const WORKSPACE_DB_KEY = "sqlite-review-workspace-db";
const WORKSPACE_DB_NAME_KEY = "sqlite-review-workspace-db-name";
const SAMPLE_DB_NAME = "sample.sqlite";
const EMPTY_DB_NAME = "untitled.sqlite";

const SAMPLE_SQL = `CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Carol', 'carol@example.com');

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO orders (user_id, amount, status) VALUES
  (1, 19.90, 'paid'),
  (2, 35.00, 'paid'),
  (1, 88.50, 'pending');

SELECT * FROM users ORDER BY id;`;

const SQL_JS_BASE =
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/";

const themeBtn = document.getElementById("themeBtn");
const importBtn = document.getElementById("importBtn");
const newBtn = document.getElementById("newBtn");
const sampleBtn = document.getElementById("sampleBtn");
const clearWorkspaceBtn = document.getElementById("clearWorkspaceBtn");
const exportBtn = document.getElementById("exportBtn");
const runBtn = document.getElementById("runBtn");
const clearEditorBtn = document.getElementById("clearEditorBtn");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const sqlHighlight = document.getElementById("sqlHighlight");
const sqlEditor = document.getElementById("sqlEditor");
const resultArea = document.getElementById("resultArea");
const resultMeta = document.getElementById("resultMeta");
const queryMeta = document.getElementById("queryMeta");
const queryHint = document.getElementById("queryHint");
const dbName = document.getElementById("dbName");
const tableCount = document.getElementById("tableCount");
const dbSize = document.getElementById("dbSize");
const dbState = document.getElementById("dbState");
const tableMeta = document.getElementById("tableMeta");
const schemaMeta = document.getElementById("schemaMeta");
const tableList = document.getElementById("tableList");
const schemaPanel = document.getElementById("schemaPanel");
const dbBadge = document.getElementById("dbBadge");
const workspace = document.querySelector(".workspace");
const workspaceSplitter = document.getElementById("workspaceSplitter");

let sqlJsModule = null;
let db = null;
let currentDbName = "";
let selectedTable = "";
let currentTables = [];
let workspaceDragState = null;
let skipNextImportConfirmation = false;
let editorContentSource = "empty";
let lastAutoPreviewSql = "";

const SQL_KEYWORDS = new Set(
  [
    "abort",
    "action",
    "add",
    "after",
    "all",
    "alter",
    "analyse",
    "analyze",
    "and",
    "as",
    "asc",
    "attach",
    "autoincrement",
    "before",
    "begin",
    "between",
    "by",
    "cascade",
    "case",
    "cast",
    "check",
    "collate",
    "column",
    "commit",
    "conflict",
    "constraint",
    "create",
    "cross",
    "current_date",
    "current_time",
    "current_timestamp",
    "database",
    "default",
    "deferrable",
    "deferred",
    "delete",
    "desc",
    "distinct",
    "drop",
    "each",
    "else",
    "end",
    "escape",
    "except",
    "exclusive",
    "exists",
    "explain",
    "fail",
    "for",
    "foreign",
    "from",
    "full",
    "glob",
    "group",
    "having",
    "if",
    "ignore",
    "immediate",
    "in",
    "index",
    "indexed",
    "initially",
    "inner",
    "insert",
    "instead",
    "intersect",
    "into",
    "is",
    "isnull",
    "join",
    "key",
    "left",
    "like",
    "limit",
    "match",
    "natural",
    "not",
    "notnull",
    "null",
    "of",
    "offset",
    "on",
    "or",
    "order",
    "outer",
    "plan",
    "pragma",
    "primary",
    "query",
    "raise",
    "references",
    "regexp",
    "reindex",
    "release",
    "rename",
    "replace",
    "restrict",
    "returning",
    "rollback",
    "row",
    "savepoint",
    "select",
    "set",
    "table",
    "temp",
    "temporary",
    "then",
    "to",
    "transaction",
    "trigger",
    "union",
    "unique",
    "update",
    "using",
    "vacuum",
    "values",
    "view",
    "when",
    "where",
    "with",
  ].map((item) => item.toUpperCase())
);

const SQL_LITERALS = new Set(["TRUE", "FALSE", "NULL"]);

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "白天模式" : "夜间模式";
}

function updateStatus(text, type = "") {
  dbBadge.textContent = text;
  dbBadge.classList.remove("is-error", "is-loading", "is-success", "is-warning");
  if (type) {
    dbBadge.classList.add(type);
  }
}

function setResultStatus(text, type = "") {
  resultMeta.textContent = text;
  resultMeta.classList.remove("is-error", "is-loading", "is-success", "is-warning");
  if (type) {
    resultMeta.classList.add(type);
  }
}

function setQueryHint(text, type = "") {
  queryHint.textContent = text;
  queryHint.classList.remove("is-error", "is-loading", "is-success", "is-warning");
  if (type) {
    queryHint.classList.add(type);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function isSelectLike(sql) {
  return /^\s*(select|with|pragma|explain)\b/i.test(sql);
}

function debounce(fn, delay) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function persistWorkspaceDb() {
  if (!db) {
    localStorage.removeItem(WORKSPACE_DB_KEY);
    localStorage.removeItem(WORKSPACE_DB_NAME_KEY);
    return;
  }

  try {
    const bytes = db.export();
    localStorage.setItem(WORKSPACE_DB_KEY, bytesToBase64(bytes));
    localStorage.setItem(WORKSPACE_DB_NAME_KEY, currentDbName || "");
  } catch (error) {
    console.warn("Failed to persist workspace db:", error);
    setQueryHint("数据库过大，暂未持久化", "is-warning");
  }
}

function loadPersistedWorkspaceDb() {
  const encoded = localStorage.getItem(WORKSPACE_DB_KEY);
  if (!encoded) {
    return null;
  }

  try {
    const bytes = base64ToBytes(encoded);
    const name = localStorage.getItem(WORKSPACE_DB_NAME_KEY) || EMPTY_DB_NAME;
    return { bytes, name };
  } catch (error) {
    console.warn("Failed to load persisted workspace db:", error);
    localStorage.removeItem(WORKSPACE_DB_KEY);
    localStorage.removeItem(WORKSPACE_DB_NAME_KEY);
    return null;
  }
}

function escapeHtmlPreserveSpaces(value) {
  return escapeHtml(value)
    .replaceAll(" ", "&nbsp;")
    .replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;");
}

function highlightSql(sql) {
  const source = String(sql || "");
  if (!source) {
    return "";
  }

  const parts = [];
  let index = 0;

  const push = (className, text) => {
    parts.push(className ? `<span class="${className}">${escapeHtmlPreserveSpaces(text)}</span>` : escapeHtmlPreserveSpaces(text));
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "-" && next === "-") {
      const end = source.indexOf("\n", index);
      const text = end === -1 ? source.slice(index) : source.slice(index, end);
      push("sql-token-comment", text);
      index += text.length;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const text = end === -1 ? source.slice(index) : source.slice(index, end + 2);
      push("sql-token-comment", text);
      index += text.length;
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === quote) {
          if (source[cursor + 1] === quote) {
            cursor += 2;
            continue;
          }
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      const text = source.slice(index, cursor);
      push("sql-token-string", text);
      index += text.length;
      continue;
    }

    if (/\d/.test(char)) {
      const match = source.slice(index).match(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
      if (match) {
        push("sql-token-number", match[0]);
        index += match[0].length;
        continue;
      }
    }

    if (/[A-Za-z_]/.test(char)) {
      const match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
      if (match) {
        const upper = match[0].toUpperCase();
        if (SQL_LITERALS.has(upper)) {
          push("sql-token-number", match[0]);
        } else if (SQL_KEYWORDS.has(upper)) {
          const isFunctionName =
            source[index + match[0].length] === "(" &&
            ["COUNT", "MAX", "MIN", "AVG", "SUM", "TOTAL", "LENGTH", "UPPER", "LOWER", "COALESCE", "IFNULL", "ROUND"].includes(upper);
          push(isFunctionName ? "sql-token-function" : "sql-token-keyword", match[0]);
        } else {
          push("sql-token-identifier", match[0]);
        }
        index += match[0].length;
        continue;
      }
    }

    if (/[+\-*/%=<>.,();]/.test(char)) {
      push("sql-token-operator", char);
      index += 1;
      continue;
    }

    push("", char);
    index += 1;
  }

  return parts.join("");
}

function renderSqlHighlight() {
  if (!sqlHighlight) return;
  const text = sqlEditor.value || "";
  sqlHighlight.innerHTML = `<code>${highlightSql(text)}${text.endsWith("\n") ? "\n" : ""}</code>`;
}

function syncSqlEditorScroll() {
  if (!sqlHighlight) return;
  sqlHighlight.scrollTop = sqlEditor.scrollTop;
  sqlHighlight.scrollLeft = sqlEditor.scrollLeft;
}

function hasWorkspaceContent() {
  return Boolean(db) || Boolean(sqlEditor.value.trim()) || currentTables.length > 0 || Boolean(selectedTable);
}

function confirmWorkspaceReplacement(actionLabel) {
  if (!hasWorkspaceContent()) {
    return true;
  }

  return window.confirm(`当前工作区已有内容，继续${actionLabel}会替换当前数据库并丢失现有表数据和执行结果，是否继续？`);
}

function applyWorkspaceSplit(ratio) {
  if (!workspace) return 0.42;
  const nextRatio = clamp(ratio, 0.22, 0.72);
  workspace.style.setProperty("--workspace-split", `${(nextRatio * 100).toFixed(2)}%`);
  return nextRatio;
}

function getWorkspaceSplit() {
  const saved = Number(localStorage.getItem(WORKSPACE_SPLIT_KEY));
  if (Number.isFinite(saved) && saved > 0 && saved < 1) {
    return saved;
  }
  return 0.42;
}

function resetWorkspaceView(statusText = "工作区已清空", statusType = "is-success") {
  if (db && typeof db.close === "function") {
    db.close();
  }
  db = null;
  currentDbName = "";
  selectedTable = "";
  currentTables = [];
  sqlEditor.value = "";
  debouncedSave.cancel();
  localStorage.removeItem(WORKSPACE_SQL_KEY);
  queryMeta.textContent = "0 chars";
  dbName.textContent = "";
  dbSize.textContent = "0 KB";
  tableCount.textContent = "0";
  dbState.textContent = "未加载";
  tableMeta.textContent = "暂无表";
  schemaMeta.textContent = "未选择表";
  tableList.className = "list-card empty-card";
  tableList.textContent = "当前没有表。执行 `CREATE TABLE` 即可开始。";
  schemaPanel.className = "schema-card empty-card";
  schemaPanel.textContent = "选择左侧表后，这里会显示字段定义。";
  resultArea.className = "result-area empty-card";
  resultArea.textContent =
    statusText === "未加载"
      ? "当前还没有加载数据库。请先导入 SQLite 文件，或新建空库后再执行 SQL。"
      : "工作区已清空。请先导入 SQLite 文件，或新建空库后再执行 SQL。";
  setResultStatus("未加载", "");
  setQueryHint("请先导入或新建数据库", "is-warning");
  updateStatus(statusText, statusType);
  renderSqlHighlight();
  syncSqlEditorScroll();
  persistWorkspaceDb();
}

function renderLoadedWorkspace(message, type = "is-success") {
  updateStatus(message, type);
  currentTables = getTables();
  refreshSummary();
  renderTableList();
  renderSchemaPanel(selectedTable);
  persistWorkspaceDb();
}

function createEmptyDb() {
  if (db && typeof db.close === "function") {
    db.close();
  }
  db = new sqlJsModule.Database();
  currentDbName = EMPTY_DB_NAME;
  selectedTable = "";
  renderLoadedWorkspace("已创建空数据库", "is-success");
  renderMessage("空数据库已创建，可以继续执行 SQL。", "info");
  setQueryHint("Ctrl/Cmd + E 运行", "is-success");
}

function importDbFromBytes(bytes, name = EMPTY_DB_NAME) {
  if (db && typeof db.close === "function") {
    db.close();
  }
  db = new sqlJsModule.Database(new Uint8Array(bytes));
  currentDbName = name || EMPTY_DB_NAME;
  selectedTable = "";
  renderLoadedWorkspace("数据库已导入", "is-success");
  renderMessage("数据库已导入，可以继续查询或修改。", "info");
  setQueryHint("Ctrl/Cmd + E 运行", "is-success");
}

function createSampleDb() {
  if (db && typeof db.close === "function") {
    db.close();
  }
  db = new sqlJsModule.Database();
  currentDbName = SAMPLE_DB_NAME;
  selectedTable = "";
  try {
    sqlEditor.value = SAMPLE_SQL;
    editorContentSource = "auto";
    lastAutoPreviewSql = SAMPLE_SQL;
    renderQueryMeta(sqlEditor.value);
    renderSqlHighlight();
    executeSql();
    renderLoadedWorkspace("示例数据库已载入", "is-success");
    setQueryHint("Ctrl/Cmd + E 运行", "is-success");
  } catch (error) {
    console.error(error);
    updateStatus("示例数据库加载失败", "is-error");
    renderMessage("示例数据库初始化失败： " + (error?.message || String(error)), "error");
  }
}

function getDbExportBytes() {
  if (!db) {
    return new Uint8Array();
  }
  return db.export();
}

function refreshSummary() {
  const bytes = getDbExportBytes();
  dbName.textContent = currentDbName || "";
  dbSize.textContent = formatBytes(bytes.length);
  const tableCountValue = currentTables.filter((item) => item.type === "table").length;
  tableCount.textContent = String(tableCountValue);
  dbState.textContent = db ? (currentTables.length > 0 ? "可查询" : "空库") : "未加载";
}

function renderTableList() {
  if (!currentTables.length) {
    tableMeta.textContent = "暂无表";
    tableList.className = "list-card empty-card";
    tableList.textContent = "当前没有表。执行 `CREATE TABLE` 即可开始。";
    return;
  }

  const tableCountValue = currentTables.filter((item) => item.type === "table").length;
  const viewCountValue = currentTables.filter((item) => item.type === "view").length;
  tableMeta.textContent =
    viewCountValue > 0 ? `${tableCountValue} 张表 · ${viewCountValue} 个视图` : `${tableCountValue} 张表`;
  const wrapper = document.createElement("div");
  wrapper.className = "table-list";

  for (const table of currentTables) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `table-item${table.name === selectedTable ? " is-active" : ""}`;
    item.innerHTML = `<span>${escapeHtml(table.name)}</span><span class="muted-text">${escapeHtml(table.type)}</span>`;
    item.addEventListener("click", () => selectTable(table.name));
    wrapper.appendChild(item);
  }

  tableList.className = "list-card";
  tableList.replaceChildren(wrapper);
}

function renderSchemaPanel(tableName) {
  if (!tableName) {
    schemaMeta.textContent = "未选择表";
    schemaPanel.className = "schema-card empty-card";
    schemaPanel.textContent = "选择左侧表后，这里会显示字段定义。";
    return;
  }

  let info = [];
  let rowCount = 0;
  try {
    info = db.exec(`PRAGMA table_info(${normalizeIdentifier(tableName)});`)[0]?.values || [];
    rowCount =
      db.exec(
        `SELECT COUNT(*) AS count FROM ${normalizeIdentifier(tableName)};`
      )[0]?.values?.[0]?.[0] || 0;
  } catch (error) {
    console.error(error);
  }

  schemaMeta.textContent = `${rowCount} 行`;
  const columns =
    "cid,name,type,notnull,dflt_value,pk".split(",");
  const rows = info.length
    ? info.map((row) => {
        const mapped = {};
        columns.forEach((key, index) => {
          mapped[key] = row[index];
        });
        return mapped;
      })
    : [];

  const parts = [];
  parts.push(
    `<div class="pill-row">
      <span class="pill">表名：${escapeHtml(tableName)}</span>
      <span class="pill">记录数：${escapeHtml(rowCount)}</span>
      <span class="pill">预览：5 行</span>
    </div>`
  );

  if (rows.length) {
    parts.push(`<table class="schema-table"><thead><tr>
      <th>字段</th><th>类型</th><th>非空</th><th>默认值</th><th>主键</th>
    </tr></thead><tbody>`);
    for (const row of rows) {
      parts.push(
        `<tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.type || "")}</td>
          <td>${row.notnull ? "是" : "否"}</td>
          <td>${escapeHtml(row.dflt_value ?? "")}</td>
          <td>${row.pk ? "是" : "否"}</td>
        </tr>`
      );
    }
    parts.push(`</tbody></table>`);
  } else {
    parts.push(`<div class="empty-card">未能读取字段信息。</div>`);
  }

  schemaPanel.className = "schema-card";
  schemaPanel.innerHTML = parts.join("");
}

function renderTablePreview(tableName) {
  if (!db) {
    return;
  }

  try {
    const query = `SELECT * FROM ${normalizeIdentifier(tableName)} LIMIT 5;`;
    const result = db.exec(query)[0];
    const rowCount =
      db.exec(`SELECT COUNT(*) AS count FROM ${normalizeIdentifier(tableName)};`)[0]?.values?.[0]?.[0] || 0;

    if (!result) {
      setResultStatus("无预览数据", "is-warning");
      resultArea.className = "result-area empty-card";
      resultArea.textContent = "当前表没有可预览的数据。";
      return;
    }

    setResultStatus(`${rowCount} 行 · 预览`, "is-success");
    resultArea.className = "result-area";
    resultArea.innerHTML = [
      `<p class="result-note">已选中表 <strong>${escapeHtml(tableName)}</strong>，以下为前 5 行预览。</p>`,
      renderDataTable(result.columns || [], result.values || []),
    ].join("");
  } catch (error) {
    console.error(error);
    setResultStatus("预览失败", "is-error");
    renderMessage(error?.message || String(error), "error");
  }
}

function renderMessage(message, type = "info") {
  const className =
    type === "error" ? "result-note" : type === "warning" ? "result-note" : "result-note";
  resultArea.className = "result-area";
  resultArea.innerHTML = `<p class="${className}">${escapeHtml(message)}</p>`;
}

function renderDataTable(columns, rows) {
  if (!columns.length) {
    return `<div class="empty-card">没有可显示的结果列。</div>`;
  }

  const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = row
        .map((value) => `<td>${escapeHtml(value ?? "NULL")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table class="result-table">
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderExecResult(results, sqlText) {
  if (!results.length) {
    renderMessage("SQL 已执行，没有返回结果集。", "info");
    return;
  }

  const last = results[results.length - 1];
  const rowCount = last.values.length;
  const previewNote = results.length > 1 ? `，共 ${results.length} 个结果集，已展示最后一个` : "";
  setResultStatus(`${rowCount} 行${previewNote}`, "is-success");
  resultArea.className = "result-area";
  resultArea.innerHTML = [
    `<p class="result-note">SQL 执行成功。${results.length > 1 ? "当前语句包含多个结果集。" : ""}</p>`,
    renderDataTable(last.columns || [], last.values || []),
  ].join("");
}

function getTables() {
  if (!db) return [];
  try {
    const query = db.exec(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name;"
    );
    const rowSet = query[0];
    if (!rowSet) return [];
    return rowSet.values.map((row) => ({ name: row[0], type: row[1] }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

function selectTable(name) {
  selectedTable = name;
  renderTableList();
  renderSchemaPanel(name);
  const previewSql = `SELECT * FROM ${normalizeIdentifier(name)} LIMIT 5;`;
  const currentSql = sqlEditor.value.trim();
  const shouldApplyPreview = !currentSql || editorContentSource !== "user" || currentSql === lastAutoPreviewSql;

  if (shouldApplyPreview) {
    sqlEditor.value = previewSql;
    renderQueryMeta(sqlEditor.value);
    renderSqlHighlight();
    syncSqlEditorScroll();
    editorContentSource = "auto";
    lastAutoPreviewSql = previewSql;
    setQueryHint("表已选中，按 Ctrl/Cmd + E 运行", "is-success");
  } else {
    setQueryHint("表已选中，已保留当前 SQL", "is-success");
  }
  renderTablePreview(name);
}

function renderQueryMeta(text) {
  queryMeta.textContent = `${text.length} chars`;
}

function clearEditorContent() {
  sqlEditor.value = "";
  debouncedSave.cancel();
  localStorage.removeItem(WORKSPACE_SQL_KEY);
  editorContentSource = "empty";
  lastAutoPreviewSql = "";
  renderQueryMeta(sqlEditor.value);
  renderSqlHighlight();
  syncSqlEditorScroll();
  setQueryHint("Ctrl/Cmd + E 运行", "");
  sqlEditor.focus();
}

function executeSql(forcedSql) {
  if (!db) {
    setResultStatus("未加载", "is-warning");
    renderMessage("请先导入 SQLite 文件或新建空库。", "warning");
    return;
  }

  const sqlText = (forcedSql ?? sqlEditor.value).trim();
  renderQueryMeta(sqlText);
  if (!sqlText) {
    setResultStatus("空 SQL", "is-warning");
    renderMessage("请输入 SQL 后再执行。", "warning");
    return;
  }

  try {
    setResultStatus("执行中", "is-loading");
    const results = db.exec(sqlText);
    const selectLike = isSelectLike(sqlText);
    const ddlLike = /^(create|drop|alter|rename|vacuum|reindex|attach|detach)\b/i.test(sqlText);
    const rowsModified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 0;
    currentTables = getTables();
    selectedTable = currentTables.some((item) => item.name === selectedTable) ? selectedTable : "";
    refreshSummary();
    renderTableList();
    renderSchemaPanel(selectedTable);

    if (results.length) {
      renderExecResult(results, sqlText);
    } else {
      if (ddlLike) {
        setResultStatus("结构已更新", "is-success");
        renderMessage(
          `SQL 已执行。数据库结构已更新，最近一次影响 ${rowsModified} 行。`,
          "info"
        );
      } else {
        setResultStatus(`${rowsModified} 行变更`, "is-success");
        renderMessage(`SQL 已执行。变更 ${rowsModified} 行。`, "info");
      }
    }

    setQueryHint(selectLike ? "查询成功" : "执行成功", "is-success");
    updateStatus(selectLike ? "已查询" : "已修改", selectLike ? "is-success" : "is-warning");
    persistWorkspaceDb();
  } catch (error) {
    console.error(error);
    setResultStatus("执行失败", "is-error");
    setQueryHint("执行失败", "is-error");
    renderMessage(error?.message || String(error), "error");
    updateStatus("执行失败", "is-error");
  }
}

const debouncedSave = debounce((value) => {
  localStorage.setItem(WORKSPACE_SQL_KEY, value);
}, 150);

sqlEditor.addEventListener("input", (event) => {
  renderQueryMeta(event.target.value);
  renderSqlHighlight();
  syncSqlEditorScroll();
  editorContentSource = event.target.value.trim() ? "user" : "empty";
  debouncedSave(event.target.value);
  setQueryHint("等待执行", "");
});

sqlEditor.addEventListener("keydown", (event) => {
  const isRunHotkey =
    (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "e";
  if (!isRunHotkey) {
    return;
  }

  event.preventDefault();
  executeSql();
});

sqlEditor.addEventListener("scroll", syncSqlEditorScroll);

themeBtn.addEventListener("click", () => {
  const nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});

importBtn.addEventListener("click", () => {
  if (!confirmWorkspaceReplacement("导入新的 SQLite 文件")) {
    skipNextImportConfirmation = false;
    return;
  }
  skipNextImportConfirmation = true;
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    skipNextImportConfirmation = false;
    return;
  }
  if (!skipNextImportConfirmation && !confirmWorkspaceReplacement(`导入文件「${file.name}」`)) {
    fileInput.value = "";
    return;
  }
  skipNextImportConfirmation = false;
  const bytes = await file.arrayBuffer();
  importDbFromBytes(bytes, file.name);
  fileInput.value = "";
});

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragover");
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragover");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragover");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  skipNextImportConfirmation = false;
  if (!confirmWorkspaceReplacement(`导入文件「${file.name}」`)) {
    return;
  }
  const bytes = await file.arrayBuffer();
  importDbFromBytes(bytes, file.name);
});

newBtn.addEventListener("click", () => {
  if (!confirmWorkspaceReplacement("新建空库")) {
    return;
  }
  createEmptyDb();
});

sampleBtn.addEventListener("click", () => {
  if (!confirmWorkspaceReplacement("载入示例数据库")) {
    return;
  }
  createSampleDb();
});

clearWorkspaceBtn.addEventListener("click", () => {
  if (hasWorkspaceContent() && !window.confirm("当前工作区已有内容，清空后将丢失数据库、SQL 编辑器和执行结果，是否继续？")) {
    return;
  }
  resetWorkspaceView();
});

exportBtn.addEventListener("click", () => {
  const bytes = getDbExportBytes();
  const blob = new Blob([bytes], { type: "application/x-sqlite3" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = currentDbName || EMPTY_DB_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  updateStatus("已导出", "is-success");
});

runBtn.addEventListener("click", () => {
  executeSql();
});

clearEditorBtn.addEventListener("click", () => {
  clearEditorContent();
});

function bindWorkspaceSplitter() {
  if (!workspace || !workspaceSplitter) {
    return;
  }

  const applyFromEvent = (event) => {
    const rect = workspace.getBoundingClientRect();
    if (!rect.height) return;
    const ratio = (event.clientY - rect.top) / rect.height;
    const nextRatio = applyWorkspaceSplit(ratio);
    localStorage.setItem(WORKSPACE_SPLIT_KEY, String(nextRatio));
  };

  workspaceSplitter.addEventListener("pointerdown", (event) => {
    workspaceDragState = {
      pointerId: event.pointerId,
    };
    workspace.classList.add("is-dragging");
    workspaceSplitter.setPointerCapture(event.pointerId);
  });

  workspaceSplitter.addEventListener("pointermove", (event) => {
    if (!workspaceDragState || workspaceDragState.pointerId !== event.pointerId) {
      return;
    }
    applyFromEvent(event);
  });

  const stopDrag = (event) => {
    if (!workspaceDragState) return;
    if (event?.pointerId !== undefined) {
      try {
        workspaceSplitter.releasePointerCapture(event.pointerId);
      } catch {}
    }
    workspace.classList.remove("is-dragging");
    workspaceDragState = null;
  };

  workspaceSplitter.addEventListener("pointerup", stopDrag);
  workspaceSplitter.addEventListener("pointercancel", stopDrag);
}

function initFromStorage() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(theme);
  applyWorkspaceSplit(getWorkspaceSplit());
  sqlEditor.value = localStorage.getItem(WORKSPACE_SQL_KEY) || "";
  editorContentSource = sqlEditor.value.trim() ? "user" : "empty";
  lastAutoPreviewSql = "";
  renderQueryMeta(sqlEditor.value);
  renderSqlHighlight();
  setQueryHint("Ctrl/Cmd + E 运行", "");
}

async function initSqlJsRuntime() {
  if (typeof initSqlJs !== "function") {
    throw new Error("sql.js 引擎未加载。");
  }

  const wasmBase = window.__SQL_JS_WASM_BASE__ || SQL_JS_BASE;
  sqlJsModule = await initSqlJs({
    locateFile: (file) => `${wasmBase}${file}`,
  });
}

async function bootstrap() {
  initFromStorage();
  await initSqlJsRuntime();
  bindWorkspaceSplitter();
  const restored = loadPersistedWorkspaceDb();
  if (restored) {
    db = new sqlJsModule.Database(restored.bytes);
    currentDbName = restored.name;
    selectedTable = "";
    renderLoadedWorkspace("已恢复工作区", "is-success");
    renderMessage("已从本地恢复上次的数据库与编辑内容。", "info");
  } else {
    resetWorkspaceView("未加载", "");
  }
}

window.addEventListener("beforeunload", (event) => {
  if (!hasWorkspaceContent()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

bootstrap().catch((error) => {
  console.error(error);
  setResultStatus("初始化失败", "is-error");
  renderMessage(error?.message || String(error), "error");
  updateStatus("初始化失败", "is-error");
});
