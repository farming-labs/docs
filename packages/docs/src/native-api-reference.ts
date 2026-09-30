import type {
  NormalizedOpenApiMediaType,
  NormalizedOpenApiModel,
  NormalizedOpenApiOperation,
  NormalizedOpenApiParameter,
  NormalizedOpenApiResponse,
} from "./openapi-operations.js";
import type { DocsTheme } from "./types.js";

export interface NativeApiReferenceVersionLink {
  id: string;
  label: string;
  href: string;
  active: boolean;
}

export interface RenderNativeApiReferenceOptions {
  model: NormalizedOpenApiModel;
  pageTitle: string;
  title?: string;
  description?: string;
  basePath: string;
  openApiUrl: string;
  activeVersion?: string;
  versions?: NativeApiReferenceVersionLink[];
  theme?: DocsTheme;
}

interface NativeApiReferenceTokens {
  primary: string;
  primaryForeground: string;
  background: string;
  card: string;
  foreground: string;
  muted: string;
  border: string;
  radius: string;
  sans: string;
  mono: string;
  customPalette: boolean;
}

const METHOD_TONES: Record<string, string> = {
  GET: "success",
  POST: "info",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
  OPTIONS: "neutral",
  HEAD: "neutral",
  TRACE: "neutral",
};

export function renderNativeApiReferenceHtml(options: RenderNativeApiReferenceOptions): string {
  const { model } = options;
  const tokens = resolveTokens(options.theme);
  const description = options.description?.trim();
  const versions = options.versions ?? [];
  const groupedOperations = groupOperations(model.operations);
  const operationMarkup =
    model.operations.length > 0
      ? model.operations.map((operation) => renderOperation(operation, options)).join("\n")
      : renderEmptyContract();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="@farming-labs/docs" />
  <meta name="color-scheme" content="light dark" />
  <title>${escapeHtml(options.pageTitle)}</title>
  <style>${buildStyles(tokens)}</style>
</head>
<body>
  <a class="fl-skip-link" href="#fl-api-content">Skip to API operations</a>
  <div class="fl-api-shell">
    <header class="fl-api-topbar">
      <a class="fl-api-brand" href="${escapeAttribute(options.basePath)}" aria-label="API reference home">
        <span class="fl-api-brand-mark" aria-hidden="true">FL</span>
        <span>API Reference</span>
      </a>
      <div class="fl-api-topbar-actions">
        ${renderVersionSelect(versions, options.activeVersion)}
        <a class="fl-api-action" href="${escapeAttribute(options.openApiUrl)}" download>OpenAPI</a>
        <button class="fl-api-icon-button" type="button" data-theme-toggle aria-label="Switch color theme" title="Switch color theme">
          ${themeIcon()}
        </button>
      </div>
    </header>
    <div class="fl-api-layout">
      <aside class="fl-api-sidebar" aria-label="API operations">
        <div class="fl-api-sidebar-heading">
          <span class="fl-api-eyebrow">${escapeHtml(model.specificationVersion)}</span>
          <span>${model.operationCount} ${model.operationCount === 1 ? "operation" : "operations"}</span>
        </div>
        <label class="fl-api-search-label" for="fl-api-search">Search operations</label>
        <div class="fl-api-search-wrap">
          ${searchIcon()}
          <input id="fl-api-search" class="fl-api-search" type="search" placeholder="Method, path, tag…" autocomplete="off" />
          <kbd>/</kbd>
        </div>
        <p class="fl-api-search-status" data-search-status aria-live="polite"></p>
        <nav class="fl-api-operation-nav">
          ${renderNavigation(groupedOperations)}
        </nav>
      </aside>
      <main id="fl-api-content" class="fl-api-content">
        <section class="fl-api-hero" aria-labelledby="fl-api-title">
          <div class="fl-api-hero-copy">
            <p class="fl-api-eyebrow">${escapeHtml(model.version)} · ${escapeHtml(model.specificationVersion)}</p>
            <h1 id="fl-api-title">${escapeHtml(options.title ?? model.title)}</h1>
            ${description ? `<div class="fl-api-description">${renderText(description)}</div>` : ""}
          </div>
          <dl class="fl-api-summary">
            <div><dt>Operations</dt><dd>${model.operationCount}</dd></div>
            <div><dt>Tags</dt><dd>${model.tags.length}</dd></div>
            <div><dt>Servers</dt><dd>${model.servers.length}</dd></div>
          </dl>
          ${renderServers(model.servers)}
        </section>
        <section class="fl-api-operations" aria-label="Operations">
          ${operationMarkup}
          <div class="fl-api-no-results" data-no-results hidden>
            <strong>No operations match this search.</strong>
            <span>Try a method, route segment, operation ID, or tag.</span>
          </div>
        </section>
      </main>
    </div>
  </div>
  <div class="fl-api-live-region" aria-live="polite" aria-atomic="true" data-copy-status></div>
  <script>${buildClientScript()}</script>
</body>
</html>`;
}

function renderVersionSelect(
  versions: NativeApiReferenceVersionLink[],
  activeVersion?: string,
): string {
  if (versions.length === 0) return "";
  return `<label class="fl-api-version-control">
    <span>Version</span>
    <select data-version-select aria-label="API version">
      ${versions
        .map(
          (version) =>
            `<option value="${escapeAttribute(version.href)}"${version.active || version.id === activeVersion ? " selected" : ""}>${escapeHtml(version.label)}</option>`,
        )
        .join("")}
    </select>
  </label>`;
}

function renderNavigation(
  groups: Array<{ tag: string; operations: NormalizedOpenApiOperation[] }>,
): string {
  if (groups.length === 0) {
    return '<p class="fl-api-sidebar-empty">No operations in this contract.</p>';
  }
  return groups
    .map(
      (group) => `<section class="fl-api-nav-group" data-nav-group>
        <h2>${escapeHtml(group.tag)}</h2>
        <ul>
          ${group.operations
            .map(
              (
                operation,
              ) => `<li data-nav-operation data-search="${escapeAttribute(operationSearchText(operation))}">
                <a href="#operation-${escapeAttribute(operation.slug)}">
                  <span class="fl-api-method fl-api-method--${methodTone(operation.method)}">${escapeHtml(operation.method)}</span>
                  <span>${escapeHtml(operation.title)}</span>
                </a>
              </li>`,
            )
            .join("")}
        </ul>
      </section>`,
    )
    .join("\n");
}

function renderOperation(
  operation: NormalizedOpenApiOperation,
  options: RenderNativeApiReferenceOptions,
): string {
  const markdownUrl = `${options.basePath}/operations/${encodeURIComponent(operation.slug)}.md`;
  const curl = buildCurlExample(operation, options.model.servers);
  const consoleMarkup = renderApiConsole(operation, options.model.servers);
  const searchText = operationSearchText(operation);
  const description = operation.description?.trim();
  return `<article id="operation-${escapeAttribute(operation.slug)}" class="fl-api-operation" data-operation data-search="${escapeAttribute(searchText)}">
    <header class="fl-api-operation-header">
      <div class="fl-api-operation-meta">
        <span class="fl-api-method fl-api-method--${methodTone(operation.method)}">${escapeHtml(operation.method)}</span>
        <code>${escapeHtml(operation.path)}</code>
        ${operation.deprecated ? '<span class="fl-api-chip fl-api-chip--danger">Deprecated</span>' : ""}
      </div>
      <h2>${escapeHtml(operation.title)}</h2>
      ${operation.summary && operation.summary !== operation.title ? `<p class="fl-api-summary-copy">${escapeHtml(operation.summary)}</p>` : ""}
      ${description ? `<div class="fl-api-description">${renderText(description)}</div>` : ""}
      <div class="fl-api-operation-links">
        <a href="${escapeAttribute(markdownUrl)}">Markdown</a>
        <a href="#operation-${escapeAttribute(operation.slug)}" aria-label="Link to ${escapeAttribute(operation.title)}">Permalink</a>
        <code>${escapeHtml(operation.operationId)}</code>
      </div>
    </header>
    <div class="fl-api-operation-grid">
      <div class="fl-api-operation-details">
        ${renderParameters(operation.parameters)}
        ${renderRequestBody(operation.requestBody?.content ?? [], operation.requestBody?.required === true, operation.requestBody?.description)}
        ${renderResponses(operation.responses)}
        ${renderSecurity(operation)}
      </div>
      <aside class="fl-api-code-panel" aria-label="Request example and interactive console" data-console-root>
        <div class="fl-api-code-header">
          <div class="fl-api-code-tabs" role="tablist" aria-label="Request tools">
            <button id="example-tab-${escapeAttribute(operation.slug)}" type="button" role="tab" aria-selected="true" aria-controls="example-panel-${escapeAttribute(operation.slug)}" tabindex="0" data-console-tab="example">cURL</button>
            <button id="console-tab-${escapeAttribute(operation.slug)}" type="button" role="tab" aria-selected="false" aria-controls="console-panel-${escapeAttribute(operation.slug)}" tabindex="-1" data-console-tab="console">Try it</button>
          </div>
          <button type="button" class="fl-api-copy" data-copy="${escapeAttribute(curl)}" data-example-copy aria-label="Copy cURL request">Copy</button>
        </div>
        <div id="example-panel-${escapeAttribute(operation.slug)}" role="tabpanel" aria-labelledby="example-tab-${escapeAttribute(operation.slug)}" data-console-panel="example">
          <pre><code>${escapeHtml(curl)}</code></pre>
        </div>
        <div id="console-panel-${escapeAttribute(operation.slug)}" role="tabpanel" aria-labelledby="console-tab-${escapeAttribute(operation.slug)}" data-console-panel="console" hidden>
          ${consoleMarkup}
        </div>
      </aside>
    </div>
  </article>`;
}

function renderApiConsole(operation: NormalizedOpenApiOperation, modelServers: string[]): string {
  const server = operation.servers[0] ?? modelServers[0] ?? "";
  const requestBody = operation.requestBody;
  const requestMedia = requestBody?.content[0];
  const bodyExample = requestMedia ? mediaTypeExample(requestMedia) : undefined;
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(operation.method);
  return `<form class="fl-api-console" data-api-console data-method="${escapeAttribute(operation.method)}" data-path="${escapeAttribute(operation.path)}" novalidate>
    <div class="fl-api-console-intro">
      <div>
        <span class="fl-api-console-kicker">Browser request</span>
        <strong>${escapeHtml(operation.method)} ${escapeHtml(operation.path)}</strong>
      </div>
      <span class="fl-api-console-state" data-console-state data-state="idle">Ready</span>
    </div>
    <label class="fl-api-field">
      <span>Server URL or path <em>required</em></span>
      <input name="server" type="text" value="${escapeAttribute(server)}" placeholder="https://api.example.com" required spellcheck="false" autocomplete="url" />
    </label>
    ${renderConsoleParameters(operation.parameters)}
    ${renderConsoleAuthentication(operation)}
    ${requestBody ? renderConsoleRequestBody(requestBody.content, requestBody.required, bodyExample) : ""}
    <label class="fl-api-field fl-api-field--inline">
      <span>Browser credentials</span>
      <select name="credentials" aria-label="Browser credentials mode">
        <option value="same-origin">Same origin</option>
        <option value="include">Include cookies</option>
        <option value="omit">Omit cookies</option>
      </select>
    </label>
    ${mutating ? `<label class="fl-api-console-confirm"><input type="checkbox" data-console-confirm /><span>I understand this request may change data.</span></label>` : ""}
    <div class="fl-api-console-actions">
      <button class="fl-api-console-send" type="submit" data-console-send${mutating ? " disabled" : ""}>Send request</button>
      <button class="fl-api-console-cancel" type="button" data-console-cancel hidden>Cancel</button>
      <span data-console-message role="status" aria-live="polite"></span>
    </div>
    <div class="fl-api-console-error" data-console-error role="alert" hidden></div>
    <section class="fl-api-console-response" data-console-response aria-label="API response" tabindex="-1" hidden>
      <div class="fl-api-console-response-header">
        <div>
          <span class="fl-api-console-status" data-response-status></span>
          <span data-response-duration></span>
        </div>
        <button type="button" class="fl-api-copy" data-response-copy aria-label="Copy response body">Copy</button>
      </div>
      <div class="fl-api-console-response-meta">
        <code data-response-url></code>
        <span data-response-type></span>
      </div>
      <details class="fl-api-console-response-headers">
        <summary>Response headers${chevronIcon()}</summary>
        <pre><code data-response-headers></code></pre>
      </details>
      <pre class="fl-api-console-response-body"><code data-response-body></code></pre>
    </section>
    <p class="fl-api-console-note">Requests run in this browser. Cross-origin APIs must allow this docs origin through CORS. Credentials stay in memory and are never saved by Farming Labs.</p>
  </form>`;
}

function renderConsoleParameters(parameters: NormalizedOpenApiParameter[]): string {
  const editable = parameters.filter((parameter) => parameter.in !== "cookie");
  const cookies = parameters.filter((parameter) => parameter.in === "cookie");
  if (editable.length === 0 && cookies.length === 0) return "";
  return `<fieldset class="fl-api-console-group">
    <legend>Parameters</legend>
    ${editable.map(renderConsoleParameter).join("")}
    ${cookies.length > 0 ? `<p class="fl-api-console-hint">Cookie parameters (${cookies.map((parameter) => `<code>${escapeHtml(parameter.name)}</code>`).join(", ")}) are browser-managed. Choose <strong>Include cookies</strong> below when the API uses them.</p>` : ""}
  </fieldset>`;
}

function renderConsoleParameter(parameter: NormalizedOpenApiParameter): string {
  const schema = asRecord(parameter.schema);
  const type = schemaType(schema);
  const value = parameterExample(parameter);
  const common = `name="parameter" data-param-name="${escapeAttribute(parameter.name)}" data-param-location="${escapeAttribute(parameter.in)}" data-param-array="${type === "array" ? "true" : "false"}"${parameter.required ? " required" : ""}`;
  const control =
    type === "boolean"
      ? `<select ${common}><option value="">Select…</option><option value="true"${value === true ? " selected" : ""}>true</option><option value="false"${value === false ? " selected" : ""}>false</option></select>`
      : `<input ${common} type="${type === "number" || type === "integer" ? "number" : "text"}"${value !== undefined ? ` value="${escapeAttribute(formatInputValue(value))}"` : ""} placeholder="${escapeAttribute(parameterPlaceholder(parameter, type))}" spellcheck="false" autocomplete="off" />`;
  return `<label class="fl-api-field">
    <span><code>${escapeHtml(parameter.name)}</code> <small>${escapeHtml(parameter.in)}</small>${parameter.required ? " <em>required</em>" : ""}</span>
    ${control}
    ${parameter.description ? `<small class="fl-api-field-help">${escapeHtml(parameter.description)}</small>` : ""}
  </label>`;
}

function renderConsoleAuthentication(operation: NormalizedOpenApiOperation): string {
  const schemes = Object.entries(operation.securitySchemes);
  if (operation.security.length === 0 || schemes.length === 0) return "";
  return `<fieldset class="fl-api-console-group">
    <legend>Authentication</legend>
    ${schemes.map(([name, scheme]) => renderConsoleSecurityScheme(name, scheme)).join("")}
    <p class="fl-api-console-hint">Authentication values are used only for this request and are not persisted.</p>
  </fieldset>`;
}

function renderConsoleSecurityScheme(name: string, value: unknown): string {
  const scheme = asRecord(value) ?? {};
  const type = typeof scheme.type === "string" ? scheme.type.toLocaleLowerCase() : "";
  const httpScheme = typeof scheme.scheme === "string" ? scheme.scheme.toLocaleLowerCase() : "";
  const location = typeof scheme.in === "string" ? scheme.in : "header";
  const parameterName = typeof scheme.name === "string" ? scheme.name : name;
  if (type === "http" && httpScheme === "basic") {
    return `<div class="fl-api-auth-pair" data-auth-basic>
      <label class="fl-api-field"><span>${escapeHtml(name)} username</span><input type="text" data-auth-username autocomplete="username" /></label>
      <label class="fl-api-field"><span>${escapeHtml(name)} password</span><input type="password" data-auth-password autocomplete="current-password" /></label>
    </div>`;
  }
  if (type === "apikey") {
    if (location === "cookie") {
      return `<p class="fl-api-console-hint"><strong>${escapeHtml(name)}</strong> uses the browser-managed <code>${escapeHtml(parameterName)}</code> cookie. Choose <strong>Include cookies</strong> below.</p>`;
    }
    return `<label class="fl-api-field">
      <span>${escapeHtml(name)} <small>${escapeHtml(location)} · ${escapeHtml(parameterName)}</small></span>
      <input type="password" data-auth-api-key data-auth-location="${escapeAttribute(location)}" data-auth-name="${escapeAttribute(parameterName)}" autocomplete="off" />
    </label>`;
  }
  const tokenPrefix =
    type === "http" && httpScheme && httpScheme !== "bearer" ? httpScheme : "Bearer";
  return `<label class="fl-api-field">
    <span>${escapeHtml(name)} token</span>
    <input type="password" data-auth-token data-auth-prefix="${escapeAttribute(tokenPrefix)}" autocomplete="off" placeholder="Paste access token" />
  </label>`;
}

function renderConsoleRequestBody(
  content: NormalizedOpenApiMediaType[],
  required: boolean,
  bodyExample: unknown,
): string {
  const mediaTypes =
    content.length > 0 ? content : [{ mediaType: "application/json", examples: [] }];
  return `<fieldset class="fl-api-console-group">
    <legend>Request body${required ? " · required" : ""}</legend>
    <label class="fl-api-field fl-api-field--inline">
      <span>Content type</span>
      <select name="content-type">
        ${mediaTypes.map((media) => `<option value="${escapeAttribute(media.mediaType)}">${escapeHtml(media.mediaType)}</option>`).join("")}
      </select>
    </label>
    <label class="fl-api-field">
      <span>Body${required ? " <em>required</em>" : ""}</span>
      <textarea name="request-body" rows="8"${required ? " required" : ""} spellcheck="false" placeholder="Request body">${bodyExample === undefined ? "" : escapeHtml(formatRequestBody(bodyExample, mediaTypes[0]?.mediaType))}</textarea>
    </label>
  </fieldset>`;
}

function renderParameters(parameters: NormalizedOpenApiParameter[]): string {
  if (parameters.length === 0) return "";
  return `<section class="fl-api-section">
    <h3>Parameters <span>${parameters.length}</span></h3>
    <div class="fl-api-table-wrap">
      <table>
        <thead><tr><th scope="col">Name</th><th scope="col">Location</th><th scope="col">Type</th><th scope="col">Description</th></tr></thead>
        <tbody>
          ${parameters.map(renderParameter).join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderParameter(parameter: NormalizedOpenApiParameter): string {
  return `<tr>
    <td><code>${escapeHtml(parameter.name)}</code>${parameter.required ? '<span class="fl-api-required">required</span>' : ""}</td>
    <td><span class="fl-api-chip">${escapeHtml(parameter.in)}</span></td>
    <td><code>${escapeHtml(schemaLabel(parameter.schema))}</code></td>
    <td>${parameter.description ? renderText(parameter.description) : '<span class="fl-api-muted">—</span>'}</td>
  </tr>`;
}

function renderRequestBody(
  content: NormalizedOpenApiMediaType[],
  required: boolean,
  description?: string,
): string {
  if (content.length === 0 && !description) return "";
  return `<section class="fl-api-section">
    <h3>Request body ${required ? '<span class="fl-api-required">required</span>' : ""}</h3>
    ${description ? `<div class="fl-api-description">${renderText(description)}</div>` : ""}
    ${content.map((media) => renderMediaType(media, "Request schema")).join("")}
  </section>`;
}

function renderResponses(responses: NormalizedOpenApiResponse[]): string {
  if (responses.length === 0) {
    return `<section class="fl-api-section"><h3>Responses</h3><p class="fl-api-muted">No responses are documented.</p></section>`;
  }
  return `<section class="fl-api-section">
    <h3>Responses <span>${responses.length}</span></h3>
    <div class="fl-api-response-list">
      ${responses.map(renderResponse).join("")}
    </div>
  </section>`;
}

function renderResponse(response: NormalizedOpenApiResponse): string {
  return `<details class="fl-api-response"${response.status.startsWith("2") ? " open" : ""}>
    <summary>
      <code>${escapeHtml(response.status)}</code>
      <span>${escapeHtml(response.description ?? "Response")}</span>
      ${chevronIcon()}
    </summary>
    <div class="fl-api-response-content">
      ${response.content.length > 0 ? response.content.map((media) => renderMediaType(media, "Response schema")).join("") : '<p class="fl-api-muted">No response body.</p>'}
    </div>
  </details>`;
}

function renderMediaType(media: NormalizedOpenApiMediaType, label: string): string {
  const schema = media.schema === undefined ? undefined : safeJson(media.schema);
  const example = media.examples.find((entry) => entry.value !== undefined);
  return `<div class="fl-api-media">
    <div class="fl-api-media-heading"><span class="fl-api-chip">${escapeHtml(media.mediaType)}</span></div>
    ${schema ? renderCodeDisclosure(label, schema) : ""}
    ${example?.value !== undefined ? renderCodeDisclosure(example.summary ?? "Example", safeJson(example.value)) : ""}
  </div>`;
}

function renderCodeDisclosure(label: string, value: string): string {
  return `<details class="fl-api-schema">
    <summary>${escapeHtml(label)}${chevronIcon()}</summary>
    <div class="fl-api-schema-code">
      <button type="button" class="fl-api-copy" data-copy="${escapeAttribute(value)}" aria-label="Copy ${escapeAttribute(label)}">Copy</button>
      <pre><code>${escapeHtml(value)}</code></pre>
    </div>
  </details>`;
}

function renderSecurity(operation: NormalizedOpenApiOperation): string {
  if (operation.security.length === 0) return "";
  const names = Array.from(
    new Set(operation.security.flatMap((requirement) => Object.keys(requirement))),
  );
  return `<section class="fl-api-section">
    <h3>Authentication</h3>
    <div class="fl-api-chip-row">${names.map((name) => `<span class="fl-api-chip">${lockIcon()}${escapeHtml(name)}</span>`).join("")}</div>
  </section>`;
}

function renderServers(servers: string[]): string {
  if (servers.length === 0) return "";
  return `<div class="fl-api-servers">
    <span>Server</span>
    <code>${escapeHtml(servers[0] ?? "")}</code>
    <button type="button" class="fl-api-copy" data-copy="${escapeAttribute(servers[0] ?? "")}" aria-label="Copy server URL">Copy</button>
  </div>`;
}

function renderEmptyContract(): string {
  return `<div class="fl-api-empty">
    <strong>No operations found.</strong>
    <span>Add paths and operations to the OpenAPI contract, then refresh this reference.</span>
  </div>`;
}

function groupOperations(operations: NormalizedOpenApiOperation[]) {
  const groups = new Map<string, NormalizedOpenApiOperation[]>();
  for (const operation of operations) {
    const tag = operation.tags[0] ?? "General";
    const group = groups.get(tag) ?? [];
    group.push(operation);
    groups.set(tag, group);
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tag, grouped]) => ({
      tag,
      operations: grouped.sort((left, right) => left.title.localeCompare(right.title)),
    }));
}

