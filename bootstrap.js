const ASSET_TIMEOUT_MS = 4000;
const SQL_JS_ASSET = {
  name: "sql.js",
  cdn: "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/sql-wasm.js",
  local: "./public/vendor/sql.js/sql-wasm.js",
  wasmCdnBase: "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/",
  wasmLocalBase: "./public/vendor/sql.js/",
};

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Script load timeout: ${src}`));
    }, timeoutMs);

    script.src = src;
    script.async = false;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error(`Script load failed: ${src}`));
    };

    document.body.appendChild(script);
  });
}

function setBootstrapStatus(text, type) {
  const badge = document.getElementById("dbBadge");
  if (!badge) return;
  badge.textContent = text;
  badge.classList.remove("is-error", "is-loading", "is-success", "is-warning");
  if (type) {
    badge.classList.add(type);
  }
}

async function bootstrap() {
  setBootstrapStatus("加载 SQLite 引擎", "is-loading");
  let runtimeSource = "cdn";

  try {
    await loadScript(SQL_JS_ASSET.cdn, ASSET_TIMEOUT_MS);
  } catch {
    await loadScript(SQL_JS_ASSET.local, ASSET_TIMEOUT_MS);
    runtimeSource = "local";
    console.warn("[fallback] sql.js loaded from local");
  }

  window.__SQL_JS_WASM_BASE__ =
    runtimeSource === "cdn" ? SQL_JS_ASSET.wasmCdnBase : SQL_JS_ASSET.wasmLocalBase;
  setBootstrapStatus(runtimeSource === "cdn" ? "引擎已就绪" : "本地引擎已就绪", "is-success");
  await loadScript("./app.js", ASSET_TIMEOUT_MS);
}

bootstrap().catch((error) => {
  console.error("Bootstrap failed:", error);
  setBootstrapStatus("初始化失败", "is-error");
});