function buildCurlExample(operation: NormalizedOpenApiOperation, modelServers: string[]): string {
  const server = (operation.servers[0] ?? modelServers[0] ?? "https://api.example.com").replace(
    /\/$/,
    "",
  );
  const target = shellQuote(`${server}${operation.path}`);
  const parts = [`curl --request ${operation.method}`, `  --url ${target}`];
  const contentType = operation.requestBody?.content[0]?.mediaType;
  if (contentType) parts.push(`  --header ${shellQuote(`Content-Type: ${contentType}`)}`);
  const example = operation.requestBody?.content
    .flatMap((entry) => entry.examples)
    .find((entry) => entry.value !== undefined)?.value;
  if (operation.requestBody) {
    parts.push(`  --data ${shellQuote(example === undefined ? "{}" : safeJson(example))}`);
  }
  return parts.join(" \\\n");
}

function mediaTypeExample(media: NormalizedOpenApiMediaType): unknown {
  const example = media.examples.find((entry) => entry.value !== undefined)?.value;
  return example === undefined ? schemaExample(media.schema) : example;
}

function parameterExample(parameter: NormalizedOpenApiParameter): unknown {
  const example = parameter.examples.find((entry) => entry.value !== undefined)?.value;
  if (example !== undefined) return example;
  const schema = asRecord(parameter.schema);
  if (!schema) return undefined;
  if (Object.hasOwn(schema, "example")) return schema.example;
  if (Object.hasOwn(schema, "default")) return schema.default;
  if (Object.hasOwn(schema, "const")) return schema.const;
  return Array.isArray(schema.enum) ? schema.enum[0] : undefined;
}

function schemaExample(schema: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  const record = asRecord(schema);
  if (!record) return undefined;
  if (Object.hasOwn(record, "example")) return record.example;
  if (Object.hasOwn(record, "default")) return record.default;
  if (Object.hasOwn(record, "const")) return record.const;
  if (Array.isArray(record.enum) && record.enum.length > 0) return record.enum[0];
  const composed = [record.oneOf, record.anyOf, record.allOf].find(
    (value) => Array.isArray(value) && value.length > 0,
  );
  if (Array.isArray(composed)) return schemaExample(composed[0], depth + 1);
  const type = schemaType(record);
  if (type === "array") {
    const item = schemaExample(record.items, depth + 1);
    return item === undefined ? [] : [item];
  }
  if (type === "object" || asRecord(record.properties)) {
    const properties = asRecord(record.properties) ?? {};
    return Object.fromEntries(
      Object.entries(properties).map(([name, value]) => [
        name,
        schemaExample(value, depth + 1) ?? placeholderSchemaValue(value),
      ]),
    );
  }
  return placeholderSchemaValue(record);
}

function placeholderSchemaValue(schema: unknown): unknown {
  const type = schemaType(asRecord(schema));
  if (type === "string") return "string";
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  if (type === "array") return [];
  if (type === "object") return {};
  return undefined;
}

function schemaType(schema: Record<string, unknown> | undefined): string {
  if (!schema) return "string";
  if (typeof schema.type === "string") return schema.type;
  if (Array.isArray(schema.type)) {
    return schema.type.find((entry) => typeof entry === "string" && entry !== "null") ?? "string";
  }
  if (schema.items !== undefined) return "array";
  if (schema.properties !== undefined || schema.additionalProperties !== undefined) return "object";
  return "string";
}

function parameterPlaceholder(parameter: NormalizedOpenApiParameter, type: string): string {
  if (type === "array") return "Comma-separated values";
  if (parameter.in === "path") return parameter.name;
  return `Optional ${type}`;
}

function formatInputValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatRequestBody(value: unknown, mediaType?: string): string {
  if (typeof value === "string" && !isJsonMediaType(mediaType)) return value;
  return safeJson(value);
}

function isJsonMediaType(mediaType?: string): boolean {
  const normalized = mediaType?.toLocaleLowerCase() ?? "";
  return normalized.includes("json") || normalized.includes("+json");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function operationSearchText(operation: NormalizedOpenApiOperation): string {
  return [
    operation.method,
    operation.path,
    operation.title,
    operation.summary,
    operation.description,
    operation.operationId,
    ...operation.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function schemaLabel(schema: unknown): string {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return "any";
  const record = schema as Record<string, unknown>;
  if (typeof record.type === "string") {
    if (record.type === "array") return `${schemaLabel(record.items)}[]`;
    return record.type;
  }
  if (Array.isArray(record.type)) return record.type.join(" | ");
  if (Array.isArray(record.enum)) return "enum";
  return "object";
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return "[unserializable value]";
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function renderText(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function methodTone(method: string): string {
  return METHOD_TONES[method] ?? "neutral";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function resolveTokens(theme?: DocsTheme): NativeApiReferenceTokens {
  const colors = theme?.ui?.colors;
  const typography = theme?.ui?.typography?.font?.style;
  const background = colors?.background ?? "#ffffff";
  const foreground =
    colors?.foreground ?? (looksDark(background, theme?.name) ? "#f5f5f4" : "#18181b");
  const primary = colors?.primary ?? "#4f46e5";
  return {
    primary,
    primaryForeground: colors?.primaryForeground ?? (looksDark(primary) ? "#ffffff" : "#111113"),
    background,
    card: colors?.card ?? background,
    foreground,
    muted: colors?.muted ?? (looksDark(background, theme?.name) ? "#a1a1aa" : "#62626d"),
    border: colors?.border ?? (looksDark(background, theme?.name) ? "#2d2d33" : "#dedee3"),
    radius: theme?.ui?.radius ?? "8px",
    sans: typography?.sans ?? '"Geist", "Inter", ui-sans-serif, system-ui, sans-serif',
    mono: typography?.mono ?? '"Geist Mono", "SFMono-Regular", Menlo, monospace',
    customPalette: Boolean(colors),
  };
}

function looksDark(color: string, name?: string): boolean {
  if (name?.toLocaleLowerCase().includes("dark")) return true;
  const match = /^#([\da-f]{6})$/i.exec(color.trim());
  if (!match?.[1]) return false;
  const red = Number.parseInt(match[1].slice(0, 2), 16);
  const green = Number.parseInt(match[1].slice(2, 4), 16);
  const blue = Number.parseInt(match[1].slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
}

function buildStyles(tokens: NativeApiReferenceTokens): string {
  const automaticDark = tokens.customPalette
    ? ""
    : `@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { --fl-bg: #0b0b0d; --fl-card: #111114; --fl-fg: #f4f4f5; --fl-muted: #a1a1aa; --fl-border: #2b2b31; --fl-soft: #18181d; }
}`;
  return `
:root { color-scheme: light; --fl-primary: ${tokens.primary}; --fl-primary-fg: ${tokens.primaryForeground}; --fl-bg: ${tokens.background}; --fl-card: ${tokens.card}; --fl-fg: ${tokens.foreground}; --fl-muted: ${tokens.muted}; --fl-border: ${tokens.border}; --fl-soft: color-mix(in srgb, var(--fl-card) 92%, var(--fl-fg) 8%); --fl-radius: ${tokens.radius}; --fl-sans: ${tokens.sans}; --fl-mono: ${tokens.mono}; }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; --fl-bg: #0b0b0d; --fl-card: #111114; --fl-fg: #f4f4f5; --fl-muted: #a1a1aa; --fl-border: #2b2b31; --fl-soft: #18181d; }
${automaticDark}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 88px; }
body { margin: 0; background: var(--fl-bg); color: var(--fl-fg); font: 15px/1.6 var(--fl-sans); }
button, input, select { font: inherit; }
button, a, input, select { -webkit-tap-highlight-color: transparent; }
a { color: inherit; }
code, pre, kbd { font-family: var(--fl-mono); }
.fl-skip-link { position: fixed; z-index: 100; top: 8px; left: 8px; transform: translateY(-150%); background: var(--fl-fg); color: var(--fl-bg); padding: 8px 12px; }
.fl-skip-link:focus { transform: translateY(0); }
.fl-api-shell { min-height: 100vh; }
.fl-api-topbar { position: sticky; z-index: 20; top: 0; min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 20px; border-bottom: 1px solid var(--fl-border); background: color-mix(in srgb, var(--fl-bg) 94%, transparent); backdrop-filter: blur(12px); }
.fl-api-brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 650; }
.fl-api-brand-mark { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--fl-fg); font: 700 10px/1 var(--fl-mono); letter-spacing: -.04em; }
.fl-api-topbar-actions, .fl-api-version-control { display: flex; align-items: center; gap: 8px; }
.fl-api-version-control > span { color: var(--fl-muted); font: 11px/1 var(--fl-mono); text-transform: uppercase; letter-spacing: .08em; }
.fl-api-version-control select, .fl-api-action, .fl-api-icon-button { min-height: 34px; border: 1px solid var(--fl-border); border-radius: calc(var(--fl-radius) * .65); background: var(--fl-card); color: var(--fl-fg); }
.fl-api-version-control select { padding: 0 28px 0 10px; }
.fl-api-action { display: inline-flex; align-items: center; padding: 0 11px; text-decoration: none; font: 12px/1 var(--fl-mono); }
.fl-api-icon-button { width: 34px; display: grid; place-items: center; cursor: pointer; }
.fl-api-icon-button svg, .fl-api-search-wrap svg, .fl-api-chip svg { width: 15px; height: 15px; }
.fl-api-layout { display: grid; grid-template-columns: minmax(240px, 292px) minmax(0, 1fr); }
.fl-api-sidebar { position: sticky; top: 59px; height: calc(100vh - 59px); overflow: auto; padding: 20px 16px 32px; border-right: 1px solid var(--fl-border); }
.fl-api-sidebar-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; color: var(--fl-muted); font-size: 12px; }
.fl-api-eyebrow { color: var(--fl-muted); font: 11px/1.3 var(--fl-mono); letter-spacing: .08em; text-transform: uppercase; }
.fl-api-search-label { display: block; margin-bottom: 7px; color: var(--fl-muted); font-size: 12px; }
.fl-api-search-wrap { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 7px; height: 38px; padding: 0 10px; border: 1px solid var(--fl-border); border-radius: var(--fl-radius); background: var(--fl-card); }
.fl-api-search { width: 100%; border: 0; outline: 0; background: transparent; color: var(--fl-fg); }
.fl-api-search::placeholder { color: var(--fl-muted); }
.fl-api-search-wrap:focus-within { border-color: var(--fl-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fl-primary) 18%, transparent); }
.fl-api-search-wrap kbd { padding: 2px 5px; border: 1px solid var(--fl-border); color: var(--fl-muted); font-size: 10px; }
.fl-api-search-status { min-height: 18px; margin: 7px 0 0; color: var(--fl-muted); font-size: 11px; }
.fl-api-nav-group { margin-top: 22px; }
.fl-api-nav-group[hidden] { display: none; }
.fl-api-nav-group h2 { margin: 0 8px 8px; color: var(--fl-muted); font: 600 11px/1.3 var(--fl-mono); letter-spacing: .08em; text-transform: uppercase; }
.fl-api-nav-group ul { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.fl-api-nav-group a { display: grid; grid-template-columns: 46px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 36px; padding: 6px 8px; border-left: 2px solid transparent; text-decoration: none; font-size: 13px; }
.fl-api-nav-group a:hover, .fl-api-nav-group a:focus-visible { border-left-color: var(--fl-primary); background: var(--fl-soft); outline: none; }
.fl-api-nav-group a span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-api-method { display: inline-flex; align-items: center; justify-content: center; min-width: 46px; height: 22px; padding: 0 6px; border: 1px solid currentColor; border-radius: calc(var(--fl-radius) * .5); font: 700 10px/1 var(--fl-mono); letter-spacing: .04em; }
.fl-api-method--success { color: #16803d; }.fl-api-method--info { color: #2563eb; }.fl-api-method--warning { color: #b45309; }.fl-api-method--danger { color: #dc2626; }.fl-api-method--neutral { color: var(--fl-muted); }
.fl-api-content { min-width: 0; }
.fl-api-hero { padding: clamp(32px, 6vw, 76px) clamp(22px, 6vw, 82px) 44px; border-bottom: 1px solid var(--fl-border); }
.fl-api-hero-copy { max-width: 780px; }
.fl-api-hero h1 { max-width: 18ch; margin: 10px 0 12px; font-size: clamp(34px, 5vw, 64px); line-height: 1.02; letter-spacing: -.045em; }
.fl-api-description { max-width: 76ch; color: var(--fl-muted); }
.fl-api-description p { margin: 0 0 8px; }
.fl-api-summary { display: flex; flex-wrap: wrap; gap: 1px; margin: 30px 0 0; }
.fl-api-summary div { min-width: 120px; padding: 12px 16px; border: 1px solid var(--fl-border); background: var(--fl-card); }
.fl-api-summary dt { color: var(--fl-muted); font: 10px/1.3 var(--fl-mono); text-transform: uppercase; letter-spacing: .08em; }
.fl-api-summary dd { margin: 4px 0 0; font: 650 20px/1.2 var(--fl-mono); }
.fl-api-servers { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; max-width: 780px; margin-top: 18px; border: 1px solid var(--fl-border); background: var(--fl-soft); }
.fl-api-servers > span { padding: 9px 12px; border-right: 1px solid var(--fl-border); color: var(--fl-muted); font: 10px/1 var(--fl-mono); text-transform: uppercase; }
.fl-api-servers code { overflow: auto; padding: 9px 12px; font-size: 12px; white-space: nowrap; }
.fl-api-copy { min-width: 54px; align-self: stretch; padding: 7px 10px; border: 0; border-left: 1px solid var(--fl-border); background: transparent; color: var(--fl-muted); cursor: pointer; font: 11px/1 var(--fl-mono); }
.fl-api-copy:hover, .fl-api-copy:focus-visible { background: var(--fl-card); color: var(--fl-fg); outline: 2px solid var(--fl-primary); outline-offset: -2px; }
.fl-api-operations { padding: 0 clamp(22px, 5vw, 72px) 80px; }
.fl-api-operation { padding: clamp(36px, 6vw, 72px) 0; border-bottom: 1px solid var(--fl-border); scroll-margin-top: 76px; }
.fl-api-operation[hidden] { display: none; }
.fl-api-operation-header { max-width: 900px; }
.fl-api-operation-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.fl-api-operation-meta > code { overflow-wrap: anywhere; color: var(--fl-fg); font-size: 13px; }
.fl-api-operation h2 { margin: 15px 0 7px; font-size: clamp(25px, 3vw, 38px); line-height: 1.15; letter-spacing: -.025em; }
.fl-api-summary-copy { margin: 0 0 8px; font-weight: 520; }
.fl-api-operation-links { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 18px; font: 11px/1.4 var(--fl-mono); }
.fl-api-operation-links a { text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
.fl-api-operation-links code { color: var(--fl-muted); }
.fl-api-operation-grid { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(300px, .88fr); gap: clamp(24px, 5vw, 60px); margin-top: 30px; align-items: start; }
.fl-api-operation-details { min-width: 0; }
.fl-api-section { padding: 24px 0; border-top: 1px solid var(--fl-border); }
.fl-api-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 15px; }
.fl-api-section h3 > span { color: var(--fl-muted); font: 11px/1 var(--fl-mono); }
.fl-api-table-wrap { overflow-x: auto; border: 1px solid var(--fl-border); }
table { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 13px; }
th, td { padding: 11px 12px; border-bottom: 1px solid var(--fl-border); text-align: left; vertical-align: top; }
th { background: var(--fl-soft); color: var(--fl-muted); font: 10px/1.3 var(--fl-mono); text-transform: uppercase; letter-spacing: .06em; }
tbody tr:last-child td { border-bottom: 0; }
td code { font-size: 12px; }
.fl-api-required { display: inline-block; margin-left: 7px; color: #dc2626; font: 9px/1 var(--fl-mono); text-transform: uppercase; }
.fl-api-chip-row { display: flex; flex-wrap: wrap; gap: 7px; }
.fl-api-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border: 1px solid var(--fl-border); border-radius: calc(var(--fl-radius) * .5); background: var(--fl-soft); color: var(--fl-muted); font: 10px/1 var(--fl-mono); }
.fl-api-chip--danger { color: #dc2626; }
.fl-api-code-panel { position: sticky; top: 84px; overflow: hidden; border: 1px solid var(--fl-border); border-radius: var(--fl-radius); background: #0c0c0f; color: #f4f4f5; }
.fl-api-code-header { min-height: 38px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #29292f; color: #a1a1aa; font: 10px/1 var(--fl-mono); text-transform: uppercase; letter-spacing: .08em; }
.fl-api-code-tabs { align-self: stretch; display: flex; align-items: stretch; }
.fl-api-code-tabs button { position: relative; min-width: 70px; padding: 0 12px; border: 0; border-right: 1px solid #29292f; background: transparent; color: #a1a1aa; cursor: pointer; font: inherit; letter-spacing: inherit; text-transform: inherit; }
.fl-api-code-tabs button[aria-selected="true"] { background: #151519; color: #f4f4f5; }
.fl-api-code-tabs button[aria-selected="true"]::after { content: ""; position: absolute; right: 10px; bottom: -1px; left: 10px; height: 2px; background: var(--fl-primary); }
.fl-api-code-tabs button:hover, .fl-api-code-tabs button:focus-visible { color: #f4f4f5; outline: 2px solid var(--fl-primary); outline-offset: -2px; }
.fl-api-code-panel .fl-api-copy { color: #a1a1aa; border-left-color: #29292f; }
.fl-api-code-panel pre, .fl-api-schema pre { margin: 0; overflow: auto; padding: 16px; font-size: 12px; line-height: 1.7; }
.fl-api-console { display: grid; gap: 16px; max-height: min(76vh, 780px); overflow-y: auto; padding: 16px; background: #0c0c0f; color: #f4f4f5; }
.fl-api-console-intro, .fl-api-console-response-header, .fl-api-console-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.fl-api-console-intro > div { min-width: 0; display: grid; gap: 5px; }
.fl-api-console-intro strong { overflow-wrap: anywhere; font: 600 12px/1.45 var(--fl-mono); }
.fl-api-console-kicker, .fl-api-console-group legend { color: #a1a1aa; font: 10px/1.3 var(--fl-mono); text-transform: uppercase; letter-spacing: .08em; }
.fl-api-console-state { flex: 0 0 auto; padding: 4px 7px; border: 1px solid #3f3f46; color: #a1a1aa; font: 10px/1 var(--fl-mono); }
.fl-api-console-state[data-state="sending"] { border-color: #6366f1; color: #a5b4fc; }
.fl-api-console-state[data-state="success"] { border-color: #22c55e; color: #86efac; }
.fl-api-console-state[data-state="error"] { border-color: #ef4444; color: #fca5a5; }
.fl-api-console-group { display: grid; gap: 12px; min-width: 0; margin: 0; padding: 14px; border: 1px solid #29292f; }
.fl-api-console-group legend { padding: 0 6px; }
.fl-api-field { display: grid; gap: 6px; min-width: 0; color: #d4d4d8; font: 11px/1.35 var(--fl-mono); }
.fl-api-field > span { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px; }
.fl-api-field > span small { color: #71717a; font-size: 9px; text-transform: uppercase; }
.fl-api-field em { color: #fca5a5; font-size: 9px; font-style: normal; text-transform: uppercase; }
.fl-api-field input, .fl-api-field select, .fl-api-field textarea { width: 100%; min-width: 0; border: 1px solid #3f3f46; border-radius: calc(var(--fl-radius) * .55); background: #151519; color: #f4f4f5; font: 12px/1.45 var(--fl-mono); }
.fl-api-field input, .fl-api-field select { height: 36px; padding: 0 10px; }
.fl-api-field textarea { resize: vertical; min-height: 112px; padding: 10px; tab-size: 2; }
.fl-api-field input::placeholder, .fl-api-field textarea::placeholder { color: #71717a; }
.fl-api-field input:focus, .fl-api-field select:focus, .fl-api-field textarea:focus { border-color: #818cf8; outline: 2px solid color-mix(in srgb, #6366f1 45%, transparent); outline-offset: 0; }
.fl-api-field--inline { grid-template-columns: minmax(120px, .7fr) minmax(0, 1fr); align-items: center; }
.fl-api-field-help, .fl-api-console-hint, .fl-api-console-note { color: #a1a1aa; font-size: 10px; line-height: 1.5; }
.fl-api-console-hint, .fl-api-console-note { margin: 0; }
.fl-api-console-hint code { color: #d4d4d8; }
.fl-api-auth-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fl-api-console-confirm { display: flex; align-items: flex-start; gap: 8px; color: #fcd34d; font: 10px/1.45 var(--fl-mono); }
.fl-api-console-confirm input { margin: 1px 0 0; accent-color: #6366f1; }
.fl-api-console-actions { justify-content: flex-start; min-height: 36px; }
.fl-api-console-actions button { min-height: 34px; padding: 0 12px; border: 1px solid #3f3f46; border-radius: calc(var(--fl-radius) * .55); cursor: pointer; font: 600 11px/1 var(--fl-mono); }
.fl-api-console-send { background: var(--fl-primary); color: var(--fl-primary-fg); border-color: var(--fl-primary) !important; }
.fl-api-console-send:hover:not(:disabled), .fl-api-console-send:focus-visible { filter: brightness(1.08); outline: 2px solid #a5b4fc; outline-offset: 2px; }
.fl-api-console-send:disabled { cursor: not-allowed; opacity: .45; }
.fl-api-console-cancel { background: transparent; color: #d4d4d8; }
.fl-api-console-actions > span { color: #a1a1aa; font: 10px/1.4 var(--fl-mono); }
.fl-api-console-error { padding: 10px 12px; border: 1px solid #7f1d1d; background: #2a1013; color: #fecaca; font: 11px/1.5 var(--fl-mono); }
.fl-api-console-response { min-width: 0; border: 1px solid #3f3f46; outline: none; }
.fl-api-console-response:focus-visible { border-color: #818cf8; box-shadow: 0 0 0 2px #6366f1; }
.fl-api-console-response-header { min-height: 38px; border-bottom: 1px solid #29292f; }
.fl-api-console-response-header > div { display: flex; align-items: center; gap: 8px; padding-left: 11px; color: #a1a1aa; font: 10px/1 var(--fl-mono); }
.fl-api-console-status { color: #86efac; font-weight: 700; }
.fl-api-console-status[data-ok="false"] { color: #fca5a5; }
.fl-api-console-response-meta { display: grid; gap: 4px; padding: 9px 11px; border-bottom: 1px solid #29292f; color: #a1a1aa; font: 9px/1.4 var(--fl-mono); }
.fl-api-console-response-meta code { overflow: hidden; color: #d4d4d8; text-overflow: ellipsis; white-space: nowrap; }
.fl-api-console-response-headers { border-bottom: 1px solid #29292f; }
.fl-api-console-response-headers summary { display: flex; align-items: center; justify-content: space-between; padding: 9px 11px; color: #a1a1aa; cursor: pointer; font: 10px/1.3 var(--fl-mono); list-style: none; }
.fl-api-console-response-headers summary::-webkit-details-marker { display: none; }
.fl-api-console-response-headers summary svg { width: 14px; transition: transform .15s ease; }
.fl-api-console-response-headers[open] summary svg { transform: rotate(180deg); }
.fl-api-console-response-headers pre { max-height: 180px; padding: 11px; border-top: 1px solid #29292f; color: #d4d4d8; }
.fl-api-console-response-body { max-height: 340px; min-height: 72px; color: #f4f4f5; white-space: pre-wrap; overflow-wrap: anywhere; }
.fl-api-console-note { padding-top: 2px; border-top: 1px solid #29292f; }
.fl-api-response-list { display: grid; border: 1px solid var(--fl-border); }
.fl-api-response + .fl-api-response { border-top: 1px solid var(--fl-border); }
.fl-api-response > summary, .fl-api-schema > summary { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 11px 12px; cursor: pointer; list-style: none; }
.fl-api-response > summary::-webkit-details-marker, .fl-api-schema > summary::-webkit-details-marker { display: none; }
.fl-api-response > summary:hover, .fl-api-schema > summary:hover { background: var(--fl-soft); }
.fl-api-response > summary svg, .fl-api-schema > summary svg { width: 14px; transition: transform .15s ease; }
.fl-api-response[open] > summary svg, .fl-api-schema[open] > summary svg { transform: rotate(180deg); }
.fl-api-response-content { padding: 0 12px 12px; }
.fl-api-media + .fl-api-media { margin-top: 12px; }
.fl-api-media-heading { margin: 10px 0 8px; }
.fl-api-schema { overflow: hidden; margin-top: 8px; border: 1px solid var(--fl-border); border-radius: calc(var(--fl-radius) * .7); }
.fl-api-schema > summary { grid-template-columns: minmax(0, 1fr) auto; font: 11px/1.4 var(--fl-mono); }
.fl-api-schema-code { position: relative; border-top: 1px solid var(--fl-border); background: #0c0c0f; color: #f4f4f5; }
.fl-api-schema-code .fl-api-copy { position: absolute; z-index: 1; top: 0; right: 0; height: 34px; color: #a1a1aa; border: 1px solid #29292f; border-top: 0; border-right: 0; background: #0c0c0f; }
.fl-api-muted { color: var(--fl-muted); }
.fl-api-empty, .fl-api-no-results { display: grid; gap: 6px; padding: 32px; border: 1px dashed var(--fl-border); color: var(--fl-muted); }
.fl-api-empty strong, .fl-api-no-results strong { color: var(--fl-fg); }
.fl-api-no-results { margin-top: 48px; }
.fl-api-sidebar-empty { color: var(--fl-muted); font-size: 13px; }
.fl-api-live-region { position: fixed; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
:focus-visible { outline: 2px solid var(--fl-primary); outline-offset: 2px; }
@media (max-width: 980px) { .fl-api-layout { grid-template-columns: 230px minmax(0, 1fr); } .fl-api-operation-grid { grid-template-columns: 1fr; } .fl-api-code-panel { position: relative; top: 0; } }
@media (max-width: 720px) { .fl-api-topbar { padding-inline: 12px; } .fl-api-brand > span:last-child, .fl-api-version-control > span, .fl-api-action { display: none; } .fl-api-layout { display: block; } .fl-api-sidebar { position: relative; top: 0; width: 100%; height: auto; max-height: 52vh; border-right: 0; border-bottom: 1px solid var(--fl-border); } .fl-api-hero { padding: 32px 18px; } .fl-api-operations { padding-inline: 18px; } .fl-api-operation-grid { gap: 22px; } .fl-api-servers { grid-template-columns: auto minmax(0, 1fr); } .fl-api-servers .fl-api-copy { display: none; } .fl-api-field--inline, .fl-api-auth-pair { grid-template-columns: 1fr; } .fl-api-console { max-height: none; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
`;
}

function buildClientScript(): string {
  return `(() => {
  const root = document.documentElement;
  const search = document.querySelector('[data-search-status]');
  const input = document.getElementById('fl-api-search');
  const operations = Array.from(document.querySelectorAll('[data-operation]'));
  const navItems = Array.from(document.querySelectorAll('[data-nav-operation]'));
  const groups = Array.from(document.querySelectorAll('[data-nav-group]'));
  const noResults = document.querySelector('[data-no-results]');
  const copyStatus = document.querySelector('[data-copy-status]');
  const applySearch = () => {
    const query = (input?.value || '').trim().toLocaleLowerCase();
    let visible = 0;
    for (const operation of operations) {
      const match = !query || (operation.dataset.search || '').includes(query);
      operation.hidden = !match;
      if (match) visible += 1;
    }
    for (const item of navItems) item.hidden = Boolean(query) && !(item.dataset.search || '').includes(query);
    for (const group of groups) group.hidden = !group.querySelector('[data-nav-operation]:not([hidden])');
    if (noResults) noResults.hidden = visible !== 0;
    if (search) search.textContent = query ? visible + ' of ' + operations.length + ' operations' : '';
  };
  input?.addEventListener('input', applySearch);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
      event.preventDefault(); input?.focus();
    }
  });
  document.querySelector('[data-version-select]')?.addEventListener('change', (event) => {
    const target = event.currentTarget;
    if (target instanceof HTMLSelectElement && target.value) window.location.assign(target.value);
  });
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('farming-labs-api-theme', next); } catch {}
  });
  try { const saved = localStorage.getItem('farming-labs-api-theme'); if (saved === 'dark' || saved === 'light') root.dataset.theme = saved; } catch {}
  const activateConsoleTab = (consoleRoot, tab) => {
    const tabs = Array.from(consoleRoot.querySelectorAll('[data-console-tab]'));
    const panels = Array.from(consoleRoot.querySelectorAll('[data-console-panel]'));
    for (const candidate of tabs) {
      const active = candidate.dataset.consoleTab === tab;
      candidate.setAttribute('aria-selected', String(active));
      candidate.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.consolePanel !== tab;
    const exampleCopy = consoleRoot.querySelector('[data-example-copy]');
    if (exampleCopy instanceof HTMLElement) exampleCopy.hidden = tab !== 'example';
  };
  for (const consoleRoot of document.querySelectorAll('[data-console-root]')) {
    const tabs = Array.from(consoleRoot.querySelectorAll('[data-console-tab]'));
    for (const tab of tabs) {
      tab.addEventListener('click', () => activateConsoleTab(consoleRoot, tab.dataset.consoleTab || 'example'));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = tabs.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        const nextTab = tabs[next];
        if (nextTab instanceof HTMLElement) {
          activateConsoleTab(consoleRoot, nextTab.dataset.consoleTab || 'example');
          nextTab.focus();
        }
      });
    }
  }
  const setConsoleState = (form, state, label) => {
    const badge = form.querySelector('[data-console-state]');
    if (badge instanceof HTMLElement) { badge.dataset.state = state; badge.textContent = label; }
  };
  const encodeBasicCredentials = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  const appendQueryValue = (searchParams, name, value, array) => {
    const values = array ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : [value];
    for (const entry of values) searchParams.append(name, entry);
  };
  const formatResponseBody = (value, contentType) => {
    if (!value) return '(empty response)';
    if (!contentType.includes('json') && !contentType.includes('+json')) return value;
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  };
  for (const form of document.querySelectorAll('[data-api-console]')) {
    if (!(form instanceof HTMLFormElement)) continue;
    let controller;
    const send = form.querySelector('[data-console-send]');
    const cancel = form.querySelector('[data-console-cancel]');
    const confirm = form.querySelector('[data-console-confirm]');
    const message = form.querySelector('[data-console-message]');
    const error = form.querySelector('[data-console-error]');
    const responsePanel = form.querySelector('[data-console-response]');
    if (confirm instanceof HTMLInputElement && send instanceof HTMLButtonElement) {
      confirm.addEventListener('change', () => { send.disabled = !confirm.checked; });
    }
    cancel?.addEventListener('click', () => controller?.abort());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || !(send instanceof HTMLButtonElement)) return;
      if (error instanceof HTMLElement) { error.hidden = true; error.textContent = ''; }
      if (responsePanel instanceof HTMLElement) responsePanel.hidden = true;
      const originalLabel = send.textContent || 'Send request';
      send.disabled = true;
      send.textContent = 'Sending…';
      if (cancel instanceof HTMLElement) cancel.hidden = false;
      if (message instanceof HTMLElement) message.textContent = 'Request in progress';
      setConsoleState(form, 'sending', 'Sending');
      controller = new AbortController();
      const started = performance.now();
      try {
        const serverInput = form.elements.namedItem('server');
        if (!(serverInput instanceof HTMLInputElement)) throw new Error('Server URL is required.');
        const server = new URL(serverInput.value, window.location.origin);
        if (server.protocol !== 'http:' && server.protocol !== 'https:') throw new Error('Server URL must use HTTP or HTTPS.');
        let operationPath = form.dataset.path || '/';
        const headers = new Headers();
        const query = [];
        for (const input of form.querySelectorAll('[data-param-name]')) {
          if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) continue;
          const value = input.value.trim();
          if (!value) continue;
          const name = input.dataset.paramName || '';
          const location = input.dataset.paramLocation;
          if (location === 'path') operationPath = operationPath.split('{' + name + '}').join(encodeURIComponent(value));
          else if (location === 'query') query.push([name, value, input.dataset.paramArray === 'true']);
          else if (location === 'header') headers.set(name, value);
        }
        server.hash = '';
        server.search = '';
        server.pathname = server.pathname.replace(/\\/+$/, '') + '/' + operationPath.replace(/^\\/+/, '');
        const url = server;
        for (const [name, value, array] of query) appendQueryValue(url.searchParams, name, value, array);
        for (const auth of form.querySelectorAll('[data-auth-token]')) {
          if (auth instanceof HTMLInputElement && auth.value) headers.set('authorization', (auth.dataset.authPrefix || 'Bearer') + ' ' + auth.value);
        }
        for (const auth of form.querySelectorAll('[data-auth-api-key]')) {
          if (!(auth instanceof HTMLInputElement) || !auth.value) continue;
          const name = auth.dataset.authName || '';
          if (auth.dataset.authLocation === 'query') url.searchParams.append(name, auth.value);
          else headers.set(name, auth.value);
        }
        const basic = form.querySelector('[data-auth-basic]');
        const username = basic?.querySelector('[data-auth-username]');
        const password = basic?.querySelector('[data-auth-password]');
        if (username instanceof HTMLInputElement && password instanceof HTMLInputElement && (username.value || password.value)) {
          headers.set('authorization', 'Basic ' + encodeBasicCredentials(username.value + ':' + password.value));
        }
        const bodyInput = form.elements.namedItem('request-body');
        const contentTypeInput = form.elements.namedItem('content-type');
        let body;
        if (bodyInput instanceof HTMLTextAreaElement && bodyInput.value.trim()) {
          body = bodyInput.value;
          const contentType = contentTypeInput instanceof HTMLSelectElement ? contentTypeInput.value : 'application/json';
          if (contentType.toLocaleLowerCase().includes('json') || contentType.toLocaleLowerCase().includes('+json')) body = JSON.stringify(JSON.parse(body));
          headers.set('content-type', contentType);
        }
        const credentialsInput = form.elements.namedItem('credentials');
        const credentials = credentialsInput instanceof HTMLSelectElement ? credentialsInput.value : 'same-origin';
        const response = await fetch(url, {
          method: form.dataset.method || 'GET',
          headers,
          body,
          credentials,
          signal: controller.signal,
        });
        const rawBody = await response.text();
        const contentType = response.headers.get('content-type') || 'unknown content type';
        const formattedBody = formatResponseBody(rawBody, contentType.toLocaleLowerCase());
        const duration = Math.round(performance.now() - started);
        const status = form.querySelector('[data-response-status]');
        const durationTarget = form.querySelector('[data-response-duration]');
        const urlTarget = form.querySelector('[data-response-url]');
        const typeTarget = form.querySelector('[data-response-type]');
        const headersTarget = form.querySelector('[data-response-headers]');
        const bodyTarget = form.querySelector('[data-response-body]');
        const copy = form.querySelector('[data-response-copy]');
        if (status instanceof HTMLElement) { status.textContent = response.status + ' ' + response.statusText; status.dataset.ok = String(response.ok); }
        if (durationTarget instanceof HTMLElement) durationTarget.textContent = duration + ' ms';
        if (urlTarget instanceof HTMLElement) { urlTarget.textContent = url.href; urlTarget.title = url.href; }
        if (typeTarget instanceof HTMLElement) typeTarget.textContent = contentType;
        if (headersTarget instanceof HTMLElement) headersTarget.textContent = Array.from(response.headers.entries()).map(([name, value]) => name + ': ' + value).join('\\n') || '(no exposed response headers)';
        if (bodyTarget instanceof HTMLElement) bodyTarget.textContent = formattedBody;
        if (copy instanceof HTMLButtonElement) copy.dataset.copy = formattedBody;
        if (responsePanel instanceof HTMLElement) { responsePanel.hidden = false; responsePanel.focus({ preventScroll: true }); }
        setConsoleState(form, response.ok ? 'success' : 'error', response.ok ? 'Complete' : 'HTTP error');
        if (message instanceof HTMLElement) message.textContent = response.ok ? 'Request completed' : 'Request completed with an error status';
      } catch (requestError) {
        const aborted = requestError instanceof DOMException && requestError.name === 'AbortError';
        const detail = aborted ? 'Request cancelled.' : requestError instanceof Error ? requestError.message : 'The request could not be sent.';
        setConsoleState(form, aborted ? 'idle' : 'error', aborted ? 'Cancelled' : 'Failed');
        if (message instanceof HTMLElement) message.textContent = aborted ? 'Request cancelled' : 'Request failed';
        if (error instanceof HTMLElement) { error.hidden = false; error.textContent = detail; }
      } finally {
        controller = undefined;
        send.textContent = originalLabel;
        send.disabled = confirm instanceof HTMLInputElement ? !confirm.checked : false;
        if (cancel instanceof HTMLElement) cancel.hidden = true;
      }
    });
  }
  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-copy]') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const value = button.dataset.copy || '';
    const original = button.textContent || 'Copy';
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'Copied';
      if (copyStatus) copyStatus.textContent = 'Copied to clipboard';
      setTimeout(() => { button.textContent = original; if (copyStatus) copyStatus.textContent = ''; }, 1600);
    } catch {
      button.textContent = 'Failed';
      if (copyStatus) copyStatus.textContent = 'Could not copy to clipboard';
      setTimeout(() => { button.textContent = original; if (copyStatus) copyStatus.textContent = ''; }, 1600);
    }
  });
})();`;
}

function searchIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>';
}

function themeIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.6-.1-1.2-.2-1.8A7 7 0 0 1 12 3Z"/></svg>';
}

function lockIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
}

function chevronIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
}
